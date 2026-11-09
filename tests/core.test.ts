import { describe, it, expect } from "vitest";
import { convert, volumeMass } from "../src/units";
import { weightedIndex, typingStats, cps, currency } from "../src/utils";
import { expression } from "../src/math";
import QRCode from "qrcode";
describe("Offline utilities", () => {
  it("converts exact length and mass constants", () => {
    expect(convert(1, "Length", "mi", "m")).toBe(1609.344);
    expect(convert(1, "Mass", "lb", "kg")).toBe(0.45359237);
    expect(convert(1, "Data storage", "KiB", "B")).toBe(1024);
  });
  it("handles affine temperature conversion", () => {
    expect(convert(32, "Temperature", "°F", "°C")).toBe(0);
    expect(convert(0, "Temperature", "°C", "K")).toBe(273.15);
    expect(convert(-40, "Temperature", "°C", "°F")).toBe(-40);
  });
  it("requires density for volume to mass", () => {
    expect(volumeMass(1, "L", "kg", 1000)).toBe(1);
    expect(volumeMass(100, "mL", "g", 920)).toBeCloseTo(92);
  });
  it("parses common mathematical expressions safely", () => {
    expect(expression("sin(pi / 2) + x^2")(3)).toBe(10);
    for (const bad of [
      "x=4",
      'import("bad")',
      "a.b",
      "[1,2]",
      "f(x)=x",
      "factorial(100000)",
    ])
      expect(() => expression(bad)).toThrow();
    expect(expression("sqrt(x)")(-1)).toBe(null);
  });
  it("selects weighted entries at boundaries and excludes zero weights", () => {
    expect(weightedIndex([0, 1, 3], 0)).toBe(1);
    expect(weightedIndex([0, 1, 3], 0.25)).toBe(2);
    expect(weightedIndex([0, 1, 3], 0.999)).toBe(2);
    expect(() => weightedIndex([0, 0])).toThrow();
  });
  it("calculates typing speed, accuracy and clicks", () => {
    expect(typingStats("hello", "hello", 60)).toEqual({
      wpm: 1,
      raw: 1,
      accuracy: 100,
      errors: 0,
    });
    expect(typingStats("hxllo", "hello", 30).accuracy).toBe(80);
    expect(cps(25, 5)).toBe(5);
    expect(currency(100, 4.4)).toBeCloseTo(440);
  });
  it("generates local QR matrices and SVG", async () => {
    expect(QRCode.create("offline").modules.size).toBeGreaterThan(0);
    expect(await QRCode.toString("offline", { type: "svg" })).toContain("<svg");
  });
});
