import Link from "next/link";
import { grilleMois, moisDecale, moisDuJour } from "@/lib/domain/pages-cahier";
import { OutilSeance } from "@/components/seances/outil-seance";

const JOURS_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * Aller à une page sans la feuilleter.
 *
 * Le feuilletage saute d'une page écrite à la suivante : parfait pour relire de
 * proche en proche, inutile pour retrouver « le mardi où j'ai travaillé les
 * flux ». Le calendrier répond à cette question-là, et il dit lesquels des
 * jours portent une page plutôt que de laisser chercher.
 *
 * ## Un bouton, pas un bandeau
 *
 * Il occupait toute la largeur sous l'en-tête, replié dans un `<details>` :
 * une barre pleine page pour un geste qu'on ne fait pas à chaque visite. Il
 * redevient ce qu'il doit être — un petit bouton près de la navigation, qui
 * ouvre une grille flottante. La mécanique du panneau est celle des outils du
 * workspace (`OutilSeance`) : refermé au clic extérieur et à Échap, et une
 * seule implémentation pour les deux.
 *
 * Un jour sans contenu reste cliquable : il ouvre une page vierge qui le dit.
 * L'interdire obligerait à deviner où l'on a le droit d'aller.
 */
export function CalendrierCahier({
  jour,
  mois,
  jours,
  aujourdHui,
}: {
  /** La page ouverte, mise en évidence dans la grille. */
  jour: string;
  /** Le mois affiché — il peut différer du mois de la page ouverte. */
  mois: string;
  /** Les jours qui portent une page. */
  jours: string[];
  aujourdHui: Date;
}) {
  const semaines = grilleMois(mois, jours, aujourdHui);
  // Le jour ouvert voyage avec la navigation de mois : changer de mois ne doit
  // pas changer la page qu'on regarde, seulement ce qu'on survole.
  const lienMois = (cible: string) =>
    `/seances?jour=${encodeURIComponent(jour)}&mois=${encodeURIComponent(cible)}`;

  return (
    <OutilSeance
      libelle="Aller à une date"
      contenuClassName="absolute right-0 z-30 mt-2 w-[17rem] rounded-lg border border-bordure bg-surface p-3 shadow-[var(--ombre-surcouche)]"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={lienMois(moisDecale(mois, -1))}
            aria-label="Mois précédent"
            className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3"
          >
            ←
          </Link>
          <span className="text-xs font-medium capitalize">{libelleMois(mois)}</span>
          <Link
            href={lienMois(moisDecale(mois, 1))}
            aria-label="Mois suivant"
            className="rounded px-2 py-1 text-xs text-texte-attenue hover:bg-surface-3"
          >
            →
          </Link>
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
                  return (
                    <td key={jourCase.jour}>
                      <Link
                        href={`/seances?jour=${encodeURIComponent(jourCase.jour)}`}
                        aria-current={ouvert ? "page" : undefined}
                        className={[
                          "flex aspect-square items-center justify-center rounded text-xs",
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
                          .join(" ")}
                      >
                        {Number(jourCase.jour.slice(8, 10))}
                      </Link>
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
  return new Date(`${mois}-01T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}
