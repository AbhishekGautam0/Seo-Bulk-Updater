import { useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Text,
  Box,
  BlockStack,
  IndexTable,
  Badge,
  Banner,
  Checkbox,
  InlineStack,
  Button,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  
  let shopifyDiscounts = [];
  let scopesRequired = false;

  const GET_ACTIVE_DISCOUNTS = `#graphql
    query GetActiveDiscounts {
      discountNodes(first: 50, query: "status:active") {
        nodes {
          id
          discount {
            __typename
            ... on DiscountCodeBasic {
              title
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
              minimumRequirement {
                ... on DiscountMinimumSubtotal {
                  greaterThanOrEqualToSubtotal {
                    amount
                  }
                }
              }
              customerGets {
                value {
                  __typename
                  ... on DiscountPercentage {
                    percentage
                  }
                  ... on DiscountAmount {
                    amount {
                      amount
                    }
                  }
                }
                items {
                  ... on DiscountProducts {
                    products(first: 5) {
                      nodes {
                        id
                        title
                        handle
                      }
                    }
                  }
                }
              }
            }
            ... on DiscountCodeBxgy {
              title
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
            ... on DiscountCodeFreeShipping {
              title
              status
              startsAt
              endsAt
              codes(first: 1) {
                nodes {
                  code
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await admin.graphql(GET_ACTIVE_DISCOUNTS);
    const data = await response.json();
    
    if (data.errors && data.errors.some(e => e.extensions?.code === "ACCESS_DENIED" || e.message?.includes("Access denied"))) {
      scopesRequired = true;
    } else if (data.data?.discountNodes?.nodes) {
      shopifyDiscounts = data.data.discountNodes.nodes;
    }
  } catch (err) {
    console.error("Failed to query Shopify discounts:", err);
    if (err.message?.includes("Access denied") || err.message?.includes("scope")) {
      scopesRequired = true;
    }
  }

  // If scopes are authorized, sync Shopify discounts with database
  if (!scopesRequired) {
    const activeCodes = [];
    for (const node of shopifyDiscounts) {
      const discount = node.discount;
      if (!discount || discount.status !== "ACTIVE") continue;

      const codeNode = discount.codes?.nodes?.[0];
      if (!codeNode) continue;

      const code = codeNode.code.toUpperCase();
      activeCodes.push(code);

      const title = discount.title || "Discount Coupon";
      
      let discountType = "percentage";
      let discountValue = 0;
      let minSubtotal = 0;
      let requiredProductId = null;
      let requiredProductTitle = null;
      let requiredProductHandle = null;

      if (discount.__typename === "DiscountCodeBasic") {
        const value = discount.customerGets?.value;
        if (value) {
          if (value.__typename === "DiscountPercentage") {
            discountType = "percentage";
            discountValue = parseFloat(value.percentage) * 100;
          } else if (value.__typename === "DiscountAmount") {
            discountType = "fixed_amount";
            discountValue = parseFloat(value.amount?.amount || "0");
          }
        }

        const minReq = discount.minimumRequirement;
        if (minReq && minReq.__typename === "DiscountMinimumSubtotal") {
          minSubtotal = parseFloat(minReq.greaterThanOrEqualToSubtotal?.amount || "0");
        }

        const items = discount.customerGets?.items;
        if (items && items.__typename === "DiscountProducts") {
          const productNode = items.products?.nodes?.[0];
          if (productNode) {
            requiredProductId = productNode.id;
            requiredProductTitle = productNode.title;
            requiredProductHandle = productNode.handle;
          }
        }
      }

      // Upsert into Coupon table to keep storefront config
      const existing = await prisma.coupon.findFirst({
        where: { shop: session.shop, code: code }
      });

      if (existing) {
        await prisma.coupon.update({
          where: { id: existing.id },
          data: {
            title,
            discountType,
            discountValue,
            minSubtotal,
            requiredProductId,
            requiredProductTitle,
            requiredProductHandle,
          }
        });
      } else {
        await prisma.coupon.create({
          data: {
            shop: session.shop,
            code,
            title,
            discountType,
            discountValue,
            minSubtotal,
            requiredProductId,
            requiredProductTitle,
            requiredProductHandle,
            showOnStorefront: false,
          }
        });
      }
    }

    // Clean up local coupons that are no longer active in Shopify
    await prisma.coupon.deleteMany({
      where: {
        shop: session.shop,
        code: {
          notIn: activeCodes
        }
      }
    });
  }

  const coupons = await prisma.coupon.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return { coupons, scopesRequired };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "toggle_storefront") {
    const id = formData.get("id");
    const showOnStorefront = formData.get("showOnStorefront") === "true";

    if (!id) {
      return Response.json({ error: "Missing coupon ID" }, { status: 400 });
    }

    try {
      await prisma.coupon.update({
        where: { id },
        data: { showOnStorefront },
      });
      return Response.json({ success: true });
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  return Response.json({ error: "Invalid intent" }, { status: 400 });
};

export default function CouponsPage() {
  const { coupons, scopesRequired } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const handleToggleStorefront = (id, currentVal) => {
    const formData = new FormData();
    formData.append("intent", "toggle_storefront");
    formData.append("id", id);
    formData.append("showOnStorefront", currentVal ? "false" : "true");
    fetcher.submit(formData, { method: "POST" });
  };

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Storefront visibility updated!");
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { error: true });
    }
  }, [fetcher.data, shopify]);

  const resourceName = {
    singular: "discount coupon",
    plural: "discount coupons",
  };

  const rowMarkup = coupons.map((coupon, index) => {
    let discountDisplay = "N/A (Managed by Shopify)";
    if (coupon.discountType === "percentage" && coupon.discountValue > 0) {
      discountDisplay = `${coupon.discountValue}% Off`;
    } else if (coupon.discountType === "fixed_amount" && coupon.discountValue > 0) {
      discountDisplay = `$${coupon.discountValue.toFixed(2)} Off`;
    }

    let eligibilityDisplay = "None";
    if (coupon.minSubtotal > 0 && coupon.requiredProductTitle) {
      eligibilityDisplay = `Subtotal >= $${coupon.minSubtotal.toFixed(2)} & Requires ${coupon.requiredProductTitle}`;
    } else if (coupon.minSubtotal > 0) {
      eligibilityDisplay = `Subtotal >= $${coupon.minSubtotal.toFixed(2)}`;
    } else if (coupon.requiredProductTitle) {
      eligibilityDisplay = `Requires ${coupon.requiredProductTitle}`;
    }

    return (
      <IndexTable.Row id={coupon.id} key={coupon.id} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {coupon.code}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{coupon.title}</IndexTable.Cell>
        <IndexTable.Cell>{discountDisplay}</IndexTable.Cell>
        <IndexTable.Cell>{eligibilityDisplay}</IndexTable.Cell>
        <IndexTable.Cell>
          <Checkbox
            label="Show in Dropdown"
            checked={coupon.showOnStorefront}
            onChange={() => handleToggleStorefront(coupon.id, coupon.showOnStorefront)}
            disabled={fetcher.state === "submitting"}
          />
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Discount Coupons"
      subtitle="Promote existing Shopify discounts directly on your storefront cart drawer and cart page."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {scopesRequired ? (
          <Layout.Section>
            <Banner
              tone="warning"
              title="Discounts Access Authorization Required"
            >
              <BlockStack gap="300">
                <Text as="p">
                  To fetch active coupons from your Shopify Admin, the app requires authorization to read store discounts.
                </Text>
                <div>
                  <Button
                    variant="primary"
                    onClick={() => {
                      window.location.href = "/auth";
                    }}
                  >
                    Grant Permissions
                  </Button>
                </div>
              </BlockStack>
            </Banner>
          </Layout.Section>
        ) : (
          <Layout.Section>
            <div className="premium-fade-in">
              <Card padding="0">
                <Box padding="400" borderBlockEndWidth="100" borderColor="border-subdued">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">
                      Active Shopify Discount Codes
                    </Text>
                    <Badge tone="info">Synced natively from Shopify Discounts</Badge>
                  </InlineStack>
                </Box>

                {coupons.length === 0 ? (
                  <Box padding="800" style={{ textAlign: "center" }}>
                    <BlockStack gap="300" align="center">
                      <Text variant="bodyLg" tone="subdued">
                        No active discount codes found in Shopify Admin.
                      </Text>
                      <Text variant="bodyMd" tone="subdued">
                        Create discount codes in your Shopify Admin under <strong>Discounts</strong>, and they will automatically show up here.
                      </Text>
                    </BlockStack>
                  </Box>
                ) : (
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={coupons.length}
                    headings={[
                      { title: "Code" },
                      { title: "Title" },
                      { title: "Discount" },
                      { title: "Eligibility Rules" },
                      { title: "Promote on Storefront" },
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
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
