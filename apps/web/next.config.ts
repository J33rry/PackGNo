import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @sync/shared ships raw TypeScript source, so Next must transpile it.
  transpilePackages: ['@sync/shared'],
};

export default nextConfig;
