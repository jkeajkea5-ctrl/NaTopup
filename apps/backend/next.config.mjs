/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compress API responses when the backend is served with `next start`.
  // Vercel also applies compression automatically at its edge network.
  compress: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
