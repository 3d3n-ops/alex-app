/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Set Turbopack root to avoid lockfile warnings
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
