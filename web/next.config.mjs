const prod = process.env.NODE_ENV === "production";
/** Static export for production (Nginx serves ./out). In dev, /api is proxied to an SSH tunnel on :3000. */
export default {
  ...(prod ? { output: "export", trailingSlash: true } : {}),
  images: { unoptimized: true },
  ...(!prod ? { async rewrites() { return [{ source: "/api/:path*", destination: "http://localhost:3000/api/:path*" }]; } } : {}),
};
