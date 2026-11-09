import { describe, it, expect } from "vitest";
import { cleanURL } from "../src/url-utils";
describe("URL cleaning without network access", () => {
  it("removes only known tracking parameters, case insensitively", () => {
    const r = cleanURL(
      "https://example.com/p%2Fath?id=42&utm_source=mail&FBCLID=123&search=a%20b#part",
    );
    expect(r.cleaned).toBe(
      "https://example.com/p%2Fath?id=42&search=a%20b#part",
    );
    expect(r.removed.map((x) => x.name)).toEqual(["utm_source", "FBCLID"]);
  });
  it("restores individual duplicate parameters in original order", () => {
    expect(
      cleanURL("https://example.com/?utm_source=a&x=1&utm_source=b", [2])
        .cleaned,
    ).toBe("https://example.com/?x=1&utm_source=b");
    expect(cleanURL("https://example.com/?utm_source=a", [0]).cleaned).toBe(
      "https://example.com/?utm_source=a",
    );
  });
  it("preserves signed and functional values while flagging signatures", () => {
    const r = cleanURL(
      "https://example.com/file?X-Amz-Signature=abc&token=xyz&utm_campaign=q",
    );
    expect(r.signed).toBe(true);
    expect(r.cleaned).toContain("token=xyz");
    expect(r.cleaned).toContain("X-Amz-Signature=abc");
  });
  it("rejects relative, malformed and non-HTTP URLs", () => {
    for (const s of [
      "javascript:alert(1)",
      "file:///tmp/test",
      "/relative",
      "not a URL",
      "https://",
    ])
      expect(() => cleanURL(s)).toThrow();
  });
  it("preserves unchanged encoding, fragments, empty queries and encoded tracking keys", () => {
    expect(
      cleanURL("https://example.com/?a=hello+world&a=two%20words#utm_x=y")
        .cleaned,
    ).toBe("https://example.com/?a=hello+world&a=two%20words#utm_x=y");
    expect(cleanURL("https://example.com/?").cleaned).toBe(
      "https://example.com/?",
    );
    expect(cleanURL("https://example.com/?%75tm_source=a&ok=1").cleaned).toBe(
      "https://example.com/?ok=1",
    );
  });
});
