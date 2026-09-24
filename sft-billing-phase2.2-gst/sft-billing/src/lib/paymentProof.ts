export const PAYMENT_PROOF_ACCEPT = ".png,.jpg,.jpeg,.pdf";

const PAYMENT_PROOF_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".pdf"]);
const PAYMENT_PROOF_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "application/pdf"]);

export const PAYMENT_PROOF_INVALID_MESSAGE = "Payment proof must be a PNG, JPG, JPEG, or PDF file.";

/**
 * Proof type validation is shared by the upload UI and the mock provider so
 * the provider contract cannot silently accept a file the UI would reject.
 * Browsers may report an empty type for a valid local file, so the extension
 * remains the required discriminator and an empty/octet-stream MIME is
 * tolerated only as that browser fallback.
 */
export function isSupportedPaymentProof(fileName: string, mimeType: string): boolean {
  const normalizedName = fileName.trim().toLowerCase();
  const extension = normalizedName.slice(normalizedName.lastIndexOf("."));
  const normalizedMime = mimeType.trim().toLowerCase();

  if (!PAYMENT_PROOF_EXTENSIONS.has(extension)) return false;
  return !normalizedMime || normalizedMime === "application/octet-stream" || PAYMENT_PROOF_MIME_TYPES.has(normalizedMime);
}
