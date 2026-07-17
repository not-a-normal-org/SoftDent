import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // minimal, self-contained production image (only required runtime files)
  output: "standalone",
};

export default nextConfig;
