import { defineConfig } from "astro/config";

/** Ask Harvey shell lives in public/*.html; static hosts map / → index.html, Astro dev does not. */
function publicHtmlIndexFallback() {
  const attach = (server) => {
    server.middlewares.use((req, _res, next) => {
      if (!req?.url) {
        next();
        return;
      }
      const [pathname, search = ""] = req.url.split("?");
      const suffix = search ? `?${search}` : "";
      if (pathname === "/" || pathname === "") {
        req.url = `/index.html${suffix}`;
      } else if (pathname === "/agent" || pathname === "/agent/") {
        req.url = `/agent/index.html${suffix}`;
      }
      next();
    });
  };
  return {
    name: "public-html-index-fallback",
    enforce: "pre",
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

// Custom domain: https://wheresharvey.com/ (GitHub Pages)
export default defineConfig({
  site: "https://wheresharvey.com",
  base: "/",
  trailingSlash: "always",
  output: "static",
  build: {
    inlineStylesheets: "always",
  },
  vite: {
    plugins: [publicHtmlIndexFallback()],
  },
});
