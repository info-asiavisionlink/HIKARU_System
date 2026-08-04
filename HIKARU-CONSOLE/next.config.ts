import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hikaru/types', '@hikaru/lib', '@hikaru/ui'],

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
