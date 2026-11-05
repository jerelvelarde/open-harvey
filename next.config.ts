import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false, // don't write AGENTS.md into the starter when `next dev` runs under a coding agent
  devIndicators: false, // keep the screen clean when presenting
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
