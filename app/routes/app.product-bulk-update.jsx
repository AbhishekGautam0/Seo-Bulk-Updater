import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Box,
  BlockStack,
  InlineStack,
  Button,
  Text,
  Card,
  Banner,
  Divider,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { CSVUploadSection } from "../components/CSVUploadSection";
import { DataPreviewTable } from "../components/DataPreviewTable";
import { ProgressIndicator } from "../components/ProgressIndicator";
import { ResultsTable } from "../components/ResultsTable";

const productColumns = [
  {
    key: "product_handle",
    label: "Product Identifier",
    render: (row) => {
      if (row.product_url) {
        return (
          <span style={{ color: "#0066cc" }}>
            🔗 {row.product_url.split("/products/")[1] || row.product_url}
          </span>
        );
      }
      return row.product_handle || "-";
    },
  },
  { key: "title", label: "New Title" },
  { key: "description", label: "New HTML Description" },
];

const sampleProductCsv = `product_handle,title,description
14k-dangling-obsidian-earrings,14K Dangling Obsidian Earrings,<p>Handcrafted obsidian earrings with a polished 14K finish.</p>
14k-bloom-earrings,14K Bloom Earrings,<p>Elegant bloom earrings designed for everyday wear.</p>`;

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function ProductBulkUpdatePage() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [csvRows, setCsvRows] = useState([]);
  const [csvFilename, setCsvFilename] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const isLoading = fetcher.state === "submitting";

  // Calculate validation stats for review (Step 2)
  const validationStats = csvRows.reduce(
    (acc, curr) => {
      const title = curr.title || "";
      const desc = curr.description || "";

      if (title.length > 255) acc.longTitles += 1;
      if (!desc) acc.emptyDescs += 1;
      return acc;
    },
    { longTitles: 0, emptyDescs: 0 }
  );

  const totalWarnings = validationStats.longTitles + validationStats.emptyDescs;

  const handleFileChange = async (file) => {
    try {
      const formData = new FormData();
      formData.append("csvFile", file, file.name);

      const response = await fetch("/api/parse-product-csv", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        shopify.toast.show(`CSV Error: ${data.error}`, { error: true });
        return;
      }

      setCsvRows(data.rows);
      setCsvFilename(file.name);
      setCurrentStep(2);
      shopify.toast.show(`✓ Parsed ${data.rows.length} rows successfully`);
    } catch (error) {
      shopify.toast.show(`Failed to read file: ${error.message}`, { error: true });
    }
  };

  const toCSV = (rows, columns) => {
    const escapeValue = (value) => {
      const stringValue = String(value ?? "");
      return `"${stringValue.replace(/"/g, '""')}"`;
    };

    return [
      columns.join(","),
      ...rows.map((row) =>
        columns.map((column) => escapeValue(row[column])).join(",")
      ),
    ].join("\n");
  };

  const handleProcessUpdate = () => {
    if (csvRows.length === 0) {
      shopify.toast.show("Please select a CSV file first", { error: true });
      return;
    }

    const csv = toCSV(csvRows, ["product_handle", "product_url", "title", "description"]);
    const formData = new FormData();
    const blob = new Blob([csv], { type: "text/csv" });
    formData.append("csvFile", blob, csvFilename || `bulk-product-update.csv`);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/update-products",
      encType: "multipart/form-data",
    });

    setCurrentStep(3);
  };

  const handleReset = () => {
    setCsvRows([]);
    setCsvFilename("");
    setCurrentStep(1);
  };

  useEffect(() => {
    if (fetcher.data?.importId) {
      shopify.toast.show(
        `Product updates completed! ${fetcher.data.successful} success, ${fetcher.data.failed} failed`
      );
      setCurrentStep(4);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { error: true });
      setCurrentStep(2); // Go back to review on failure
    }
  }, [fetcher.data, shopify]);

  return (
    <Page
      title="Product Content Bulk Update"
      subtitle="Modify product titles and HTML descriptions in bulk via spreadsheet"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {/* Step Header Indicator */}
        <Layout.Section>
          <Card>
            <Box padding="400">
              <BlockStack gap="300">
                <div className="wizard-progress-bar-container">
                  <div
                    className="wizard-progress-bar-fill"
                    style={{
                      width: `${(currentStep / 4) * 100}%`,
                    }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text variant="bodySm" fontWeight={currentStep === 1 ? "bold" : "regular"} tone={currentStep === 1 ? "base" : "subdued"}>
                    Step 1: Upload CSV
                  </Text>
                  <Text variant="bodySm" fontWeight={currentStep === 2 ? "bold" : "regular"} tone={currentStep === 2 ? "base" : "subdued"}>
                    Step 2: Preview & Verify
                  </Text>
                  <Text variant="bodySm" fontWeight={currentStep === 3 ? "bold" : "regular"} tone={currentStep === 3 ? "base" : "subdued"}>
                    Step 3: Run Updates
                  </Text>
                  <Text variant="bodySm" fontWeight={currentStep === 4 ? "bold" : "regular"} tone={currentStep === 4 ? "base" : "subdued"}>
                    Step 4: Audit & Export
                  </Text>
                </div>
              </BlockStack>
            </Box>
          </Card>
        </Layout.Section>

        {/* Step 1: Upload Dropzone */}
        {currentStep === 1 && (
          <Layout.Section>
            <div className="premium-fade-in">
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Upload Product Content File</Text>
                    <Text tone="subdued">
                      Prepare a CSV containing product handles/URLs alongside the new standard title and HTML description fields.
                    </Text>
                    <CSVUploadSection
                      onFileChange={handleFileChange}
                      loading={isLoading}
                      columnsText="product_handle, title, description"
                      sampleFilename="sample-product-update.csv"
                      sampleCsv={sampleProductCsv}
                    />
                  </BlockStack>
                </Box>
              </Card>
            </div>
          </Layout.Section>
        )}

        {/* Step 2: Preview & Validation Checklist */}
        {currentStep === 2 && csvRows.length > 0 && (
          <>
            <Layout.Section>
              <div className="premium-fade-in">
                <Card>
                  <Box padding="500">
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="headingMd" as="h2">Verify Upload Details</Text>
                          <Text tone="subdued">File: {csvFilename}</Text>
                        </BlockStack>
                        <Badge tone="info">{csvRows.length} Products Found</Badge>
                      </InlineStack>

                      {totalWarnings > 0 ? (
                        <Banner
                          title="Data Format Warnings Found"
                          tone="warning"
                        >
                          <BlockStack gap="100">
                            <Text as="p">
                              We detected format warnings. These records will still be uploaded, but check if this is intentional:
                            </Text>
                            <ul style={{ paddingLeft: "20px" }}>
                              {validationStats.longTitles > 0 && (
                                <li><strong>{validationStats.longTitles}</strong> titles exceed 255 characters (this is Shopify&apos;s title length limit).</li>
                              )}
                              {validationStats.emptyDescs > 0 && (
                                <li><strong>{validationStats.emptyDescs}</strong> rows have empty descriptions (this will clear the product description).</li>
                              )}
                            </ul>
                          </BlockStack>
                        </Banner>
                      ) : (
                        <Banner
                          title="CSV Formatted Perfectly!"
                          tone="success"
                        >
                          <Text as="p">
                            All products are formatted correctly. No length limits exceeded. Ready to push updates!
                          </Text>
                        </Banner>
                      )}

                      <Divider />

                      <Text variant="headingSm">Spreadsheet Preview (Top 10 rows)</Text>
                      <DataPreviewTable rows={csvRows} columns={productColumns} />

                      <Divider />

                      <InlineStack gap="300" align="trailing">
                        <Button onClick={handleReset} variant="secondary">
                          Clear File
                        </Button>
                        <Button onClick={handleProcessUpdate} primary>
                          🚀 Push {csvRows.length} Updates to Shopify
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                </Card>
              </div>
            </Layout.Section>
          </>
        )}

        {/* Step 3: Processing loading bar */}
        {currentStep === 3 && (
          <Layout.Section>
            <div className="premium-fade-in">
              <ProgressIndicator total={csvRows.length} loading={isLoading} currentAction="product content bulk update" />
            </div>
          </Layout.Section>
        )}

        {/* Step 4: Results & Summary */}
        {currentStep === 4 && fetcher.data?.results && (
          <Layout.Section>
            <div className="premium-fade-in">
              <Card>
                <Box padding="500">
                  <BlockStack gap="400">
                    <Banner tone="success" title="Bulk Content Processing Completed">
                      <Text as="p">
                        All batch operations finished execution. Check the audit breakdown below or export a CSV log.
                      </Text>
                    </Banner>

                    <ResultsTable results={fetcher.data.results} />

                    <Divider />

                    <InlineStack align="center">
                      <Button onClick={handleReset} size="large" primary>
                        Upload Another File
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Box>
              </Card>
            </div>
          </Layout.Section>
        )}

        {/* Error Boundary Display */}
        {fetcher.data?.error && (
          <Layout.Section>
            <Banner tone="critical" title="Process Execution Failed">
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
