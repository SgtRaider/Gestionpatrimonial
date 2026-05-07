import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  transpilePackages: ['@gp/shared'],
  webpack: (config) => {
    // Resolve `.js` imports inside TypeScript ESM packages (e.g. @gp/shared)
    // to their `.ts` source. Next.js + Webpack does not do this by default.
    config.resolve = config.resolve ?? {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default config;
