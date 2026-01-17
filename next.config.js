const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone'を削除 - Prisma CLIの依存関係問題を回避
  outputFileTracingRoot: path.join(__dirname),
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.join(__dirname, "src")
    };
    return config;
  }
};

module.exports = nextConfig;
