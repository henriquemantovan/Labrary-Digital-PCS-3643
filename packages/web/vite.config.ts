import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");

  return {
    envDir: workspaceRoot,
    plugins: [react()],
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        "/api": `http://localhost:${env.API_PORT ?? 3000}`,
      },
    },
  };
});
