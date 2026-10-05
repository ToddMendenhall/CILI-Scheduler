/** @type {import('next').NextConfig} */
const nextConfig = {
  // app/scheduler/route.ts reads the scheduler HTML from disk at request time;
  // without this, Vercel's serverless bundle for that route wouldn't include it.
  outputFileTracingIncludes: {
    "/scheduler": ["./scheduler/index.html"],
  },
};

module.exports = nextConfig;
