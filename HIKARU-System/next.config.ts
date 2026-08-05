import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hikaru/types', '@hikaru/lib', '@hikaru/ui'],

  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}

export default nextConfig
