import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
  transpilePackages: [
    'deck.gl',
    '@deck.gl/core',
    '@deck.gl/layers',
    '@deck.gl/mapbox',
    '@deck.gl/react',
  ],
}

export default nextConfig
