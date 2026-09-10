import { describe, it, expect } from "bun:test";
import { SHELL_CSS } from "./webview-shell.ts";

describe("SHELL_CSS theme source", () => {
  it("takes dark from the host attribute, not only from the OS", () => {
    // The five shell panels are sandboxed iframes, so prefers-color-scheme
    // reports the desktop's setting, not the theme the app is on.
    expect(SHELL_CSS).toContain(':root[data-ppm-theme="dark"]');
  });

  it("never lets the OS media query override an explicit light", () => {
    const media = SHELL_CSS.slice(SHELL_CSS.indexOf("@media (prefers-color-scheme: dark)"));
    expect(media).toContain(':root:not([data-ppm-theme="light"])');
  });

  it("derives the hover surface from the text colour", () => {
    // Mapping it from an app token would make it invisible in the themes that
    // give both panel surfaces the same colour.
    expect(SHELL_CSS).toContain("--surface-hover: color-mix(in srgb, var(--text)");
  });

  it("keeps the same dark values as the graph panel", async () => {
    // The two stylesheets are separate strings; the shell's own doc comment
    // claims they match, and a panel opened from the graph sits next to it.
    const { getWebviewHtml } = await import("./webview-html.ts");
    const graph = getWebviewHtml();
    const darkBlock = SHELL_CSS.slice(
      SHELL_CSS.indexOf(':root[data-ppm-theme="dark"] {'),
      SHELL_CSS.indexOf("@media (prefers-color-scheme: dark)"),
    );
    for (const decl of darkBlock.split(";").map((d) => d.trim()).filter((d) => d.startsWith("--"))) {
      expect(graph).toContain(decl);
    }
  });
});
