import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are intentionally off: every admin page is private and
  // per-user, so there is nothing to cache or prerender.
  reactCompiler: true,
  experimental: {
    serverActions: {
      // The course image upload accepts files up to 5 MB; leave a little room for multipart overhead.
      bodySizeLimit: '6mb',
    },
  },
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
