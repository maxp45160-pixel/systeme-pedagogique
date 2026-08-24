import type { MetadataRoute } from "next";

/**
 * Sitemap XML natif Next.js pour Google Search Console.
 * Référence les URLs publiques de la vitrine ; l'application elle-même
 * (`/app` et au-delà) est derrière authentification et n'a rien à indexer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://systeme-pedagogique-nine.vercel.app");
  const dateMaj = new Date();

  const entree = (
    chemin: string,
    priorite: number,
    frequence: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${baseUrl}${chemin}`,
    lastModified: dateMaj,
    changeFrequency: frequence,
    priority: priorite,
  });

  return [
    entree("/", 1.0, "weekly"),
    entree("/methode", 0.9, "monthly"),
    entree("/etudiants", 0.9, "monthly"),
    entree("/concours", 0.9, "monthly"),
    entree("/autodidactes", 0.9, "monthly"),
    entree("/login", 0.5, "monthly"),
  ];
}
