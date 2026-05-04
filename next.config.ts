import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/process-fb-url': ['./bin/yt-dlp'],
  },
};

export default nextConfig;
