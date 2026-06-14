import { Box, Text, BlockStack, ProgressBar, Spinner, InlineStack } from "@shopify/polaris";

/* eslint-disable react/prop-types */
export function ProgressIndicator({ total, loading, currentAction = "bulk updating products" }) {
  if (!loading || total === 0) {
    return null;
  }

  return (
    <Box
      padding="600"
      background="surface"
      style={{
        borderRadius: "18px",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.04)",
        border: "1px solid #f1f1f1",
      }}
    >
      <BlockStack gap="400" align="center">
        <InlineStack gap="300" blockAlign="center" align="center">
          <Spinner size="small" />
          <Text as="h3" variant="headingMd" fontWeight="semibold">
            Processing Bulk Updates...
          </Text>
        </InlineStack>

        <BlockStack gap="200">
          <ProgressBar progress={100} animated size="medium" />
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <Text tone="subdued" variant="bodySm">
              Shopify API is processing {total} records ({currentAction}).
            </Text>
            <Text tone="subdued" variant="bodySm" fontWeight="bold">
              Please do not close this window
            </Text>
          </div>
        </BlockStack>
      </BlockStack>
    </Box>
  );
}
