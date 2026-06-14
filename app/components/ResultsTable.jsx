import { Box, Button, Text, BlockStack, InlineStack, Badge, IndexTable } from "@shopify/polaris";

/* eslint-disable react/prop-types */
export function ResultsTable({ results }) {
  if (results.length === 0) {
    return null;
  }

  const successful = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "failed");

  const downloadResults = () => {
    const columns = [
      "product_url",
      "handle",
      "status",
      "reason",
      "meta_title",
      "meta_description",
    ];
    const escapeValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      columns.join(","),
      ...results.map((result) =>
        [
          result.product_url,
          result.handle,
          result.status,
          result.reason,
          result.metaTitle || result.title,
          result.metaDescription || result.description,
        ]
          .map(escapeValue)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seo-update-report-${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resourceName = {
    singular: "result",
    plural: "results",
  };

  const rowMarkup = results.map((result, idx) => {
    const isSuccess = result.status === "success";
    return (
      <IndexTable.Row id={String(idx)} key={idx} position={idx}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="semibold" as="span">
            {result.handle || "-"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={isSuccess ? "success" : "critical"}>
            {isSuccess ? "Success" : "Failed"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div
            style={{
              color: isSuccess ? "#4b5563" : "#ef4444",
              fontWeight: isSuccess ? "400" : "500",
              maxWidth: "480px",
              wordBreak: "break-word",
            }}
          >
            {isSuccess ? "Record updated successfully" : result.reason || "Unknown API error"}
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Box>
      <BlockStack gap="500">
        {/* Results Summary Dashboard */}
        <InlineStack gap="400" align="space-between">
          <div className="results-stat-card success" style={{ flex: 1 }}>
            <Text as="p" variant="headingLg" fontWeight="bold">
              {successful.length}
            </Text>
            <Text as="p" variant="bodyMd">
              Successful Updates
            </Text>
          </div>

          <div className="results-stat-card failed" style={{ flex: 1 }}>
            <Text as="p" variant="headingLg" fontWeight="bold">
              {failed.length}
            </Text>
            <Text as="p" variant="bodyMd">
              Failed Updates
            </Text>
          </div>

          <div className="results-stat-card total" style={{ flex: 1 }}>
            <Text as="p" variant="headingLg" fontWeight="bold">
              {results.length}
            </Text>
            <Text as="p" variant="bodyMd">
              Total Processed
            </Text>
          </div>
        </InlineStack>

        {/* Action and Log Header */}
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingMd" fontWeight="semibold">
            Individual Audit Log
          </Text>
          <Button onClick={downloadResults} primary>
            📥 Export Full CSV Report
          </Button>
        </InlineStack>

        {/* Results Audit Table */}
        <IndexTable
          resourceName={resourceName}
          itemCount={results.length}
          headings={[
            { title: "Product Handle" },
            { title: "Status" },
            { title: "Details" },
          ]}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>
      </BlockStack>
    </Box>
  );
}
