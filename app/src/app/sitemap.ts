import type { MetadataRoute } from "next";

/**
 * Sitemap XML natif Next.js pour Google Search Console.
 * Référence les URLs publiques et prioritaires du système.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://systeme-pedagogique.vercel.app";
  const dateMaj = new Date();

  return [
    {
      url: baseUrl,
      lastModified: dateMaj,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: dateMaj,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}
