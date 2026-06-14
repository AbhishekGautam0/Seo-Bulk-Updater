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

function toCSV(rows, columns) {
  const escapeValue = (value) => {
    const stringValue = String(value ?? "");
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeValue(row[column])).join(",")),
  ].join("\n");
}

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function SEOBulkUpdater() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [csvRows, setCsvRows] = useState([]);
  const [csvFilename, setCsvFilename] = useState("");
  const [currentStep, setCurrentStep] = useState(1);

  const isLoading = fetcher.state === "submitting";

  // Calculate validation stats for review (Step 2)
  const validationStats = csvRows.reduce(
    (acc, curr) => {
      const title = curr.meta_title || "";
      const desc = curr.meta_description || "";
      const url = curr.product_url || "";

      if (title.length > 70) acc.longTitles += 1;
      if (desc.length > 155) acc.longDescs += 1;
      if (url && (!url.includes("/products/") || !url.startsWith("http"))) {
        acc.invalidUrls += 1;
      }
      return acc;
    },
    { longTitles: 0, longDescs: 0, invalidUrls: 0 }
  );

  const totalWarnings =
    validationStats.longTitles + validationStats.longDescs + validationStats.invalidUrls;

  const handleFileChange = async (file) => {
    try {
      const fileContent = await file.text();

      const formData = new FormData();
      const blob = new Blob([fileContent], { type: "text/csv" });
      formData.append("csvFile", blob, file.name);
      formData.append("parseOnly", "true");

      const response = await fetch("/api/parse-csv", {
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
      shopify.toast.show(`✓ Parsed ${data.rows.length} rows successfully`, {
        isError: false,
      });
    } catch (error) {
      shopify.toast.show(`Failed to read file: ${error.message}`, { error: true });
    }
  };

  const handleSubmit = () => {
    if (csvRows.length === 0) {
      shopify.toast.show("Please select a CSV file first", { error: true });
      return;
    }

    const csv = toCSV(csvRows, [
      "product_url",
      "product_handle",
      "meta_title",
      "meta_description",
    ]);

    const formData = new FormData();
    const blob = new Blob([csv], { type: "text/csv" });
    formData.append("csvFile", blob, csvFilename || `bulk-seo-update.csv`);

    fetcher.submit(formData, {
      method: "POST",
      action: "/api/update-seo",
      encType: "multipart/form-data",
    });

    setCurrentStep(3);
  };

  const handleReset = () => {
    setCsvRows([]);
    setCsvFilename("");
    setCurrentStep(1);
    // Note: Remix fetcher data is cleared once a new submission starts or we redirect
  };

  useEffect(() => {
    if (fetcher.data?.importId) {
      shopify.toast.show(
        `SEO update complete! ${fetcher.data.successful} success, ${fetcher.data.failed} failed`
      );
      setCurrentStep(4);
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { error: true });
      setCurrentStep(2); // Go back to review on failure
    }
  }, [fetcher.data, shopify]);

  return (
    <Page
      title="SEO Bulk Update"
      subtitle="Optimize search engine listings (Meta Titles & Descriptions) in bulk"
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
                    <Text variant="headingMd" as="h2">Upload SEO Metadata File</Text>
                    <Text tone="subdued">
                      Prepare a CSV file detailing product URLs or handles alongside meta title and description updates.
                    </Text>
                    <CSVUploadSection onFileChange={handleFileChange} loading={isLoading} />
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
                          title="Optimization Warnings Found"
                          tone="warning"
                        >
                          <BlockStack gap="100">
                            <Text as="p">
                              We detected format warnings. These records will still be uploaded, but search engines may truncate them:
                            </Text>
                            <ul style={{ paddingLeft: "20px" }}>
                              {validationStats.longTitles > 0 && (
                                <li><strong>{validationStats.longTitles}</strong> titles exceed the optimal 70-character limit.</li>
                              )}
                              {validationStats.longDescs > 0 && (
                                <li><strong>{validationStats.longDescs}</strong> descriptions exceed the optimal 155-character limit.</li>
                              )}
                              {validationStats.invalidUrls > 0 && (
                                <li><strong>{validationStats.invalidUrls}</strong> product URLs appear incorrectly formatted (will try handles).</li>
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
                            All products are formatted correctly. No length warnings or URL syntax errors detected. Ready to push updates!
                          </Text>
                        </Banner>
                      )}

                      <Divider />

                      <Text variant="headingSm">Spreadsheet Preview (Top 10 rows)</Text>
                      <DataPreviewTable rows={csvRows} />

                      <Divider />

                      <InlineStack gap="300" align="trailing">
                        <Button onClick={handleReset} variant="secondary">
                          Clear File
                        </Button>
                        <Button onClick={handleSubmit} primary>
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
              <ProgressIndicator total={csvRows.length} loading={isLoading} currentAction="SEO bulk update" />
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
                    <Banner tone="success" title="Bulk SEO Processing Completed">
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
