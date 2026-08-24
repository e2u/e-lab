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

export default defineConfig({
  plugins: [react()],
  base: basePath,
  test: {
    environment: "node",
  },
});
