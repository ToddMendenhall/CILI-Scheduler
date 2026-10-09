// Sent with every response.
const securityHeaders = [
  // no other site may show these pages in a frame (clickjacking); /dashboard frames /scheduler itself
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // other sites see where a visit came from, never the path (invite links carry their secret in it)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // browsers keep to HTTPS for this site for two years (ignored over plain http, so local work is unaffected)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // app/scheduler/route.ts reads the scheduler HTML from disk at request time;
  // without this, Vercel's serverless bundle for that route wouldn't include it.
  outputFileTracingIncludes: {
    "/scheduler": ["./scheduler/index.html"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The frame rule as a policy too, on every page but /scheduler, which sends a strict policy
      // of its own (app/scheduler/route.ts) that this one would replace. The app's React pages get
      // only the frame rule: a strict script policy for Next.js pages needs per-request nonces.
      {
        source: "/:path((?!scheduler$).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
};

module.exports = nextConfig;
