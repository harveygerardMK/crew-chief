import { defineConfig } from "astro/config";

// GitHub Pages project site: https://<user>.github.io/tahoe200-2026/
// For a user/org site at the root, set base to '/'.
export default defineConfig({
  site: "https://harveyschaefer.github.io",
  base: "/tahoe200-2026/",
  trailingSlash: "always",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
