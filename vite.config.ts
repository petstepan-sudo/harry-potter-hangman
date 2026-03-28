import { defineConfig } from "vite";

const basePath = process.env.VITE_BASE_PATH?.trim();
const base =
  basePath && basePath !== "."
    ? basePath.endsWith("/")
      ? basePath
      : `${basePath}/`
    : "./";

// Pro GitHub Pages z kořene uživatelské stránky stačí výchozí "./".
// Pro https://user.github.io/NAZEV-REPA/ nastavte VITE_BASE_PATH=/NAZEV-REPA
export default defineConfig({
  base,
  build: {
    outDir: "dist",
    assetsDir: "assets",
  },
});
