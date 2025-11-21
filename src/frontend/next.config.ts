import type { NextConfig } from "next";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    // Set the root directory to silence the multiple lockfiles warning
    root: __dirname,
  },
  // Ensure the correct working directory for the frontend
  experimental: {
    // Add any experimental features here if needed
  },
};

export default nextConfig;
