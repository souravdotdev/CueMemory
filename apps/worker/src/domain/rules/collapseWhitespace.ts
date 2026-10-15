/** The text with each run of whitespace turned into one space, and trimmed. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
