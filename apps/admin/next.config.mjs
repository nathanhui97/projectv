// Corporate SSL proxy doesn't have a trusted cert in Node.js — disable verification in dev only.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kbnxttlumaofdhyiuioj.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.gundam-gcg.com",
        pathname: "/*/images/cards/**",
      },
    ],
  },
};

export default nextConfig;
