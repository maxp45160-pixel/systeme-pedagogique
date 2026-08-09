import type { FacteurIntervalle } from "@/lib/engine/spaced";

/**
 * Rend la liste des facteurs d'un intervalle de révision — libellé · valeur ·
 * ×multiplicateur.
 *
 * Factorisé depuis la carte « Prochaine révision » de la fiche compétence et
 * réutilisé par le bloc « À réviser » du tableau de bord. Une seule définition
 * du rendu, pour qu'un facteur ne puisse pas diverger entre les deux surfaces
 * (P3 — aucun nombre sans sa source, et la source se lit pareil partout).
 */
export function FacteursRevision({ facteurs }: { facteurs: FacteurIntervalle[] }) {
  return (
    <dl className="space-y-1">
      {facteurs.map((f, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-3 border-b border-bordure/60 pb-1 last:border-0"
        >
          <dt className="text-xs text-texte-attenue">{f.libelle}</dt>
          <dd className="chiffres shrink-0 text-xs font-medium">
            {/*
              Arrondi à deux décimales : `1 + robustesse × 3` sur un flottant
              produisait des « ×1.7000000000000002 » (audit §2.11). Toutes les
              autres surfaces numériques du produit passent par `toFixed` ou
              `Math.round` ; celle-ci était la seule à afficher le brut.
            */}
            {f.valeur} · ×{Math.round(f.multiplicateur * 100) / 100}
          </dd>
        </div>
      ))}
    </dl>
  );
}
