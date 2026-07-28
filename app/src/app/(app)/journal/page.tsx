import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel";
import { ajouterNoteSession } from "@/lib/store/actions";
import { EntetePage } from "@/components/layout/entete-page";
import {
  Carte,
  classesBouton,
  CodeCompetence,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  Statistique,
} from "@/components/ui/primitives";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";

export default async function PageJournal() {
  const ctx = await chargerContexte();
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const evenements = evenementsRecents(ctx.donnees.evidence, 200, ctx.now);

  // Regroupement par jour, du plus récent au plus ancien.
  const sessions = [...ctx.donnees.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const parJour = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const cle = s.date.slice(0, 10);
    parJour.set(cle, [...(parJour.get(cle) ?? []), s]);
  }

  return (
    <>
      <EntetePage
        titre="Journal de bord"
        sousTitre="Généré automatiquement à partir des séances de travail. Chaque entrée correspond à une activité réellement enregistrée — rien n'y est ajouté à la main par le système."
      />

      {sessions.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Journal vide"
            message="Une entrée est créée automatiquement à chaque exercice terminé : date, domaine, durée, résultat et difficulté rencontrée. Tu pourras y ajouter une note personnelle."
            action={
              <Link href="/exercices" className="text-xs text-primaire hover:underline">
                Commencer un exercice
              </Link>
            }
          />
        </Carte>
      ) : (
        <div className="space-y-4">
          <Carte>
            <div className="flex flex-wrap gap-x-8 gap-y-4 px-4 py-4">
              <Statistique libelle="Séances enregistrées" valeur={sessions.length} />
              <Statistique
                libelle="Temps cumulé"
                valeur={formatDuree(activite.minutesTotal)}
                precision="depuis le début du suivi"
              />
              <Statistique
                libelle="Durée moyenne"
                valeur={formatDuree(Math.round(activite.minutesTotal / sessions.length))}
                precision="par séance"
              />
              <Statistique
                libelle="Jours travaillés"
                valeur={activite.minutesParJour.size}
                precision="jours distincts"
              />
            </div>
          </Carte>

          {[...parJour.entries()].map(([jour, duJour]) => {
            const total = duJour.reduce((s, x) => s + (x.dureeMin ?? 0), 0);
            const evenementsDuJour = evenements.filter((e) => e.date.slice(0, 10) === jour);

            return (
              <Carte key={jour}>
                <EnTeteCarte
                  titre={formatDateCourte(`${jour}T12:00:00.000Z`)}
                  legende={`${duJour.length} séance${duJour.length > 1 ? "s" : ""} · ${formatDuree(total)}`}
                  action={
                    evenementsDuJour.some((e) => e.franchissement) ? (
                      <Etiquette ton="succes">Palier franchi</Etiquette>
                    ) : undefined
                  }
                />
                <ul className="divide-y divide-bordure">
                  {duJour.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {s.domaines.map((d) => (
                              <Etiquette key={d}>{libelleDomaine(d)}</Etiquette>
                            ))}
                            {s.skillCodes.map((c) => (
                              <Link key={c} href={`/competences/${c}`} className="hover:underline">
                                <CodeCompetence code={c} />
                              </Link>
                            ))}
                            {s.genereAutomatiquement && (
                              <span className="text-[0.625rem] text-texte-discret">
                                entrée automatique
                              </span>
                            )}
                          </div>

                          {s.activites.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                              {s.activites.map((a, i) => (
                                <li key={i} className="text-xs">
                                  {a.type === "exercice" ? (
                                    <Link
                                      href={`/exercices/${a.ref}`}
                                      className="hover:underline"
                                    >
                                      {a.libelle}
                                    </Link>
                                  ) : (
                                    a.libelle
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}

                          {s.resultat && (
                            <p className="mt-1 text-xs text-texte-attenue">{s.resultat}</p>
                          )}
                          {s.difficulte && (
                            <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
                              {s.difficulte}
                            </p>
                          )}
                          {s.apprentissagePrincipal && (
                            <p className="mt-1 text-xs">
                              <span className="text-texte-attenue">À retenir : </span>
                              {s.apprentissagePrincipal}
                            </p>
                          )}
                        </div>

                        <span className="chiffres shrink-0 text-xs text-texte-discret">
                          {s.dureeMin === undefined ? "durée non notée" : formatDuree(s.dureeMin)}
                        </span>
                      </div>

                      {/* Note personnelle : le seul champ que l'utilisateur écrit lui-même. */}
                      <div className="mt-2.5 border-t border-bordure pt-2.5">
                        {s.notePersonnelle ? (
                          <p className="text-xs italic text-texte-attenue">
                            « {s.notePersonnelle} »
                          </p>
                        ) : (
                          !ctx.donnees.user.prenom && null
                        )}
                        <form
                          action={ajouterNoteSession.bind(null, s.id)}
                          className="mt-1.5 flex gap-1.5"
                        >
                          <input
                            type="text"
                            name="note"
                            defaultValue={s.notePersonnelle ?? ""}
                            placeholder="Note personnelle…"
                            className="min-w-0 flex-1 rounded-md border border-bordure bg-surface px-2 py-1 text-xs placeholder:text-texte-discret focus:border-primaire focus:outline-none"
                          />
                          <button
                            type="submit"
                            className={classesBouton("secondaire", "petite")}
                          >
                            Noter
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </Carte>
            );
          })}
        </div>
      )}
    </>
  );
}
