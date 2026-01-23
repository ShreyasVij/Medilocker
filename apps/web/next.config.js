const path = require('path');

/** @type {import('next/dist/shared/lib/config-shared').NextConfig} */
const nextConfig = {
  // Explicitly set Turbopack root to the monorepo root to silence warnings
  turbopack: {
    root: path.join(__dirname, '..', '..'),
  },
  // Temporarily disable Turbopack filesystem cache in dev to avoid persistence panics
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

module.exports = nextConfig;
