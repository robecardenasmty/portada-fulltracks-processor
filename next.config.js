/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
  },
  serverRuntimeConfig: {
    maxBodySize: '100mb',
  },
}

module.exports = nextConfig
