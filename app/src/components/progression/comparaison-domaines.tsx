import Link from "next/link";
import type { AgregatDomaine } from "@/lib/engine/progression";
import { Carte, CorpsCarte, EnTeteCarte } from "@/components/ui/primitives";
import { IconeFleche } from "@/components/ui/icones";

/**
 * Le score par domaine, en barres comparables.
 *
 * Une seule teinte pour toute magnitude — la règle des graphiques du produit
 * interdit une palette catégorielle, donc chaque domaine se lit par la
 * LONGUEUR de sa barre et par le chiffre écrit à côté, jamais par une couleur
 * qui lui serait propre. Un domaine sans mesure reste listé, en retrait, avec
 * un tiret : pas de barre à zéro qui prétendrait un niveau nul là où rien n'a
 * été mesuré (P2).
 */
export function ComparaisonDomaines({ parDomaine }: { parDomaine: AgregatDomaine[] }) {
  const presents = parDomaine.filter((d) => d.competencesTotal > 0);
  if (presents.length === 0) return null;

  const mesurees = presents.filter((d) => d.score !== null);
  if (mesurees.length === 0 && presents.every((d) => d.score === null)) {
    // Rien n'est mesuré nulle part : des barres vides ne diraient rien.
    return null;
  }

  return (
    <Carte>
      <EnTeteCarte titre="Par domaine" legende="Score pondéré là où c'est mesuré" />
      <CorpsCarte>
        <div className="space-y-2.5">
          {presents.map((domaine) => (
            <div key={domaine.domaine}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-medium text-texte-attenue" title={domaine.nom}>
                  {domaine.nom}
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="chiffres text-sm font-semibold text-texte">
                    {domaine.score ?? "—"}
                  </span>
                  <span className="chiffres text-[0.625rem] text-texte-discret">
                    {domaine.competencesEvaluees}/{domaine.competencesTotal}
                  </span>
                </span>
              </div>
              {/*
                Piste pleine largeur, remplissage au score. `min-w` garde un
                liseré visible dès la première mesure : un tout petit score est
                une information, pas une absence.
              */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-primaire transition-[width] duration-500"
                  style={{ width: domaine.score === null ? 0 : `${Math.max(domaine.score, 2)}%` }}
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/atelier?document=domaines"
          className="group mt-4 flex items-center justify-between border-t border-bordure pt-3 text-xs font-medium text-texte-attenue transition-colors hover:text-primaire"
        >
          <span>Le détail par sujet dans mes cours</span>
          <IconeFleche className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </CorpsCarte>
    </Carte>
  );
}
