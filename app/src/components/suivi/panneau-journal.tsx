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
import { cleJour, formatDateCourte, formatDuree } from "@/lib/engine/dates";

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
  /*
   * `cleJour` et non `s.date.slice(0, 10)` (audit §2.12).
   *
   * La découpe de chaîne prend le jour **UTC** ; `cleJour` prend le jour
   * **local**, et c'est lui qui alimente la grille d'activité. Hors UTC, une
   * séance de fin de soirée tombait un jour dans le journal et le lendemain
   * dans la grille — deux vues des mêmes données qui se contredisaient.
   */
  const parJour = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const cle = cleJour(s.date);
    parJour.set(cle, [...(parJour.get(cle) ?? []), s]);
  }

  /*
   * Les statistiques portent sur ce qui est AFFICHÉ (audit §2.9).
   *
   * « Durée moyenne » divisait `activite.minutesTotal` — toutes les séances —
   * par `sessions.length`, la liste filtrée : chercher un mot-clé gonflait la
   * moyenne du rapport entre les deux. « Séances enregistrées » avait la même
   * incohérence de libellé. Numérateur et dénominateur viennent désormais du
   * même ensemble, et le libellé dit lequel.
   */
  const filtre = Boolean(requete?.trim());
  const minutesAffichees = sessions.reduce((total, s) => total + (s.dureeMin ?? 0), 0);
  const joursAffiches = parJour.size;

  /*
   * Le journal est vide quand il n'y a AUCUNE séance — pas quand la recherche
   * n'en trouve aucune. Le test portait sur la liste filtrée : une requête sans
   * correspondance affichait « Journal vide » ET retirait le champ de
   * recherche, qui vit dans la branche opposée. `?recherche=` devenait
   * ineffaçable depuis l'interface, et le message prévu pour ce cas était du
   * code mort.
   */
  const journalVide = ctx.donnees.sessions.length === 0;

  return (
    <>
      {journalVide ? (
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
              className="w-full rounded-md border border-bordure-controle bg-surface px-3 py-2 pr-20 text-sm placeholder:text-texte-discret"
            />
            <button
              type="submit"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-primaire px-2.5 py-1 text-[0.6875rem] font-medium text-primaire-contraste"
            >
              Rechercher
            </button>
          </form>
          {/*
            Une recherche sans résultat n'est pas un journal vide : le champ
            reste au-dessus, et un lien permet de l'effacer. Sans lui,
            `?recherche=` ne se retirait que depuis la barre d'adresse.
          */}
          {filtre && sessions.length === 0 && (
            <div className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2">
              <p className="text-xs text-texte-attenue">
                Aucune séance ne correspond à « {requete} ».
              </p>
              <Link
                href="/competences?vue=journal"
                className="mt-1 inline-block text-xs text-primaire hover:underline"
              >
                Effacer la recherche
              </Link>
            </div>
          )}

          {filtre && sessions.length > 0 && (
            <p className="text-xs text-texte-attenue">
              {sessions.length} séance{sessions.length > 1 ? "s" : ""} sur{" "}
              {ctx.donnees.sessions.length}
            </p>
          )}

          {sessions.length > 0 && (
          <Carte>
            <div className="flex flex-wrap gap-x-6 gap-y-3 px-4 py-3.5">
              <Statistique
                libelle={filtre ? "Séances trouvées" : "Séances enregistrées"}
                valeur={sessions.length}
                precision={filtre ? `sur ${ctx.donnees.sessions.length} au total` : undefined}
              />
              <Statistique
                libelle="Temps cumulé"
                valeur={formatDuree(filtre ? minutesAffichees : activite.minutesTotal)}
                precision={filtre ? "sur ces séances" : "depuis le début du suivi"}
              />
              <Statistique
                libelle="Durée moyenne"
                // `sessions.length` ne peut pas être 0 ici : la branche vide est
                // gouvernée par `journalVide`, et le cas « recherche sans
                // résultat » ne rend pas ce bloc.
                valeur={
                  sessions.length > 0
                    ? formatDuree(Math.round(minutesAffichees / sessions.length))
                    : "—"
                }
                precision="par séance"
              />
              <Statistique
                libelle="Jours travaillés"
                valeur={filtre ? joursAffiches : activite.minutesParJour.size}
                precision="jours distincts"
              />
            </div>
          </Carte>
          )}

          {[...parJour.entries()].map(([jour, duJour]) => {
            const total = duJour.reduce((s, x) => s + (x.dureeMin ?? 0), 0);
            // Même clé locale que le regroupement, sinon un évènement de fin de
            // soirée se rattacherait au mauvais jour (audit §2.12).
            const evenementsDuJour = evenements.filter((e) => cleJour(e.date) === jour);

            return (
              <Carte key={jour}>
                <EnTeteCarte
                  // `T12:00:00` sans `Z` : midi LOCAL. Avec le `Z`, un fuseau
                  // au-delà de UTC+12 affichait la date du lendemain.
                  titre={formatDateCourte(`${jour}T12:00:00`)}
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
                            className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-2 py-1 text-xs placeholder:text-texte-discret"
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