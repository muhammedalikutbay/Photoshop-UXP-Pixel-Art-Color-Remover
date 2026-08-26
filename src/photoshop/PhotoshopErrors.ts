export class PhotoshopOperationError extends Error {
  constructor(
    message: string,
    readonly code:
      | "NO_DOCUMENT"
      | "NO_ACTIVE_LAYER"
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
  return "Photoshop operation failed. Check the developer console for details.";
}
