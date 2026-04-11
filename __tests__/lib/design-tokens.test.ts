import { C, FONT, FONT_URL } from "@/lib/design-tokens";

describe("Design Tokens", () => {
  it("exports the correct accent color", () => {
    expect(C.accent).toBe("#ff5c00");
  });

  it("exports all 8 color tokens", () => {
    const keys = Object.keys(C);
    expect(keys).toEqual(["bg", "dark", "accent", "green", "muted", "surface", "border", "yellow"]);
  });

  it("exports the Bricolage Grotesque font family", () => {
    expect(FONT).toContain("Bricolage Grotesque");
  });

  it("exports a Google Fonts URL", () => {
    expect(FONT_URL).toContain("fonts.googleapis.com");
  });
});
