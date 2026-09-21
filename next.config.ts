import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No standalone output — Netlify's Next.js plugin handles the build.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the preview domain to access the dev server.
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
