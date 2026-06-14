export function validateSEOTitle(title) {
  const maxLength = 70;
  const trimmed = (title || "").trim();

  return {
    isValid: trimmed.length > 0 && trimmed.length <= maxLength,
    length: trimmed.length,
    maxLength,
    message:
      trimmed.length === 0
        ? "Title is required"
        : trimmed.length > maxLength
          ? `Title exceeds ${maxLength} characters (current: ${trimmed.length})`
          : null,
  };
}

export function validateSEODescription(description) {
  const maxLength = 155;
  const trimmed = (description || "").trim();

  return {
    isValid: trimmed.length > 0 && trimmed.length <= maxLength,
    length: trimmed.length,
    maxLength,
    message:
      trimmed.length === 0
        ? "Description is required"
        : trimmed.length > maxLength
          ? `Description exceeds ${maxLength} characters (current: ${trimmed.length})`
          : null,
  };
}

export function validateURL(url) {
  try {
    new URL(url);
    return { isValid: true };
  } catch {
    return { isValid: false, message: "Invalid URL format" };
  }
}
