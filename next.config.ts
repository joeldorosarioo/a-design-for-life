import type { NextConfig } from 'next';
import { resolveNextDistDir } from './src/config/next-dist';
import { withPayload } from '@payloadcms/next/withPayload';

const nextConfig: NextConfig = {
  distDir: resolveNextDistDir(process.env),
  output: 'standalone',
  poweredByHeader: false,
  generateEtags: false,
  serverExternalPackages: ['pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/*': [
      './node_modules/pdfjs-dist/**/*',
      './node_modules/.pnpm/@napi-rs+canvas*/node_modules/@napi-rs/**/*',
    ],
  },
  outputFileTracingExcludes: {
    '/*': [
      './.env*',
      './.work/private-media/**/*',
      './.work/publication/**/*',
      './.work/editorial-mail/**/*',
      './.work/qpdf-downloads/**/*',
      './.toolchain/**/*',
      './testing/**/*',
      './artifacts/**/*',
      './docs/**/*',
    ],
  },
  // Proxy reauthorizes every outer/inner request before any optimizer cache hit.
  images: {
    unoptimized: false,
    localPatterns: [{ pathname: '/media/*/original', search: '' }],
    remotePatterns: [],
    qualities: [75],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [
      {
        source: '/preview-ui/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
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
