import { IndexTable, Box, Text, BlockStack, Link } from "@shopify/polaris";

const defaultColumns = [
  {
    key: "product_handle",
    label: "Product Identifier",
    render: (row) => {
      if (row.product_url) {
        const handle = row.product_url.split("/products/")[1] || row.product_url;
        return (
          <Link url={row.product_url} target="_blank" removeUnderline>
            🔗 {handle.length > 30 ? `${handle.substring(0, 30)}...` : handle}
          </Link>
        );
      }
      return row.product_handle || row.handle || "-";
    },
  },
  { key: "meta_title", label: "Meta Title" },
  { key: "meta_description", label: "Meta Description" },
];

/* eslint-disable react/prop-types */
export function DataPreviewTable({ rows, columns = defaultColumns }) {
  if (rows.length === 0) {
    return null;
  }

  const headings = columns.map((col) => ({ title: col.label }));

  const rowMarkup = rows.slice(0, 10).map((row, idx) => (
    <IndexTable.Row id={String(idx)} key={idx} position={idx}>
      {columns.map((col) => {
        let content = col.render ? col.render(row) : row[col.key];

        // Format HTML descriptions slightly or strip tags for preview
        if (col.key === "description" && typeof content === "string") {
          // simple strip html for preview readability
          const stripped = content.replace(/<[^>]*>/g, "");
          content = stripped;
        }

        if (typeof content === "string") {
          const maxW = col.key === "meta_description" || col.key === "description" ? "320px" : "180px";
          content = (
            <div
              style={{
                maxWidth: maxW,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={content}
            >
              {content}
            </div>
          );
        }

        return (
          <IndexTable.Cell key={col.key}>
            {content}
          </IndexTable.Cell>
        );
      })}
    </IndexTable.Row>
  ));

  return (
    <Box>
      <BlockStack gap="300">
        <IndexTable
          resourceName={{ singular: "row", plural: "rows" }}
          itemCount={Math.min(10, rows.length)}
          headings={headings}
          selectable={false}
        >
          {rowMarkup}
        </IndexTable>
        {rows.length > 10 && (
          <Box paddingInline="300">
            <Text as="p" variant="bodySm" tone="subdued">
              Showing top 10 of {rows.length} rows. Scroll table horizontally if column content is hidden.
            </Text>
          </Box>
        )}
      </BlockStack>
    </Box>
  );
}
