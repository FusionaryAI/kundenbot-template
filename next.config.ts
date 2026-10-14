import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Der dateibasierte Turbopack-Build-Cache (in Next 16 standardmäßig an)
    // wird von Vercel zwischen Deployments wiederhergestellt und hat am
    // 14.10.2026 eine geänderte globals.css nicht erkannt: neues HTML, altes
    // Stylesheet live. Lieber ein paar Sekunden längerer Build.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
