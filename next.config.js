const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    resolveAlias: {
      "@": path.join(__dirname, "src")
    }
  }
};

module.exports = nextConfig;
