export function extractHandleFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const match = pathname.match(/\/products\/([^/?]+)/);

    if (!match || !match[1]) {
      throw new Error("Invalid product URL format");
    }

    return match[1];
  } catch (error) {
    throw new Error(`Failed to extract handle from URL "${url}": ${error.message}`);
  }
}

export function isValidProductUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.includes("/products/");
  } catch {
    return false;
  }
}
