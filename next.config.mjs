/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false, // Use Babel instead of SWC for ARM64 compatibility
  experimental: {
    forceSwcTransforms: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
