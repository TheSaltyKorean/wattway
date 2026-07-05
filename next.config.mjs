// GITHUB_PAGES=true builds the static export served under /wattway
const isPagesBuild = process.env.GITHUB_PAGES === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isPagesBuild ? "export" : undefined,
  basePath: isPagesBuild ? "/wattway" : undefined,
};

export default nextConfig;
