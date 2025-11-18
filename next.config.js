/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
        pathname: "/s2/favicons*"
      }
    ]
  },
  async rewrites() {
    return [
      {
        source: "/presentation",
        destination: "/presentation/index.html"
      }
    ];
  }
};

module.exports = nextConfig;
