import type { NextConfig } from 'next';
import { withPayload } from '@payloadcms/next/withPayload';

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default withPayload(nextConfig);
