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
      // Allow Open Graph images from common domains
      {
        protocol: "https",
        hostname: "**.amazonaws.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.github.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.githubusercontent.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.medium.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.youtube.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.ytimg.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.reddit.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.redd.it",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.stackoverflow.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.stackexchange.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.dev.to",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.hashnode.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.substack.com",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.notion.so",
        port: "",
        pathname: "**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "**.notion.site",
        port: "",
        pathname: "**",
        search: "",
      },
      // Allow any HTTPS domain for Open Graph images (less secure but more flexible)
      {
        protocol: "https",
        hostname: "**",
        port: "",
        pathname: "**",
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
