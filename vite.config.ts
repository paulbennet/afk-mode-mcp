import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/webapp",
  build: {
    outDir: path.resolve(__dirname, "dist/webapp"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/webapp/index.html"),
        sw: path.resolve(__dirname, "src/webapp/sw.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "sw") return "sw.js";
          return "assets/[name]-[hash].js";
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
