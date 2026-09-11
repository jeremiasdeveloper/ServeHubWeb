import type { NextConfig } from "next";

// Default: standalone server build (web + Windows desktop).
// SERVEHUB_EXPORT=1: static export for the Android thin client (the frontend
// runs locally and talks to the restaurant server over the LAN).
const isExport = process.env.SERVEHUB_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" as const } : { output: "standalone" as const }),
  images: { unoptimized: true },
  reactStrictMode: false,
};

export default nextConfig;
