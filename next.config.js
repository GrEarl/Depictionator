const path = require("path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // ビルド時の静的生成をスキップ、API routesでPrisma初期化エラーを回避
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
