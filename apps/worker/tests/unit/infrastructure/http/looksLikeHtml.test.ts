import { describe, expect, it } from "vitest";
import { looksLikeHtml } from "@/infrastructure/http/looksLikeHtml";

const BOM = String.fromCharCode(0xfeff);
const bytes = (text: string) => new Uint8Array(Buffer.from(text));

describe("looksLikeHtml", () => {
  it.each([
    "<!doctype html><html>",
    '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">',
    "<html>",
    '<HTML lang="en">',
    "<html",
    "<head><title>x</title>",
    `${BOM}<!doctype html>`,
    " \r\n\t<html>",
    `${BOM}\n  <head>`,
  ])("takes %j for HTML", (start) => {
    expect(looksLikeHtml(bytes(start))).toBe(true);
  });

  it.each([
    "",
    "%PDF-1.7",
    "<header>Not a document</header>",
    "<htmlx>",
    '<?xml version="1.0"?><html>',
    "plain text <html>",
    '{"html": "<html>"}',
    "<!doctype xml>",
  ])("doesn't take %j for HTML", (start) => {
    expect(looksLikeHtml(bytes(start))).toBe(false);
  });
});
