import type { Objectif } from "@/lib/domain/types";
import type { Recommandation } from "@/lib/engine/recommend";
import { Carte, classesBouton, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
import { definirObjectif } from "@/lib/store/actions";

const HORIZONS: { cle: Objectif["horizon"]; titre: string; aide: string }[] = [
  { cle: "jour", titre: "Aujourd'hui", aide: "Une action réalisable en une séance" },
  { cle: "semaine", titre: "Cette semaine", aide: "Une consolidation ciblée" },
  { cle: "long-terme", titre: "Long terme", aide: "Une capacité à construire" },
];

/**
 * Trois horizons d'objectifs.
 *
 * Aucun objectif n'est créé automatiquement : le système propose, l'utilisateur
 * décide. Une proposition est explicitement marquée comme telle et n'est
 * enregistrée que si elle est validée — un objectif attribué d'office n'aurait
 * aucune valeur d'engagement.
 */
export function CarteObjectifs({
  objectifs,
  recommandations,
}: {
  objectifs: Objectif[];
  recommandations: Recommandation[];
}) {
  const principale = recommandations[0];

  function proposition(horizon: Objectif["horizon"]): string {
    if (!principale) return "";
    const s = principale.etat.skill;
    if (horizon === "jour") {
      return principale.exercice
        ? `Traiter : ${principale.exercice.titre}`
        : `Travailler ${s.code} — ${principale.etat.prochaineEtape}`;
    }
    if (horizon === "semaine") {
      return `Consolider ${s.code} par deux preuves dans des contextes différents`;
    }
    return "Maîtriser la modélisation de systèmes logistiques incertains";
  }

  return (
    <Carte>
      <EnTeteCarte titre="Objectifs" legende="Fixés par toi, jamais imposés par le système" />

      <ul className="divide-y divide-bordure">
        {HORIZONS.map(({ cle, titre, aide }) => {
          const actuel = objectifs.find((o) => o.horizon === cle);
          return (
            <li key={cle} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                  {titre}
                </span>
                {actuel?.cible && (
                  <Etiquette>
                    Cible : {actuel.cible.nombre} {actuel.cible.kind}
                  </Etiquette>
                )}
              </div>

              {actuel ? (
                <p className="mt-1 text-sm">{actuel.libelle}</p>
              ) : (
                <div className="mt-1.5">
                  <p className="text-xs text-texte-discret">{aide}</p>
                  {(
                    <form action={definirObjectif.bind(null, cle)} className="mt-2 flex gap-1.5">
                      <input
                        type="text"
                        name="libelle"
                        defaultValue={proposition(cle)}
                        placeholder="Définir un objectif…"
                        className="min-w-0 flex-1 rounded-md border border-bordure bg-surface px-2 py-1 text-xs placeholder:text-texte-discret focus:border-primaire focus:outline-none"
                      />
                      <button type="submit" className={classesBouton("secondaire", "petite")}>
                        Fixer
                      </button>
                    </form>
                  )}
                  {principale && (
                    <p className="mt-1 text-[0.625rem] text-texte-discret">
                      Le champ est pré-rempli d&apos;une proposition fondée sur ta recommandation
                      actuelle. Modifie-la librement.
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
