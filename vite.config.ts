import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Get the repository name for GitHub Pages base path
const repoName = process.env.GITHUB_REPOSITORY ? 
  "/" + process.env.GITHUB_REPOSITORY.split("/")[1] + "/" : "/e-lab/";

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? repoName : '/',
  test: {
    environment: "node",
  },
});
