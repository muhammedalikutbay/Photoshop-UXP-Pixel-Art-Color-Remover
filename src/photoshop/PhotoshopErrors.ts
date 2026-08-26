export class PhotoshopOperationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_DOCUMENT"
      | "NO_ACTIVE_LAYER"
      | "NO_VISIBLE_PIXEL_LAYERS"
      | "UNSUPPORTED_DOCUMENT"
      | "UNSUPPORTED_LAYER"
      | "LOCKED_LAYER"
      | "EMPTY_COLORS"
      | "INVALID_TOLERANCE"
      | "EMPTY_SELECTION"
      | "CANCELLED"
  ) {
    super(message);
    this.name = "PhotoshopOperationError";
  }
}

export function userMessage(error: unknown): string {
  if (error instanceof PhotoshopOperationError) return error.message;
  const possibleMessage = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : undefined;
  if (possibleMessage) {
    const detail = possibleMessage.replace(/\s+/g, " ").trim().slice(0, 180);
    return `Photoshop operation failed: ${detail}`;
  }
  return "Photoshop operation failed. Check the developer console for details.";
}
