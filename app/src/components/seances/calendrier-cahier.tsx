import Link from "next/link";
import { grilleMois, moisDecale, moisDuJour } from "@/lib/domain/pages-cahier";
import { formatMoisAnnee } from "@/lib/engine/dates";
import { OutilSeance } from "@/components/seances/outil-seance";
import { IconeCalendrier } from "@/components/ui/icones";

const JOURS_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Aller à une page sans la feuilleter.
 *
 * Le feuilletage saute d'une page écrite à la suivante : parfait pour relire de
 * proche en proche, inutile pour retrouver « le mardi où j'ai travaillé les
 * flux ». Le calendrier répond à cette question-là, et il dit lesquels des
 * jours portent une page plutôt que de laisser chercher.
 */
export function CalendrierCahier({
  jour,
  mois,
  jours,
  aujourdHui,
  onChangerJour,
  onChangerMois,
  variante = "bouton",
}: {
  /** La page ouverte, mise en évidence dans la grille. */
  jour: string;
  /** Le mois affiché — il peut différer du mois de la page ouverte. */
  mois: string;
  /** Les jours qui portent une page. */
  jours: string[];
  aujourdHui: Date;
  onChangerJour?: (jour: string) => void;
  onChangerMois?: (mois: string) => void;
  /** `discret` : l'icône seule, pour la barre d'outils du Bureau. */
  variante?: "bouton" | "discret";
}) {
  const semaines = grilleMois(mois, jours, aujourdHui);
  const lienMois = (cible: string) =>
    `/seances?jour=${encodeURIComponent(jour)}&mois=${encodeURIComponent(cible)}`;

  return (
    <OutilSeance
      libelle="Aller à une date"
      variante={variante}
      icone={<IconeCalendrier className="size-4" />}
      contenuClassName="absolute right-0 z-[var(--superposition-menu)] mt-2 w-[17rem] rounded-lg border border-bordure bg-surface p-3 shadow-[var(--ombre-surcouche)]"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          {onChangerMois ? (
            <button
              type="button"
              onClick={() => onChangerMois(moisDecale(mois, -1))}
              aria-label="Mois précédent"
              className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3 transition-colors"
            >
              ←
            </button>
          ) : (
            <Link
              href={lienMois(moisDecale(mois, -1))}
              aria-label="Mois précédent"
              className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3"
            >
              ←
            </Link>
          )}

          <span className="text-xs font-medium capitalize">{libelleMois(mois)}</span>

          {onChangerMois ? (
            <button
              type="button"
              onClick={() => onChangerMois(moisDecale(mois, 1))}
              aria-label="Mois suivant"
              className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3 transition-colors"
            >
              →
            </button>
          ) : (
            <Link
              href={lienMois(moisDecale(mois, 1))}
              aria-label="Mois suivant"
              className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3"
            >
              →
            </Link>
          )}
        </div>

        <table className="w-full table-fixed border-separate border-spacing-0.5 text-center">
          <thead>
            <tr>
              {JOURS_SEMAINE.map((initiale, index) => (
                <th
                  key={index}
                  scope="col"
                  className="pb-1 text-[0.625rem] font-medium text-texte-discret"
                >
                  {initiale}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semaines.map((semaine, index) => (
              <tr key={index}>
                {semaine.map((jourCase) => {
                  const ouvert = jourCase.jour === jour;
                  const classesCase = [
                    "flex aspect-square items-center justify-center rounded text-xs transition-colors",
                    jourCase.dansLeMois ? "" : "text-texte-discret/50",
                    ouvert
                      ? "bg-primaire font-semibold text-surface"
                      : jourCase.aContenu
                        ? "bg-primaire-faible font-medium text-primaire hover:bg-surface-3"
                        : "hover:bg-surface-3",
                    jourCase.estAujourdHui && !ouvert
                      ? "ring-1 ring-inset ring-primaire"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <td key={jourCase.jour}>
                      {onChangerJour ? (
                        <button
                          type="button"
                          onClick={() => onChangerJour(jourCase.jour)}
                          aria-current={ouvert ? "page" : undefined}
                          className={`w-full ${classesCase}`}
                        >
                          {Number(jourCase.jour.slice(8, 10))}
                        </button>
                      ) : (
                        <Link
                          href={`/seances?jour=${encodeURIComponent(jourCase.jour)}`}
                          aria-current={ouvert ? "page" : undefined}
                          className={classesCase}
                        >
                          {Number(jourCase.jour.slice(8, 10))}
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[0.625rem] text-texte-discret">
          En couleur : les jours qui portent une page.
        </p>
      </div>
    </OutilSeance>
  );
}

export function moisAffiche(moisDemande: string | null, jour: string): string {
  return moisDemande ?? moisDuJour(jour);
}

function libelleMois(mois: string): string {
  return formatMoisAnnee(mois);
}
