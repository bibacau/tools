import { describe, it, expect } from "vitest";
import { raceStats, racePassages } from "../src/race-core";
import { validateBoardProject } from "../src/whiteboard-core";
import { standaloneHTML } from "../src/playground-core";
describe("typing races", () => {
  it("counts only matching prefixes as race progress, while tracking accuracy", () => {
    expect(raceStats("abx", "abcd", 60000)).toEqual({
      wpm: 0.4,
      accuracy: (2 / 3) * 100,
      progress: 0.5,
      complete: false,
    });
    expect(raceStats("abcd", "abcd", 60000).complete).toBe(true);
    expect(raceStats("", "abcd", 0).wpm).toBe(0);
  });
  it("bundles readable offline passages", () => {
    expect(racePassages.length).toBeGreaterThan(2);
    expect(racePassages.every((p) => p.length >= 10 && p.length <= 2000)).toBe(
      true,
    );
  });
});
describe("editable board import", () => {
  const project = (objects: any[]) => ({
    format: "personal-os-whiteboard",
    version: 1,
    name: "Board",
    content: { canvas: { objects }, viewport: [1, 0, 0, 1, 0, 0] },
  });
  it("accepts bounded editable objects and rejects network images or unknown types", () => {
    expect(
      validateBoardProject(
        project([{ type: "Rect", left: 1, top: 2, width: 100, height: 50 }]),
      ).name,
    ).toBe("Board");
    expect(() =>
      validateBoardProject(
        project([{ type: "Image", src: "https://example.com/private.png" }]),
      ),
    ).toThrow();
    expect(() => validateBoardProject(project([{ type: "Script" }]))).toThrow();
    expect(() =>
      validateBoardProject(
        project([
          {
            type: "Rect",
            fill: { type: "pattern", source: "https://example.com" },
          },
        ]),
      ),
    ).toThrow();
  });
  it("rejects non-finite dimensions and unsafe background resources", () => {
    expect(() =>
      validateBoardProject(project([{ type: "Rect", width: Infinity }])),
    ).toThrow();
    const p: any = project([]);
    p.content.canvas.background = {
      type: "Pattern",
      source: "https://example.com",
    };
    expect(() => validateBoardProject(p)).toThrow();
  });
});
it("exports standalone HTML without a closing-script injection breaking encoded JS", () => {
  const s = standaloneHTML({
    html: "<h1>Hi</h1>",
    css: "h1 { color:red; }",
    js: 'console.log("</script>")',
  });
  expect(s).toContain("<h1>Hi</h1>");
  expect(s).toContain("data:text/javascript;base64,");
  expect(s).not.toContain('console.log("</script>")');
});
it("counts Unicode characters consistently and exports complete HTML documents", () => {
  expect(raceStats("🌲a", "🌲abc", 60000).progress).toBe(0.5);
  const doc = standaloneHTML({
    html: "<!doctype html><html><head><title>Demo</title></head><body><p>Full document</p></body></html>",
    css: "p{color:red}",
    js: "console.log(1)",
  });
  expect((doc.match(/<html/g) || []).length).toBe(1);
  expect(doc).toContain("p{color:red}");
  expect(doc.indexOf("data:text/javascript")).toBeLessThan(
    doc.indexOf("</body>"),
  );
});
