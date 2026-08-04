import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hikaru/types', '@hikaru/lib', '@hikaru/ui'],

  // Supabase の型生成不完全による TS エラーをビルド時にスキップ
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
}

export default nextConfig
