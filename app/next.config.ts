import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  experimental: {
    /**
     * Cache routeur côté client (ADR-024).
     *
     * Le défaut de Next 16 est `dynamic: 0` : aucune page dynamique n'est
     * conservée entre deux navigations. Toutes les pages du groupe `(app)`
     * lisant les cookies de session, elles sont dynamiques — revenir sur une
     * page déjà vue refaisait donc un rendu serveur complet et un aller-retour
     * Supabase, à chaque clic.
     *
     * Avec 300 s, une page visitée est réaffichée depuis le cache client sans
     * appel serveur. Ce n'est pas un cache de données : le cloisonnement des
     * comptes reste entièrement dans PostgreSQL (RLS), et chaque écriture vide
     * ce cache — les sept Server Functions appellent toutes
     * `revalidatePath("/", "layout")`. Les deux réglages se lisent ensemble.
     */
    staleTimes: { dynamic: 300 },
  },
};

export default nextConfig;

