import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `next dev` on a different port still shares the same `.next` build
  // output by default — running the regular dev server (30022) and the e2e
  // one (30099, via playwright.config.ts) at the same time corrupts both
  // (the exact "Cannot find module './NNN.js'" class of error). Playwright
  // sets PLAYWRIGHT_E2E so the two never touch the same directory.
  distDir: process.env.PLAYWRIGHT_E2E ? '.next-e2e' : '.next',
};

export default nextConfig;
