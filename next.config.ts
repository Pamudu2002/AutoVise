import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native/WASM modules stay outside the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "unpdf"],
  experimental: {
    // Logo uploads (≤ 2 MB) go through a server action; reports use direct Blob uploads instead.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
