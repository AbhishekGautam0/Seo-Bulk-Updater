import Papa from "papaparse";

export function parseSEOCSV(fileContent) {
  const result = {
    isValid: false,
    rows: [],
    errors: [],
  };

  try {
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0) {
      result.errors = parsed.errors.map((e) => e.message);
      return result;
    }

    const headers = Object.keys(parsed.data[0] || {});
    const hasIdentifier =
      headers.includes("product_url") ||
      headers.includes("product_handle") ||
      headers.includes("handle");
    const missingColumns = [];

    if (!hasIdentifier) {
      missingColumns.push("product_url or handle");
    }
    if (!headers.includes("meta_title")) {
      missingColumns.push("meta_title");
    }
    if (!headers.includes("meta_description")) {
      missingColumns.push("meta_description");
    }

    if (missingColumns.length > 0) {
      result.errors = [
        `Missing required columns: ${missingColumns.join(", ")}. Expected: product_url or handle, meta_title, meta_description`,
      ];
      return result;
    }

    result.rows = parsed.data.filter((row, index) => {
      const normalizedRow = normalizeSEORow(row);
      const error = validateCSVRow(normalizedRow);
      if (error) {
        result.errors.push(`Row ${index + 1}: ${error}`);
        return false;
      }
      Object.assign(row, normalizedRow);
      return true;
    });

    result.isValid = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors = [`CSV parsing failed: ${error.message}`];
    return result;
  }
}

function normalizeSEORow(row) {
  return {
    product_url: (row.product_url || "").trim(),
    product_handle: (row.product_handle || row.handle || "").trim(),
    meta_title: (row.meta_title || "").trim(),
    meta_description: (row.meta_description || "").trim(),
  };
}

export function validateCSVRow(row) {
  if (!row.product_url && !row.product_handle) {
    return "product_url or handle is required";
  }
  if (!row.meta_title) {
    return "meta_title is required";
  }
  if (!row.meta_description) {
    return "meta_description is required";
  }
  return null;
}

export function parseProductUpdateCSV(fileContent) {
  const result = {
    isValid: false,
    rows: [],
    errors: [],
  };

  try {
    const parsed = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
    });

    if (parsed.errors.length > 0) {
      result.errors = parsed.errors.map((e) => e.message);
      return result;
    }

    const headers = Object.keys(parsed.data[0] || {});
    const hasIdentifier =
      headers.includes("product_handle") ||
      headers.includes("handle") ||
      headers.includes("product_url");
    const missingColumns = [];

    if (!hasIdentifier) {
      missingColumns.push("product_handle or product_url");
    }
    if (!headers.includes("title")) {
      missingColumns.push("title");
    }
    if (!headers.includes("description")) {
      missingColumns.push("description");
    }

    if (missingColumns.length > 0) {
      result.errors = [
        `Missing required columns: ${missingColumns.join(", ")}. Expected: product_handle,title,description`,
      ];
      return result;
    }

    result.rows = parsed.data.filter((row, index) => {
      const normalizedRow = {
        product_handle: (row.product_handle || row.handle || "").trim(),
        product_url: (row.product_url || "").trim(),
        title: (row.title || "").trim(),
        description: (row.description || "").trim(),
      };

      const error = validateProductUpdateCSVRow(normalizedRow);
      if (error) {
        result.errors.push(`Row ${index + 1}: ${error}`);
        return false;
      }

      Object.assign(row, normalizedRow);
      return true;
    });

    result.isValid = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors = [`CSV parsing failed: ${error.message}`];
    return result;
  }
}

export function validateProductUpdateCSVRow(row) {
  if (!row.product_handle && !row.product_url) {
    return "product_handle or product_url is required";
  }
  if (!row.title) {
    return "title is required";
  }
  if (!row.description) {
    return "description is required";
  }
  return null;
}
