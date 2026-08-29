import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['imapflow', 'nodemailer', '@libsql/client'],
}

export default nextConfig
