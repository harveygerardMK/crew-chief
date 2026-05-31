import { defineConfig } from "astro/config";

// Custom domain: https://wheresharvey.com/ (GitHub Pages)
export default defineConfig({
  site: "https://wheresharvey.com",
  base: "/",
  trailingSlash: "always",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
