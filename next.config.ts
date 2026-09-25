import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf ships a bundled pdf.js build; keep it out of the server bundle.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
