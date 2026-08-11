import Link from "next/link";
import type { EvenementProgression } from "@/lib/engine/historique";
import { Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide } from "@/components/ui/primitives";
import { formatDateRelative } from "@/lib/engine/dates";

const LIBELLE_TYPE: Record<EvenementProgression["type"], string> = {
  exercice: "Exercice",
  explication: "Explication",
  code: "Code",
  calcul: "Calcul",
  projet: "Projet",
  "correction-erreur": "Correction d'erreur",
  transfert: "Transfert",
  "etude-de-cas": "Étude de cas",
};

/**
 * « Qu'ai-je accompli récemment ? »
 *
 * Les preuves qui n'ont fait franchir aucun palier restent affichées, sans
 * mise en avant. Ne montrer que les progressions donnerait l'illusion d'une
 * courbe toujours montante ; le travail de consolidation compte aussi.
 */
export function CarteProgressionRecente({
  evenements,
}: {
  evenements: EvenementProgression[];
}) {
  return (
    <Carte>
      <EnTeteCarte titre="Progression récente" legende="Dernières preuves enregistrées" />

      {evenements.length === 0 ? (
        <EtatVide
          titre="Aucune preuve enregistrée"
          message="Les évolutions apparaîtront ici dès le premier exercice terminé. Rien n'est affiché avant qu'une preuve existe."
        />
      ) : (
        <ul className="divide-y divide-bordure">
          {evenements.map((e, i) => (
            <li key={`${e.date}-${e.skillCode}-${i}`} className="px-4 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link
                      href={`/competences/${e.skillCode}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                    >
                      <CodeCompetence code={e.skillCode} />
                    </Link>

                    {e.franchissement ? (
                      <span className="chiffres text-sm font-medium">
                        Niveau {e.niveauAvant ?? "—"} <span className="text-texte-discret">→</span>{" "}
                        <span className="text-succes">{e.niveauApres}</span>
                      </span>
                    ) : (
                      <span className="text-sm text-texte-attenue">
                        {e.resultat === "reussi"
                          ? "Réussi, niveau inchangé"
                          : e.resultat === "partiel"
                            ? "Partiellement réussi"
                            : "Non abouti"}
                      </span>
                    )}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-texte-attenue">{e.intitule}</p>
                  <p className="mt-0.5 truncate text-[0.6875rem] text-texte-discret">
                    {LIBELLE_TYPE[e.type]} · {e.contexte}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[0.6875rem] text-texte-discret">
                    {formatDateRelative(e.date)}
                  </span>
                  {e.franchissement && <Etiquette ton="succes">Palier franchi</Etiquette>}
                  {e.resultat === "echec" && <Etiquette ton="alerte">À reprendre</Etiquette>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {evenements.length > 0 && (
        <div className="border-t border-bordure px-4 py-2">
          <Link href="/seances" className="text-xs text-primaire hover:underline">
            Voir le journal de bord complet
          </Link>
        </div>
      )}
    </Carte>
  );
}
