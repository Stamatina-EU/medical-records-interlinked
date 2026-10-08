import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// The repository is public and the wordmark's typeface is commercial: the app's brand assets must be flat,
// outlined SVGs (no live text, font reference or embedded data), and no font file may ship with the app.
const root = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const ASSETS = ["public/brand/mark.svg", "app/icon.svg"];

function filesUnder(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

describe("brand assets", () => {
  it.each(ASSETS)("%s is a flat, outlined SVG", (p) => {
    const svg = read(p);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<text|<tspan|font-family|@font-face|<style|<image|<script|<linearGradient|<radialGradient|opacity|data:/i);
  });

  it("no font files ship under public/ or app/", () => {
    const fonts = [...filesUnder("public"), ...filesUnder("app")].filter((f) => /\.(otf|ttf|cff|woff2?|eot)$/i.test(f));
    expect(fonts).toEqual([]);
  });
});
