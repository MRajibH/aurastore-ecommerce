import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework.
  poweredByHeader: false,
  // Serve modern, smaller formats from the built-in image optimizer.
  // All product/carousel/avatar images are local (/images/...), so no
  // remotePatterns are needed. Add remotePatterns here if you later serve
  // product images from an external CDN.
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
