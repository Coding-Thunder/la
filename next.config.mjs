/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // firebase-admin must not be bundled — it relies on Node built-ins + optional
  // native deps. Keep it external to the server build.
  experimental: {
    serverComponentsExternalPackages: ["firebase-admin"],
  },
}

export default nextConfig
