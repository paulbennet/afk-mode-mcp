import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    root: "src/webapp",
    build: {
        outDir: path.resolve(__dirname, "dist/webapp"),
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    },
});
