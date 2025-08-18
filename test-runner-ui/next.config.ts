/** @type {import('next').NextConfig} */
const nextConfig = {
  // Only enable static export for production builds
  ...(process.env.NODE_ENV === 'production' && process.env.STATIC_EXPORT === 'true' ? {
    output: 'export',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    distDir: 'dist',
    images: {
      unoptimized: true
    }
  } : {})
}

export default nextConfig
