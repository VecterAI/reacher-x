/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.twimg.com",
        port: "",
        search: "",
      },
    ],
  },
  // Performance optimizations
  experimental: {
    // Enable optimizations for faster page loads
    optimizePackageImports: ["lucide-react"],
  },
  // Enable compression for faster loading
  compress: true,
  // Enable static optimization where possible
  trailingSlash: false,
};

export default nextConfig;
