import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Card,
  Button,
  Text,
  Box,
  BlockStack,
  IndexTable,
  Badge,
  Grid,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const recentImports = await prisma.sEOImportHistory.findMany({
    where: { shop: session.shop },
    orderBy: { uploadedAt: "desc" },
    take: 5,
  });

  // Calculate high-level stats
  const allImports = await prisma.sEOImportHistory.findMany({
    where: { shop: session.shop },
  });

  const stats = allImports.reduce(
    (acc, curr) => {
      acc.totalFiles += 1;
      acc.totalProducts += curr.totalCount;
      acc.totalSuccess += curr.successCount;
      acc.totalFailed += curr.failureCount;
      return acc;
    },
    { totalFiles: 0, totalProducts: 0, totalSuccess: 0, totalFailed: 0 }
  );

  return { recentImports, stats };
};

export default function Index() {
  const { recentImports, stats } = useLoaderData();
  const navigate = useNavigate();

  const successRate =
    stats.totalProducts > 0
      ? Math.round((stats.totalSuccess / stats.totalProducts) * 100)
      : 100;

  const resourceName = {
    singular: "recent import",
    plural: "recent imports",
  };

  const rowMarkup = recentImports.map(
    ({ id, filename, uploadedAt, totalCount, successCount, failureCount }, index) => {
      const dateStr = new Date(uploadedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      let statusBadge = <Badge tone="success">Success</Badge>;
      if (failureCount > 0) {
        statusBadge =
          successCount > 0 ? (
            <Badge tone="warning">Partial</Badge>
          ) : (
            <Badge tone="critical">Failed</Badge>
          );
      }

      const rate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;

      return (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Text variant="bodyMd" fontWeight="semibold" as="span">
              📄 {filename}
            </Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <span suppressHydrationWarning>{dateStr}</span>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text alignment="right" as="span">{totalCount}</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <div style={{ color: "#10b981", fontWeight: "600", textAlign: "right" }}>
              {successCount}
            </div>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <div
              style={{
                color: failureCount > 0 ? "#ef4444" : "#6b7280",
                fontWeight: failureCount > 0 ? "600" : "400",
                textAlign: "right",
              }}
            >
              {failureCount}
            </div>
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Text alignment="right" as="span">{rate}%</Text>
          </IndexTable.Cell>
          <IndexTable.Cell>{statusBadge}</IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page title="Dashboard">
      <Layout>
        {/* Banner Card */}
        <Layout.Section>
          <div className="premium-fade-in">
            <Card>
              <Box padding="600">
                <BlockStack gap="400">
                  <Grid>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8 }}>
                      <BlockStack gap="200">
                        <Text as="h1" variant="headingXl">
                          Bulk SEO & Product Content Updater
                        </Text>
                        <Text as="p" variant="bodyLg" tone="subdued">
                          Welcome to your central store optimization dashboard. Speed up catalog updates, improve organic rankings, and fix listing search metadata in bulk.
                        </Text>
                      </BlockStack>
                    </Grid.Cell>
                    <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          height: "100%",
                          fontSize: "64px",
                          userSelect: "none",
                        }}
                      >
                        ⚡
                      </div>
                    </Grid.Cell>
                  </Grid>
                </BlockStack>
              </Box>
            </Card>
          </div>
        </Layout.Section>

        {/* High-Level Statistics Grid */}
        <Layout.Section>
          <div className="premium-fade-in" style={{ animationDelay: "0.1s" }}>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                <Card>
                  <Box padding="400">
                    <BlockStack gap="100">
                      <Text variant="headingSm" tone="subdued">Total Imports Run</Text>
                      <Text variant="headingXl" as="h2">{stats.totalFiles}</Text>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                <Card>
                  <Box padding="400">
                    <BlockStack gap="100">
                      <Text variant="headingSm" tone="subdued">Products Processed</Text>
                      <Text variant="headingXl" as="h2">{stats.totalProducts}</Text>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                <Card>
                  <Box padding="400">
                    <BlockStack gap="100">
                      <Text variant="headingSm" tone="subdued">Successful Updates</Text>
                      <Text variant="headingXl" as="h2" tone="success">{stats.totalSuccess}</Text>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3 }}>
                <Card>
                  <Box padding="400">
                    <BlockStack gap="100">
                      <Text variant="headingSm" tone="subdued">Overall Success Rate</Text>
                      <Text variant="headingXl" as="h2" tone={successRate > 90 ? "success" : "warning"}>
                        {successRate}%
                      </Text>
                    </BlockStack>
                  </Box>
                </Card>
              </Grid.Cell>
            </Grid>
          </div>
        </Layout.Section>

        {/* Feature Cards Grid */}
        <Layout.Section>
          <div className="premium-fade-in" style={{ animationDelay: "0.2s" }}>
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6 }}>
                <div
                  className="premium-dashboard-card"
                  onClick={() => navigate("/app/seo-bulk-updater")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate("/app/seo-bulk-updater");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Start SEO Metadata Update"
                  style={{ height: "100%" }}
                >
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <div style={{ fontSize: "40px" }}>🔍</div>
                        <BlockStack gap="200">
                          <Text as="h2" variant="headingLg">
                            SEO Metadata Updater
                          </Text>
                          <Text as="p" tone="subdued">
                            Bulk update product Google listing tags including Meta Titles and Meta Descriptions. Maximize search visibility and click-through rates.
                          </Text>
                        </BlockStack>
                        <div>
                          <Button primary size="large">
                            Start SEO Update
                          </Button>
                        </div>
                      </BlockStack>
                    </Box>
                  </Card>
                </div>
              </Grid.Cell>

              <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 6, lg: 6 }}>
                <div
                  className="premium-dashboard-card"
                  onClick={() => navigate("/app/product-bulk-update")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate("/app/product-bulk-update");
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Start Product Details Update"
                  style={{ height: "100%" }}
                >
                  <Card>
                    <Box padding="500">
                      <BlockStack gap="400">
                        <div style={{ fontSize: "40px" }}>📝</div>
                        <BlockStack gap="200">
                          <Text as="h2" variant="headingLg">
                            Product Details Updater
                          </Text>
                          <Text as="p" tone="subdued">
                            Bulk change standard product information like titles and HTML descriptions using a CSV spreadsheet. Perfect for seasonal campaigns.
                          </Text>
                        </BlockStack>
                        <div>
                          <Button primary size="large">
                            Start Product Update
                          </Button>
                        </div>
                      </BlockStack>
                    </Box>
                  </Card>
                </div>
              </Grid.Cell>
            </Grid>
          </div>
        </Layout.Section>

        {/* Recent Imports History */}
        <Layout.Section>
          <div className="premium-fade-in" style={{ animationDelay: "0.3s" }}>
            <Card padding="0">
              <Box padding="400" borderBlockEndWidth="100" borderColor="border-subdued">
                <Text as="h2" variant="headingMd">
                  Recent Imports History
                </Text>
              </Box>

              {recentImports.length === 0 ? (
                <Box padding="800" style={{ textAlign: "center" }}>
                  <BlockStack gap="200">
                    <Text variant="bodyLg" tone="subdued">
                      No imports have been run yet.
                    </Text>
                    <div>
                      <Button onClick={() => navigate("/app/seo-bulk-updater")}>
                        Upload Your First CSV
                      </Button>
                    </div>
                  </BlockStack>
                </Box>
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={recentImports.length}
                  headings={[
                    { title: "File Name" },
                    { title: "Date & Time" },
                    { title: "Products", alignment: "right" },
                    { title: "Success", alignment: "right" },
                    { title: "Failed", alignment: "right" },
                    { title: "Success Rate", alignment: "right" },
                    { title: "Status" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </div>
        </Layout.Section>

        {/* CSV Documentation Info Box */}
        <Layout.Section secondary>
          <div className="premium-fade-in" style={{ animationDelay: "0.4s" }}>
            <Card>
              <Box padding="500">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    CSV Format Instructions
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    To ensure smooth bulk processing, your CSV headers must match one of the following configurations exactly:
                  </Text>

                  <BlockStack gap="200">
                    <Text variant="headingSm">For SEO Meta Updates:</Text>
                    <div className="copy-code-box">
                      product_url, meta_title, meta_description
                      <br />
                      OR
                      <br />
                      product_handle, meta_title, meta_description
                    </div>
                  </BlockStack>

                  <BlockStack gap="200">
                    <Text variant="headingSm">For Product Info Updates:</Text>
                    <div className="copy-code-box">
                      product_handle, title, description
                      <br />
                      OR
                      <br />
                      product_url, title, description
                    </div>
                  </BlockStack>
                </BlockStack>
              </Box>
            </Card>
          </div>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
