/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "pdf-parse",
      "mammoth",
      "googleapis",
      "@prisma/adapter-neon",
      "@neondatabase/serverless",
      "ws",
    ],
  },
};

export default nextConfig;
