/** A `Content-Type` header's media type, lower-case and without parameters; "" without one. */
export function mediaTypeOf(contentType: string | null): string {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}
