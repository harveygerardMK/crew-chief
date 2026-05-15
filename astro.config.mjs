import { defineConfig } from "astro/config";

// GitHub Pages project site: https://harveygerardMK.github.io/crew-chief/
export default defineConfig({
  site: "https://harveygerardMK.github.io",
  base: "/crew-chief/",
  trailingSlash: "always",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
});
