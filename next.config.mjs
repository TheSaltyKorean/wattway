// GITHUB_PAGES=true builds a static export served under /wattway;
// default is the standalone server build used by the Docker image.
const isPagesBuild = process.env.GITHUB_PAGES === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isPagesBuild ? "export" : "standalone",
  basePath: isPagesBuild ? "/wattway" : undefined,
};

export default nextConfig;
