/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function localIcalProxy(): Plugin {
  return {
    name: "local-ical-proxy",
    configureServer(server) {
      server.middlewares.use("/api/ical", async (req, res) => {
        const fullUrl = new URL(req.url || "", `http://${req.headers.host}`);
        const targetUrlParam = fullUrl.searchParams.get("url");

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");

        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.end();
          return;
        }

        const requiredApiKey = process.env.ICAL_PROXY_API_KEY || process.env.VITE_ICAL_PROXY_API_KEY;
        if (requiredApiKey) {
          const providedKey = req.headers["x-api-key"] || fullUrl.searchParams.get("key");
          if (providedKey !== requiredApiKey) {
            res.statusCode = 401;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Unauthorized: Invalid or missing API key." }));
            return;
          }
        }

        const envUrl = process.env.AIRBNB_ICAL_URL || process.env.VITE_AIRBNB_ICAL_URL;
        const targetUrl = targetUrlParam || envUrl;

        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: 'Query parameter "url" or AIRBNB_ICAL_URL is required.' }));
          return;
        }

        try {
          const fetchRes = await fetch(targetUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              Accept: "text/calendar, text/plain, */*",
            },
          });

          const text = await fetchRes.text();
          res.setHeader("Content-Type", "text/calendar; charset=utf-8");
          res.statusCode = fetchRes.status;
          res.end(text);
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localIcalProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
});
