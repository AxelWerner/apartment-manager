/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

function aiChatDevPlugin(): Plugin {
  return {
    name: "ai-chat-dev-middleware",
    configureServer(server) {
      server.middlewares.use("/api/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        let bodyData = "";
        req.on("data", (chunk) => {
          bodyData += chunk;
        });

        req.on("end", async () => {
          try {
            const currentEnv = loadEnv(server.config.mode, process.cwd(), "");
            Object.assign(process.env, currentEnv);
            const parsedBody = bodyData ? JSON.parse(bodyData) : {};
            const chatModule = await server.ssrLoadModule("./api/chat.ts");
            const result = await chatModule.handleChatStream(parsedBody);
            result.pipeUIMessageStreamToResponse(res, {
              getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
            });
          } catch (err: unknown) {
            console.error("AI Chat Dev Error:", err);
            const errorMessage = err instanceof Error ? err.message : "Error al conectar con tu servidor LLM";
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: errorMessage,
                hint: "Verifica CUSTOM_LLM_BASE_URL en tu .env.local",
              })
            );
          }
        });
      });

      server.middlewares.use("/api/scan-receipt", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        let bodyData = "";
        req.on("data", (chunk) => {
          bodyData += chunk;
        });

        req.on("end", async () => {
          try {
            const parsedBody = bodyData ? JSON.parse(bodyData) : {};
            const scanModule = await server.ssrLoadModule("./api/scan-receipt.ts");
            const result = await scanModule.processReceiptExtraction(parsedBody);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err: unknown) {
            console.error("AI Scan Receipt Dev Error:", err);
            const errorMessage =
              err instanceof Error ? err.message : "Error al procesar el comprobante";
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: errorMessage,
                hint: "Verifica CUSTOM_LLM_BASE_URL en tu .env.local y que el modelo soporte visión.",
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [react(), tailwindcss(), aiChatDevPlugin()],
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
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test/", "**/*.d.ts", "**/*.test.{ts,tsx}"],
    },
  },
};
});
