import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { GuardedOEmbedProvider } from "@/infrastructure/http/GuardedOEmbedProvider";
import { SafeUrlFetcher, UrlRefusedError, USER_AGENT } from "@/infrastructure/http/SafeUrlFetcher";
import { at, local, localFetcher, useLocalServer } from "../../../support/localServer";

useLocalServer();

describe("GuardedOEmbedProvider, JSON through the same guard", () => {
  const oEmbeds = (options: { timeoutMs?: number } = {}) =>
    new GuardedOEmbedProvider(localFetcher(options));

  it("reads an oEmbed answer's type and title, asking for JSON", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed.json?url=x&format=json"))).resolves.toEqual({
      type: "video",
      title: "A video",
      thumbnailUrl: null,
    });
    expect(local.lastHeaders.accept).toBe("application/json");
    expect(local.lastHeaders["user-agent"]).toBe(USER_AGENT);
    expect(local.hits).toEqual(["/oembed.json?url=x&format=json"]);
  });

  it("titles an embedded post without a title by the text it quotes", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-post"))).resolves.toEqual({
      type: "rich",
      title: "Hello & welcome pic.twitter.com/x",
      thumbnailUrl: null,
    });
  });

  it("decodes entities in a title", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-encoded"))).resolves.toEqual({
      type: "rich",
      title: "WordPress 6.7 “Rollins” & more",
      thumbnailUrl: null,
    });
  });

  it("accepts a +json Content-Type and ignores fields of the wrong kind", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-plus-json"))).resolves.toEqual({
      type: "photo",
      title: null,
      thumbnailUrl: null,
    });
  });

  it("reads an answer's thumbnail_url", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-thumbnail"))).resolves.toEqual({
      type: "video",
      title: "A video",
      thumbnailUrl: "https://i.example.com/hq.jpg",
    });
  });

  it("ignores a thumbnail_url that isn't http(s)", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/oembed-thumbnail-unsafe"))).resolves.toMatchObject({
      thumbnailUrl: null,
    });
  });

  it("follows a redirect", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/to-oembed"))).resolves.toMatchObject({
      type: "video",
    });
    expect(local.hits).toEqual(["/to-oembed", "/oembed.json"]);
  });

  it.each([
    ["/oembed-html", /isn't JSON/],
    ["/oembed-big", /more than 65536 bytes/],
    ["/oembed-endless", /more than 65536 bytes/],
    ["/oembed-not-json", SyntaxError],
    ["/oembed-array", /isn't an oEmbed object/],
    ["/oembed-missing", /answered 404/],
    ["/broken", /answered 503/],
  ])("rejects %s", async (path, reason) => {
    await expect(oEmbeds({ timeoutMs: 2000 }).fetchOEmbed(at(path))).rejects.toThrow(reason);
  });

  it("times out like the page fetch", async () => {
    await expect(oEmbeds({ timeoutMs: 200 }).fetchOEmbed(at("/hang"))).rejects.toThrow(
      /timed out after 200 ms/,
    );
  });

  it("refuses an endpoint inside the network with the real guard, never connecting", async () => {
    const real = new GuardedOEmbedProvider(new SafeUrlFetcher());

    await expect(real.fetchOEmbed(at("/oembed.json", "127.0.0.1"))).rejects.toThrow(
      UrlRefusedError,
    );
    await expect(real.fetchOEmbed("http://169.254.169.254/oembed")).rejects.toThrow(
      UrlRefusedError,
    );
    expect(local.hits).toEqual([]);
  });

  it("refuses a redirect into the network", async () => {
    await expect(oEmbeds().fetchOEmbed(at("/to-metadata"))).rejects.toThrow(/169\.254\.169\.254/);
    expect(local.hits).toEqual(["/to-metadata"]);
  });

  it("refuses an endpoint that isn't http(s)", async () => {
    await expect(oEmbeds().fetchOEmbed("file:///etc/passwd")).rejects.toThrow(UrlRefusedError);
  });
});
