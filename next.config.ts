import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow network access so React JavaScript loads successfully
  // instead of being blocked by cross-origin security
  // @ts-ignore
  allowedDevOrigins: ['127.195.200.208', 'localhost']
};

export default nextConfig;
