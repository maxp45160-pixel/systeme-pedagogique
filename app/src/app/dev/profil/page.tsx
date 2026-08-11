import type { Metadata } from "next";
import { ProfilDashboard } from "@/components/dev/profil-dashboard";
import { compteCourant } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Tableau de bord de profilage — mesure et trace les lenteurs.
 *
 * Deux volets :
 *   * serveur : durées des lectures Supabase, du moteur de compétences, de la
 *     recommandation — collectées par `lib/profiling/server.ts` ;
 *   * client : rendus React (Profiler) et interactions utilisateur — collectés
 *     par `lib/profiling/client.ts`.
 *
 * Réservé au développement : le registre serveur n'existe qu'en mode dev.
 */
export const metadata: Metadata = {
  title: "Profilage — Système pédagogique",
  robots: { index: false, follow: false },
};

export default async function ProfilPage() {
  const compte = await compteCourant();
  if (!compte) redirect("/login");
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="font-serif text-2xl tracking-tight">Profilage</h1>
      <p className="mt-3 text-sm text-texte-discret">
        Mesure et trace les lenteurs, côté serveur et côté client. Navigue dans
        le produit, puis reviens ici pour lire les durées.
      </p>

      <div className="mt-8">
        <ProfilDashboard compteId={compte.id} />
      </div>
    </main>
  );
}
