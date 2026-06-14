import { useState, useRef } from "react";
import { Box, Button, Card, Text, BlockStack, InlineStack } from "@shopify/polaris";

/* eslint-disable react/prop-types */
export function CSVUploadSection({
  onFileChange,
  loading,
  columnsText = "product_url or product_handle, meta_title, meta_description",
  sampleFilename = "sample-seo.csv",
  sampleCsv = `product_handle,meta_title,meta_description
14k-dangling-obsidian-earrings,Best Obsidian Earrings,Shop premium handcrafted obsidian earrings.
14k-bloom-earrings,14K Bloom Earrings,Beautiful handcrafted bloom earrings.`,
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith(".csv")) {
        onFileChange(file);
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onButtonClick();
    }
  };

  const downloadSample = (e) => {
    e.stopPropagation(); // Avoid triggering file chooser when clicking sample download
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = sampleFilename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <BlockStack gap="400">
        <div
          className={`custom-dropzone ${dragActive ? "active" : ""}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="button"
          aria-label="Upload CSV File"
        >
          {/* Cloud Upload Icon */}
          <div style={{ pointerEvents: "none" }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transition: "transform 0.3s ease",
                transform: dragActive ? "scale(1.15) translateY(-4px)" : "none",
              }}
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>

          <BlockStack gap="100" style={{ pointerEvents: "none" }}>
            <Text as="p" variant="headingMd" fontWeight="semibold">
              {dragActive ? "Drop your CSV here!" : "Drag & drop your CSV file here"}
            </Text>
            <Text as="p" tone="subdued" variant="bodyMd">
              or click to browse from your computer
            </Text>
          </BlockStack>

          <input
            ref={inputRef}
            id="seo-csv-upload"
            type="file"
            accept=".csv"
            onChange={handleChange}
            disabled={loading}
            style={{ display: "none" }}
          />

          <Box paddingBlockStart="200" style={{ pointerEvents: "none" }}>
            <Text variant="bodySm" tone="subdued">
              Required headers: <span style={{ fontFamily: "monospace", color: "#4f46e5", fontWeight: "bold" }}>{columnsText}</span>
            </Text>
          </Box>
        </div>

        <Card>
          <Box padding="300">
            <InlineStack align="space-between" blockAlign="center" gap="400">
              <InlineStack gap="200" blockAlign="center">
                <span style={{ fontSize: "20px" }}>💡</span>
                <Text as="span" tone="subdued" variant="bodyMd">
                  Need a template? Download the sample file to get started.
                </Text>
              </InlineStack>
              <Button onClick={downloadSample} variant="secondary" disabled={loading}>
                Download {sampleFilename}
              </Button>
            </InlineStack>
          </Box>
        </Card>
      </BlockStack>
    </Box>
  );
}
