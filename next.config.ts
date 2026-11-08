import type { NextConfig } from 'next';
import { withPayload } from '@payloadcms/next/withPayload';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/*': [
      './node_modules/pdfjs-dist/**/*',
      './node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**/*',
    ],
  },
  images: { unoptimized: true, localPatterns: [] },
  async headers() {
    return [
      {
        source: '/api/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
