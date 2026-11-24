import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/explore", destination: "/map", permanent: true }];
  },
  async headers() {
    return [
      { source: "/data/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
