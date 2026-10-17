import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "./logo";

describe("sanitizeSvg", () => {
  it("removes scripts, handlers, foreignObject and external references", () => {
    const dirty = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">
      <script>alert(2)</script>
      <foreignObject><iframe src="https://evil"></iframe></foreignObject>
      <a href="javascript:alert(3)"><rect width="10" height="10" fill="url(https://evil/x.svg#p)"/></a>
      <use xlink:href="https://evil/sprite.svg#icon"/>
      <use href="#local"/>
      <style>@import url(https://evil/x.css); .a{fill:red}</style>
    </svg>`;
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toMatch(/script|onload|foreignObject|iframe|javascript:|evil|@import/i);
    expect(clean).toContain('href="#local"');
    expect(clean).toContain("<rect");
  });

  it("rejects DOCTYPE and entity declarations", () => {
    expect(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg></svg>')).toThrow();
  });

  it("rejects files without an svg element", () => {
    expect(() => sanitizeSvg("<html><body/></html>")).toThrow();
  });
});
