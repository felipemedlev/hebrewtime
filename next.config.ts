import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.195.200.208', 'localhost'],
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
