import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// web/ is the Consensus results screen, adapted as a static viewer for the Consensus skill (CoreSpeed edition).
//   npm run viewer:dev     dev server; open /?data=/<file>.json for a file in skills/consensus/examples
//   npm run viewer:build   one self-contained HTML file -> skills/consensus/viewer/consensus-viewer.html
export default defineConfig(({ command, mode }) => ({
  root: "web",
  plugins: [react(), ...(mode === "viewer" ? [viteSingleFile()] : [])],
  // Dev only: serve the example result files so /?data=/<file>.json works. Builds embed data instead.
  publicDir: command === "serve" ? "../skills/consensus/examples" : false,
  // The viewer is one file with every script inline, so the module-preload helper (it fetches) is left out.
  build: { outDir: mode === "viewer" ? "../.viewer-build" : "../dist", emptyOutDir: true, ...(mode === "viewer" ? { modulePreload: { polyfill: false } } : {}) },
  server: {
    port: 3000,
    // Hosted dev previews proxy through these domains.
    allowedHosts: [".sprites.app", ".c7d.dev"],
  },
}));
