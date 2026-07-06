// GITHUB_PAGES=true builds the static export deployed to GitHub Pages.
// The site is served from the apex of the custom domain wattway.net
// (public/CNAME), so there is no basePath — assets resolve from the site root.
const isPagesBuild = process.env.GITHUB_PAGES === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isPagesBuild ? "export" : undefined,
};

export default nextConfig;
