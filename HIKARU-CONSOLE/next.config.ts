import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hikaru/types', '@hikaru/lib', '@hikaru/ui'],

  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // Vercel モノレポ対応: ビルド出力をルートの .next に変更
  distDir: '../.next',

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
