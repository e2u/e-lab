import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Determine base path based on deployment target
let basePath = '/';
if (process.env.NODE_ENV === 'production') {
  // For GitHub Pages, use /repo-name/
  const githubRepo = process.env.GITHUB_REPOSITORY || '';
  if (githubRepo.includes('/')) {
    const repoName = githubRepo.split('/')[1];
    basePath = `/${repoName}/`;
  }
}

// Compile-time Feature Flags (Default: both false / hidden)
const enableLadder = process.env.VITE_ENABLE_LADDER === 'true' || process.env.ENABLE_LADDER === 'true';
const enableAutoLayout = process.env.VITE_ENABLE_AUTO_LAYOUT === 'true' || process.env.ENABLE_AUTO_LAYOUT === 'true';

export default defineConfig({
  plugins: [react()],
  base: basePath,
  define: {
    __ENABLE_LADDER__: JSON.stringify(enableLadder),
    __ENABLE_AUTO_LAYOUT__: JSON.stringify(enableAutoLayout),
  },
  test: {
    environment: "node",
  },
});
