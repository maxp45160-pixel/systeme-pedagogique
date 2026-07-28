import type { Metadata } from "next";
import { DevTodo } from "@/components/dev/dev-todo";

/**
 * Atelier de développement — hors du produit.
 *
 * La liste de TODOs est l'outil de coordination de l'équipe (ADR-019). Elle
 * était montée sans condition dans le layout applicatif, donc présente sur
 * chaque page du produit ; elle vit désormais ici seulement.
 *
 * Cette route est volontairement hors du groupe `(app)` : pas de rail, pas de
 * navigation, rien qui la fasse ressembler à un écran du produit.
 */
export const metadata: Metadata = {
  title: "Atelier — Système pédagogique",
  robots: { index: false, follow: false },
};

export default function DevPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="font-serif text-2xl tracking-tight">Atelier</h1>
      <p className="mt-3 text-sm text-texte-discret">
        Outils de développement. Cette page ne fait pas partie du produit et
        n&apos;est liée depuis aucun écran.
      </p>
      <p className="mt-6 text-sm text-texte-discret">
        La liste de TODOs partagée s&apos;ouvre par le bouton en bas à droite.
      </p>

      <DevTodo />
    </main>
  );
}
