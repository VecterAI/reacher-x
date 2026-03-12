// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 16: Enable Cache Components (PPR + "use cache" directive)
  cacheComponents: true,

  async redirects() {
    return [
      {
        source:
          "/:slug(prospects|candidates|partners|investors|participants|creators|potential-members|guests)",
        destination: "/",
        permanent: false,
      },
    ];
  },

  compiler: {
    removeConsole: true,
  },
  images: {
    formats: ["image/webp", "image/avif"],
    remotePatterns: [
      {
        // Twitter/X profile images and tweet media
        protocol: "https",
        hostname: "pbs.twimg.com",
      },
      {
        // UploadThing storage (user uploads, video posters)
        protocol: "https",
        hostname: "*.ufs.sh",
      },
    ],
  },

  experimental: {
    optimizePackageImports: ["lucide-react"],
    // Turbopack: Persist compiler artifacts for faster dev restarts
    turbopackFileSystemCacheForDev: true,
  },

  // Misc project settings (keep or remove as you like)
  compress: true,
  trailingSlash: false,
};

export default nextConfig;
