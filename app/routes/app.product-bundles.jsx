import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Box,
  BlockStack,
  InlineStack,
  IndexTable,
  Badge,
  TextField,
  Banner,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// GraphQL query to fetch details for selected products (for prices & handles)
const GET_PRODUCTS_DETAILS = `#graphql
  query GetProductsDetails($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        handle
        featuredImage {
          url
        }
        variants(first: 1) {
          nodes {
            price
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const bundles = await prisma.productBundle.findMany({
    where: { shop: session.shop },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  return { bundles };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_bundle" || intent === "update_bundle") {
    const mainProductId = formData.get("mainProductId");
    const title = formData.get("title") || "Frequently Bought Together";
    const selectedItemIdsJson = formData.get("selectedItemIds");
    const bundleId = formData.get("bundleId");

    if (!mainProductId || !selectedItemIdsJson) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const itemIds = JSON.parse(selectedItemIdsJson);
    if (itemIds.length === 0) {
      return Response.json({ error: "Please select at least one bundled product" }, { status: 400 });
    }

    try {
      // Fetch details from Shopify GraphQL to verify and get image, price, title, handle
      const idsToQuery = [mainProductId, ...itemIds];
      const response = await admin.graphql(GET_PRODUCTS_DETAILS, {
        variables: { ids: idsToQuery },
      });
      const data = await response.json();

      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      const productsData = data.data.nodes.filter(Boolean);
      const mainProductInfo = productsData.find((p) => p.id === mainProductId);

      if (!mainProductInfo) {
        throw new Error("Main product details could not be retrieved");
      }

      let bundle;
      if (intent === "update_bundle") {
        bundle = await prisma.productBundle.update({
          where: { id: bundleId },
          data: {
            productId: mainProductId,
            productHandle: mainProductInfo.handle,
            title,
            discountType: "none",
            discountValue: 0,
          },
        });

        // Delete existing items to recreate them
        await prisma.bundleItem.deleteMany({
          where: { bundleId: bundle.id },
        });
      } else {
        // Create the bundle
        bundle = await prisma.productBundle.create({
          data: {
            shop: session.shop,
            productId: mainProductId,
            productHandle: mainProductInfo.handle,
            title,
            discountType: "none",
            discountValue: 0,
          },
        });
      }

      // Add bundle items
      for (const itemId of itemIds) {
        const itemInfo = productsData.find((p) => p.id === itemId);
        if (itemInfo) {
          const price = parseFloat(itemInfo.variants.nodes[0]?.price || "0");
          const image = itemInfo.featuredImage?.url || null;

          await prisma.bundleItem.create({
            data: {
              bundleId: bundle.id,
              productId: itemId,
              productHandle: itemInfo.handle,
              title: itemInfo.title,
              price,
              image,
            },
          });
        }
      }

      return Response.json({ success: true });
    } catch (err) {
      console.error("Failed to save bundle:", err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  if (intent === "delete_bundle") {
    const id = formData.get("id");
    if (!id) {
      return Response.json({ error: "Missing bundle ID" }, { status: 400 });
    }

    try {
      await prisma.productBundle.delete({
        where: { id },
      });
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid intent" }, { status: 400 });
};

export default function ProductBundlesPage() {
  const { bundles } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [mainProduct, setMainProduct] = useState(null);
  const [bundledProducts, setBundledProducts] = useState([]);
  const [title, setTitle] = useState("Frequently Bought Together");
  const [showCreateCard, setShowCreateCard] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState(null);

  const isSubmitting = fetcher.state === "submitting";

  const handleSelectMainProduct = async () => {
    try {
      const selection = await shopify.resourcePicker({
        type: "product",
        multiple: false,
      });
      if (selection && selection[0]) {
        setMainProduct(selection[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectBundledProducts = async () => {
    try {
      const selection = await shopify.resourcePicker({
        type: "product",
        multiple: true,
      });
      if (selection) {
        setBundledProducts(selection);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBundle = () => {
    if (!mainProduct) {
      shopify.toast.show("Please select the main product", { error: true });
      return;
    }
    if (bundledProducts.length === 0) {
      shopify.toast.show("Please select at least one bundled product", { error: true });
      return;
    }

    const itemIds = bundledProducts.map((p) => p.id);
    const formData = new FormData();
    if (editingBundleId) {
      formData.append("intent", "update_bundle");
      formData.append("bundleId", editingBundleId);
    } else {
      formData.append("intent", "create_bundle");
    }
    formData.append("mainProductId", mainProduct.id);
    formData.append("mainProductHandle", mainProduct.handle);
    formData.append("title", title);
    formData.append("selectedItemIds", JSON.stringify(itemIds));

    fetcher.submit(formData, { method: "POST" });
  };

  const handleDeleteBundle = (id) => {
    const formData = new FormData();
    formData.append("intent", "delete_bundle");
    formData.append("id", id);
    fetcher.submit(formData, { method: "POST" });
  };

  const handleStartEdit = (bundle) => {
    setEditingBundleId(bundle.id);
    setMainProduct({
      id: bundle.productId,
      title: bundle.productHandle,
      handle: bundle.productHandle,
    });
    setBundledProducts(
      bundle.items.map((item) => ({
        id: item.productId,
        title: item.title,
        handle: item.productHandle,
      }))
    );
    setTitle(bundle.title);
    setShowCreateCard(true);
  };

  const handleCancel = () => {
    setMainProduct(null);
    setBundledProducts([]);
    setTitle("Frequently Bought Together");
    setEditingBundleId(null);
    setShowCreateCard(false);
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show(editingBundleId ? "Bundle updated successfully!" : "Bundle saved successfully!");
      setMainProduct(null);
      setBundledProducts([]);
      setTitle("Frequently Bought Together");
      setEditingBundleId(null);
      setShowCreateCard(false);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { error: true });
    }
  }, [fetcher.data, shopify, editingBundleId]);

  const resourceName = {
    singular: "bundle",
    plural: "bundles",
  };

  const rowMarkup = bundles.map((bundle, index) => {
    const itemsList = bundle.items.map((item) => item.title).join(", ");

    return (
      <IndexTable.Row id={bundle.id} key={bundle.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {bundle.productHandle}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{bundle.title}</IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ maxWidth: "300px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={itemsList}>
            {itemsList}
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              onClick={() => handleStartEdit(bundle)}
              disabled={isSubmitting}
            >
              Edit
            </Button>
            <Button
              tone="critical"
              variant="secondary"
              onClick={() => handleDeleteBundle(bundle.id)}
              disabled={isSubmitting}
            >
              Delete
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Product Bundles"
      subtitle="Create complementary product bundles displaying full price summaries."
      backAction={{ content: "Dashboard", url: "/app" }}
      primaryAction={{
        content: showCreateCard
          ? editingBundleId
            ? "Cancel Edit"
            : "View Active Bundles"
          : "Create New Bundle",
        onClick: () => {
          if (showCreateCard) {
            handleCancel();
          } else {
            setShowCreateCard(true);
          }
        },
      }}
    >
      <Layout>
        {/* Create Bundle Panel */}
        {showCreateCard && (
          <Layout.Section>
            <div className="premium-fade-in">
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                      {editingBundleId ? "Edit Product Bundle" : "Configure Product Bundle"}
                    </Text>
                    <Divider />Prefix

                    {/* Step 1: Select Main Product */}
                    <BlockStack gap="200">
                      <Text variant="headingSm">1. Main Trigger Product</Text>
                      <Text tone="subdued" variant="bodySm">
                        This is the product page where the bundle display will be shown to customers.
                      </Text>
                      <InlineStack gap="300" blockAlign="center">
                        <Button onClick={handleSelectMainProduct}>Select Main Product</Button>
                        {mainProduct && (
                          <Badge tone="info">
                            Selected: {mainProduct.title} ({mainProduct.handle})
                          </Badge>
                        )}
                      </InlineStack>
                    </BlockStack>

                    {/* Step 2: Select Complementary Products */}
                    <BlockStack gap="200">
                      <Text variant="headingSm">2. Bundled Products</Text>
                      <Text tone="subdued" variant="bodySm">
                        Select one or more products that will be suggested alongside the main product.
                      </Text>
                      <InlineStack gap="300" blockAlign="center">
                        <Button onClick={handleSelectBundledProducts}>Select Bundled Products</Button>
                        {bundledProducts.length > 0 && (
                          <Badge tone="info">
                            {bundledProducts.length} complementary products chosen
                          </Badge>
                        )}
                      </InlineStack>

                      {bundledProducts.length > 0 && (
                        <div style={{ marginLeft: "12px", borderLeft: "2px solid #e5e7eb", paddingLeft: "12px" }}>
                          <BlockStack gap="100">
                            {bundledProducts.map((p) => (
                              <Text key={p.id} variant="bodySm" tone="subdued">
                                • {p.title}
                              </Text>
                            ))}
                          </BlockStack>
                        </div>
                      )}
                    </BlockStack>

                    {/* Step 3: Bundle Details */}
                    <BlockStack gap="200">
                      <Text variant="headingSm">3. Settings</Text>
                      <TextField
                        label="Bundle Header Title"
                        value={title}
                        onChange={setTitle}
                        placeholder="e.g. Frequently Bought Together"
                        autoComplete="off"
                      />
                    </BlockStack>

                    <Divider />

                    <InlineStack gap="300" align="trailing">
                      <Button onClick={handleCancel}>Cancel</Button>
                      <Button primary onClick={handleSaveBundle} disabled={isSubmitting}>
                        {isSubmitting ? "Saving..." : editingBundleId ? "Update Bundle" : "Save & Activate Bundle"}
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </Card>
            </div>
          </Layout.Section>
        )}

        {/* Active Bundles List */}
        {!showCreateCard && (
          <Layout.Section>
            <div className="premium-fade-in">
              <Card padding="0">
                <Box padding="400" borderBlockEndWidth="100" borderColor="border-subdued">
                  <Text as="h2" variant="headingMd">
                    Active Product Bundles
                  </Text>
                </Box>

                {bundles.length === 0 ? (
                  <Box padding="800" style={{ textAlign: "center" }}>
                    <BlockStack gap="300" align="center">
                      <Text variant="bodyLg" tone="subdued">
                        No product bundles have been created yet.
                      </Text>
                      <div>
                        <Button primary onClick={() => setShowCreateCard(true)}>
                          Create Your First Bundle
                        </Button>
                      </div>
                    </BlockStack>
                  </Box>
                ) : (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={bundles.length}
                    headings={[
                      { title: "Trigger Handle" },
                      { title: "Header Title" },
                      { title: "Complementary Items" },
                      { title: "Actions" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                )}
              </Card>
            </div>
          </Layout.Section>
        )}

        {/* Global Error Banner */}
        {fetcher.data?.error && !showCreateCard && (
          <Layout.Section>
            <Banner tone="critical" title="Database Error">
              <Text as="p">{fetcher.data.error}</Text>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
