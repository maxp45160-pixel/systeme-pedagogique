import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { ajouterNoteSession } from "@/lib/store/actions";
import {
  Bouton,
  Carte,
  CodeCompetence,
  EnTeteCarte,
  Etiquette,
  EtatVide,
  Statistique,
} from "@/components/ui/primitives";
import { calculerActivite, evenementsRecents } from "@/lib/engine/historique";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";

export async function PanneauJournal({ recherche: requete }: { recherche?: string }) {
  const ctx = await chargerContexte();
  const activite = calculerActivite(ctx.donnees.sessions, ctx.now);
  const evenements = evenementsRecents(ctx.donnees.evidence, ctx.referentiel.parCode, 200, ctx.now);

  // Filtrage par recherche textuelle (Chantier 6).
  let sessions = [...ctx.donnees.sessions].sort((a, b) => b.date.localeCompare(a.date));
  if (requete?.trim()) {
    const q = requete.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    sessions = sessions.filter((s) => {
      const texte = [
        s.resultat,
        s.difficulte,
        s.apprentissagePrincipal,
        s.notePersonnelle,
        s.prochaineAction,
        ...s.skillCodes,
        ...s.activites.map((a) => a.libelle),
        ...s.domaines,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
      return texte.includes(q);
    });
  }
  const parJour = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const cle = s.date.slice(0, 10);
    parJour.set(cle, [...(parJour.get(cle) ?? []), s]);
  }

  return (
    <>
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
          {/* Barre de recherche (Chantier 6) */}
          <form className="relative" action="/competences" method="GET">
            <input type="hidden" name="vue" value="journal" />
            <input
              type="search"
              name="recherche"
              defaultValue={requete ?? ""}
              placeholder="Rechercher dans le journal… (compétence, mot-clé…)"
              className="w-full rounded-md border border-bordure bg-surface px-3 py-2 pr-20 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-primaire px-2.5 py-1 text-[0.6875rem] font-medium text-primaire-contraste"
            >
              Rechercher
            </button>
          </form>
          {requete?.trim() && sessions.length === 0 ? (
            <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
              Aucune séance ne correspond à « {requete} ».
            </p>
          ) : requete?.trim() ? (
            <p className="text-xs text-texte-attenue">
              {sessions.length} séance{sessions.length > 1 ? "s" : ""} sur{" "}
              {ctx.donnees.sessions.length}
            </p>
          ) : null}
          <Carte>
            <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3.5">
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
                              <Etiquette key={d}>{libelleDomaine(ctx.referentiel, d)}</Etiquette>
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
                          <Bouton type="submit" variante="secondaire" taille="petite">
                            Noter
                          </Bouton>
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