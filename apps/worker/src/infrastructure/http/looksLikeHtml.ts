/** How much of a body without a Content-Type is read before deciding whether it is HTML. */
export const SNIFF_BYTES = 512;

const UTF8_BOM = String.fromCharCode(0xfeff);
// An HTML document's opening, after any BOM and whitespace: a doctype, or an
// <html> or <head> tag (not <header>).
const HTML_START = /^(<!doctype\s+html|<html|<head)([\s>]|$)/i;

/**
 * Whether a body sent without a Content-Type starts like an HTML document:
 * `<!doctype html`, `<html` or `<head`, case-insensitive, after an optional
 * UTF-8 BOM and whitespace.
 */
export function looksLikeHtml(firstBytes: Uint8Array): boolean {
  const text = Buffer.from(firstBytes.subarray(0, SNIFF_BYTES)).toString("utf8");
  const start = text.startsWith(UTF8_BOM) ? text.slice(UTF8_BOM.length) : text;
  return HTML_START.test(start.trimStart());
}
