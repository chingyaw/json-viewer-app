import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    server: {
        host: "127.0.0.1",   // default is 'localhost'
        port: 5173,
        proxy: {
            "/api": {
                target: "http://127.0.0.1:4000",
                changeOrigin: true
            }
        }
    }
});
