import { describe, expect, it } from "vitest";
import { TAG_NAME_PATTERN, slugifyTagName } from "./tag-name";

describe("slugifyTagName", () => {
  it("lowercases the name", () => {
    expect(slugifyTagName("REACT")).toEqual({ ok: true, slug: "react" });
  });

  it("turns whitespace and underscores into hyphens", () => {
    expect(slugifyTagName("Machine Learning")).toEqual({ ok: true, slug: "machine-learning" });
    expect(slugifyTagName("deep_learning")).toEqual({ ok: true, slug: "deep-learning" });
    expect(slugifyTagName("web\tdev")).toEqual({ ok: true, slug: "web-dev" });
  });

  it("keeps the symbols + # and .", () => {
    expect(slugifyTagName("C++")).toEqual({ ok: true, slug: "c++" });
    expect(slugifyTagName("Node.js")).toEqual({ ok: true, slug: "node.js" });
    expect(slugifyTagName("C#")).toEqual({ ok: true, slug: "c#" });
  });

  it("drops every other character", () => {
    expect(slugifyTagName("what?!")).toEqual({ ok: true, slug: "what" });
    expect(slugifyTagName("café")).toEqual({ ok: true, slug: "caf" });
  });

  it("collapses runs of hyphens left by stripped or repeated separators", () => {
    expect(slugifyTagName("Rock & Roll")).toEqual({ ok: true, slug: "rock-roll" });
    expect(slugifyTagName("a--_ b")).toEqual({ ok: true, slug: "a-b" });
  });

  it("trims hyphens from both ends", () => {
    expect(slugifyTagName("  react  ")).toEqual({ ok: true, slug: "react" });
    expect(slugifyTagName("-!typescript!-")).toEqual({ ok: true, slug: "typescript" });
  });

  it("rejects a name that is empty after slugifying", () => {
    expect(slugifyTagName("")).toEqual({ ok: false, reason: "empty" });
    expect(slugifyTagName("   ")).toEqual({ ok: false, reason: "empty" });
    expect(slugifyTagName("!?&")).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts a slug of exactly 50 characters", () => {
    const fifty = "a".repeat(50);
    expect(slugifyTagName(fifty)).toEqual({ ok: true, slug: fifty });
  });

  it("rejects a slug of 51 characters", () => {
    expect(slugifyTagName("a".repeat(51))).toEqual({ ok: false, reason: "too-long" });
  });

  it("measures the length after slugifying, not before", () => {
    const fifty = "a".repeat(50);
    expect(slugifyTagName(`  ${fifty}!!  `)).toEqual({ ok: true, slug: fifty });
  });

  it("gives different spellings of one Tag the same slug", () => {
    for (const spelling of ["React ", "react", "REACT", " react "]) {
      expect(slugifyTagName(spelling)).toEqual({ ok: true, slug: "react" });
    }
    for (const spelling of [
      "Machine Learning",
      "machine-learning",
      "machine_learning",
      "MACHINE  LEARNING",
    ]) {
      expect(slugifyTagName(spelling)).toEqual({ ok: true, slug: "machine-learning" });
    }
  });
});

// The database CHECK on tags.name is built from TAG_NAME_PATTERN, so it must accept
// exactly what slugifyTagName produces.
describe("TAG_NAME_PATTERN", () => {
  const pattern = new RegExp(TAG_NAME_PATTERN);

  it("matches every slug slugifyTagName produces", () => {
    for (const name of [
      "React",
      "Machine Learning",
      "C++",
      "C#",
      "Node.js",
      "-a--_ b-",
      "web\tdev",
    ]) {
      const result = slugifyTagName(name);
      if (!result.ok) throw new Error(`expected "${name}" to slugify`);
      expect(pattern.test(result.slug)).toBe(true);
    }
  });

  it("rejects names that aren't canonical slugs", () => {
    for (const name of [
      "",
      "React",
      "machine learning",
      "-react",
      "react-",
      "a--b",
      "caf\u00e9",
      "a_b",
    ]) {
      expect(pattern.test(name)).toBe(false);
    }
  });
});
