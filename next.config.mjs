/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Don't serve dynamic pages from the client-side Router Cache when the user
    // navigates back to them. Without this, returning to /tracker shows the
    // totals as they were on first render (stale) instead of re-querying the
    // DB. 0 = always refetch dynamic routes on navigation.
    staleTimes: {
      dynamic: 0,
    },
  },
};

export default nextConfig;
