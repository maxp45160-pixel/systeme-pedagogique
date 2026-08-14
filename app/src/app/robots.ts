import type { MetadataRoute } from "next";

/**
 * Fichier robots.txt natif Next.js.
 * Indique aux moteurs de recherche les règles d'exploration et l'emplacement du sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://systeme-pedagogique.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dev/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
