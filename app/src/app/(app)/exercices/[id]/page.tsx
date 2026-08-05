import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { DIFFICULTES } from "@/lib/domain/types";
import {
  debloquerIndice,
  demarrerTentative,
} from "@/lib/store/actions";
import {
  Carte,
  classesBouton,
  CodeCompetence,
  cx,
  EnTeteCarte,
  Etiquette,
  JaugeNiveau,
} from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/markdown";
import { FormulaireBilan } from "@/components/exercices/formulaire-bilan";
import { ZoneReponse } from "@/components/exercices/zone-reponse";
import { IconeAmpoule, IconeFleche, IconeValide } from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";
import { amorceExercice, lienTuteur } from "@/lib/tutor/amorces";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, decrireChoix } from "@/lib/tutor/moteurs";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import type { EtatContexteTuteur } from "@/components/tuteur/chat";

export default async function PageExercice(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ correction?: string; bilan?: string; abandon?: string }>;
}) {
  const { id } = await props.params;
  const { correction, bilan, abandon } = await props.searchParams;

  const ctx = await chargerContexte();
  const exercice = ctx.donnees.exercises.find((e) => e.id === id);
  if (!exercice) notFound();

  const tentatives = ctx.donnees.attempts.filter((a) => a.exerciseId === exercice.id);
  const enCours = tentatives.find((a) => a.statut === "en-cours") ?? null;
  const derniereTerminee =
    [...tentatives].filter((a) => a.statut === "terminee").at(-1) ?? null;

  const cible = ctx.etatsParCode.get(exercice.competences[0]);
  // La correction reste masquée quand on REFIT un exercice : une nouvelle
  // tentative doit repartir sans la solution sous les yeux, sinon elle ne
  // mesure plus rien. `enCours` est vrai dès qu'une tentative est ouverte.
  const correctionVisible =
    correction === "1" || bilan === "1" || (derniereTerminee !== null && !enCours);

  const dureeSuggeree = enCours
    ? Math.max(
        1,
        Math.round((ctx.now.getTime() - new Date(enCours.debut).getTime()) / 60_000),
      )
    : exercice.dureeEstimeeMin;

  // Contexte du tuteur pour le tiroir — même assemblage que la page /tuteur.
  const pedagogique = await construireContexte(ctx, [], exercice.id);
  const choix = choisirConfiguration(process.env);
  const etatInitialTuteur: EtatContexteTuteur = {
    cleConfiguree: choix.kind !== "aucun",
    modele: decrireChoix(choix),
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  };
  const codesCompetences = ctx.etats.map((e) => e.skill.code);
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3">
        <Link href="/exercices" className="text-xs text-texte-attenue hover:text-texte">
          ← Tous les exercices
        </Link>
      </div>

      {/*
        Abandon : aucune preuve écrite, et il faut le dire.

        Le silence serait pire que le zéro qu'on vient de refuser d'écrire —
        l'utilisateur croirait sa mesure enregistrée. On annonce ce qui n'a pas
        été fait, et pourquoi (P3 : aucune valeur sans source, y compris quand
        la valeur est « rien »).
      */}
      {abandon === "1" && (
        <div className="mb-4 rounded-carte border border-info/30 bg-info-faible px-4 py-3">
          <p className="text-sm font-medium text-info">Aucune preuve enregistrée</p>
          <p className="mt-1 text-xs text-texte-attenue">
            La tentative a duré moins d&apos;un quart de la durée estimée
            ({exercice.dureeEstimeeMin} min) sans être réussie : elle est marquée comme
            abandonnée. En tirer un niveau reviendrait à confondre « pas mesuré » et
            « raté » — ton niveau sur{" "}
            {exercice.competences.map((c) => c).join(", ")} est inchangé.
          </p>
          <p className="mt-1 text-xs text-texte-discret">
            La tentative reste au journal : elle explique pourquoi aucune difficulté
            n&apos;est conseillée pour le prochain exercice.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href={`/exercices/${exercice.id}`} className={classesBouton("principal", "petite")}>
              Reprendre l&apos;exercice
            </Link>
            <Link
              href={lienTuteur(
                amorceExercice(exercice.competences[0] ?? "", {
                  difficulteConseillee: ctx.calibrations.get(exercice.competences[0] ?? "")
                    ?.difficulteConseillee,
                  dimensionFaible:
                    ctx.calibrations.get(exercice.competences[0] ?? "")?.dimensionFaible
                      ?.dimension ?? null,
                }),
                exercice.competences[0],
              )}
              className={classesBouton("secondaire", "petite")}
            >
              En demander un autre au tuteur
            </Link>
          </div>
        </div>
      )}

      {/* Bilan après enregistrement */}
      {bilan === "1" && derniereTerminee && (
        <div className="mb-4 rounded-carte border border-succes/30 bg-succes-faible px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-succes">
            <IconeValide className="size-4" />
            Preuve enregistrée
          </p>
          <p className="mt-1 text-xs text-texte-attenue">
            {exercice.competences.map((c) => {
              const e = ctx.etatsParCode.get(c);
              return (
                <span key={c} className="mr-3 inline-block">
                  <strong>{c}</strong> : niveau{" "}
                  {e?.niveau === null || e?.niveau === undefined ? "—" : e.niveau}/5, confiance{" "}
                  {e?.confiance ?? "—"}
                </span>
              );
            })}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/competences/${exercice.competences[0]}`}
              className={classesBouton("secondaire", "petite")}
            >
              Voir l&apos;effet sur la compétence
            </Link>
            <Link href="/" className={classesBouton("secondaire", "petite")}>
              Prochaine action recommandée
            </Link>
          </div>
        </div>
      )}

      {/* -------------------------------- En-tête ------------------------- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Etiquette>{libelleDomaine(ctx.referentiel, exercice.domaine)}</Etiquette>
          <Etiquette>
            Difficulté {exercice.difficulte}/5 · {DIFFICULTES[exercice.difficulte]}
          </Etiquette>
          <Etiquette>≈ {formatDuree(exercice.dureeEstimeeMin)}</Etiquette>
          {exercice.diagnostic && <Etiquette ton="info">Diagnostic</Etiquette>}
        </div>
        <h1 className="mt-2.5 text-xl font-semibold tracking-tight">{exercice.titre}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {exercice.competences.map((c) => {
            const e = ctx.etatsParCode.get(c);
            return (
              <Link
                key={c}
                href={`/competences/${c}`}
                className="flex items-center gap-2 rounded-md border border-bordure px-2 py-1 transition-colors hover:bg-surface-2"
              >
                <CodeCompetence code={c} />
                <span className="w-14">
                  <JaugeNiveau niveau={e?.niveau ?? null} taille="compacte" />
                </span>
                <span className="chiffres text-[0.6875rem] text-texte-discret">
                  {e?.niveau ?? "—"}/5
                </span>
              </Link>
            );
          })}
        </div>
      </header>

      <div className="space-y-4">
        {/* -------------------------------- Énoncé -------------------------- */}
        <Carte>
          <EnTeteCarte titre="Énoncé" />
          <div className="px-4 py-3.5 text-sm">
            <Markdown contenu={exercice.enonce} />
          </div>
        </Carte>

        {/* -------------------------------- Données ------------------------- */}
        {exercice.donnees && exercice.donnees.length > 0 && (
          <Carte>
            <EnTeteCarte titre="Données" />
            <ul className="divide-y divide-bordure">
              {exercice.donnees.map((d, i) => (
                <li key={i} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
                  <span className="text-xs text-texte-attenue">{d.libelle}</span>
                  <span className="chiffres text-sm font-medium">{d.valeur}</span>
                </li>
              ))}
            </ul>
          </Carte>
        )}

        {/* ------------------------ Démarrage / résolution ------------------ */}
        {!enCours && !derniereTerminee && (
          <Carte accent>
            <div className="px-4 py-3.5">
              <p className="text-sm">
                Prends le temps de chercher avant d&apos;ouvrir un indice. Le nombre d&apos;indices
                consultés détermine l&apos;autonomie enregistrée — c&apos;est ce qui distingue une
                application guidée d&apos;une résolution autonome.
              </p>
              {cible?.preuves.length === 0 && (
                <p className="mt-2 text-xs text-texte-attenue">
                  Il s&apos;agit du premier diagnostic sur {exercice.competences[0]}. L&apos;objectif
                  n&apos;est pas de réussir mais de situer ton niveau réel : une réponse partielle est
                  une information utile.
                </p>
              )}
              <form action={demarrerTentative.bind(null, exercice.id)} className="mt-4">
                <button type="submit" className={classesBouton("principal")}>
                  Commencer
                  <IconeFleche className="size-4" />
                </button>
              </form>
            </div>
          </Carte>
        )}

        {enCours && (
          <>
            {/* Espace de réponse — libre, non corrigé automatiquement. */}
            <Carte>
              <EnTeteCarte
                titre="Ta réponse"
                legende="Rédige ta méthode, pas seulement le résultat final"
              />
              <div className="px-4 py-3.5">
                <ZoneReponse
                  attemptId={enCours.id}
                  valeur={enCours.reponse}
                  compteId={ctx.donnees.user.id}
                />
                {/*
                  Le lien porte l'identifiant de l'exercice : le tuteur reçoit
                  l'énoncé, les indices déjà consultés et le brouillon
                  enregistré. Il n'y a plus rien à recoller à la main — et il ne
                  reçoit toujours PAS la correction.
                */}
                <p className="mt-3 text-xs text-texte-attenue">
                  Bloqué ?{" "}
                  <TiroirTuteur
                    etatInitial={etatInitialTuteur}
                    exerciceCible={exercice.id}
                    codesCompetences={codesCompetences}
                    compteId={ctx.donnees.user.id}
                    domainesExistants={domainesExistants}
                    libelle="Demander de l'aide au tuteur sur cet exercice"
                  />{" "}
                  — il aura l&apos;énoncé et ton brouillon sous les yeux. Il ne donnera pas
                  d&apos;indice plus explicite que ceux que tu as laissés fermés.
                </p>
              </div>
            </Carte>

            {/* Indices — débloqués un par un, et l'ouverture est enregistrée. */}
            {exercice.indices.length > 0 && (
              <Carte>
                <EnTeteCarte
                  titre="Indices"
                  legende={`${enCours.indicesUtilises} / ${exercice.indices.length} consulté${
                    enCours.indicesUtilises > 1 ? "s" : ""
                  }`}
                  action={
                    <Etiquette
                      ton={
                        enCours.indicesUtilises === 0
                          ? "succes"
                          : enCours.indicesUtilises >= exercice.indices.length
                            ? "alerte"
                            : "info"
                      }
                    >
                      Autonomie prévue :{" "}
                      {enCours.indicesUtilises >= exercice.indices.length
                        ? "A1"
                        : enCours.indicesUtilises >= 1
                          ? "A2"
                          : "A3"}
                    </Etiquette>
                  }
                />
                <div className="px-4 py-3">
                  {enCours.indicesUtilises === 0 ? (
                    <p className="mb-3 text-xs text-texte-attenue">
                      Aucun indice consulté. Si tu résous l&apos;exercice ainsi, la preuve sera
                      enregistrée en autonomie A3.
                    </p>
                  ) : (
                    <ul className="mb-3 space-y-2">
                      {exercice.indices.slice(0, enCours.indicesUtilises).map((ind, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-md border border-bordure bg-surface-2 px-3 py-2"
                        >
                          <IconeAmpoule className="mt-0.5 size-4 shrink-0 text-alerte" />
                          <div>
                            <div className="text-[0.625rem] font-medium uppercase tracking-wider text-texte-discret">
                              Indice {i + 1}
                            </div>
                            <p className="mt-0.5 text-xs">{ind}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {enCours.indicesUtilises < exercice.indices.length && (
                    <form action={debloquerIndice.bind(null, enCours.id, enCours.indicesUtilises)}>
                      <button type="submit" className={classesBouton("secondaire", "petite")}>
                        <IconeAmpoule className="size-3.5" />
                        Débloquer l&apos;indice {enCours.indicesUtilises + 1}
                      </button>
                    </form>
                  )}
                </div>
              </Carte>
            )}

            {/* Correction — jamais révélée d'emblée. */}
            {!correctionVisible ? (
              <Carte>
                <div className="px-4 py-3.5">
                  <p className="text-sm font-medium">Correction</p>
                  <p className="mt-1 text-xs text-texte-attenue">
                    Elle reste masquée tant que tu ne l&apos;ouvres pas. La révéler ne pénalise pas
                    ton autonomie — seuls les indices comptent — mais cherche d&apos;abord.
                  </p>
                  <Link
                    href={`/exercices/${exercice.id}?correction=1`}
                    className={cx(classesBouton("secondaire"), "mt-3")}
                  >
                    Afficher la correction
                  </Link>
                </div>
              </Carte>
            ) : (
              <>
                <Carte>
                  <EnTeteCarte
                    titre="Correction"
                    legende="Compare ta méthode, pas seulement ton résultat"
                  />
                  <div className="px-4 py-3.5 text-sm">
                    <Markdown contenu={exercice.correction} />
                  </div>
                </Carte>

                <Carte accent>
                  <EnTeteCarte
                    titre="Auto-évaluation"
                    legende="C'est cette étape qui produit la preuve"
                  />
                  <div className="px-4 py-3.5">
                    <FormulaireBilan
                      exercice={exercice}
                      attemptId={enCours.id}
                      dureeSuggeree={dureeSuggeree}
                      indicesUtilises={enCours.indicesUtilises}
                    />
                  </div>
                </Carte>
              </>
            )}
          </>
        )}

        {/* ---------------------- Exercice déjà terminé --------------------- */}
        {!enCours && derniereTerminee && (
          <>
            <Carte>
              <EnTeteCarte
                titre="Correction"
                legende={`Tentative terminée · ${derniereTerminee.indicesUtilises} indice(s) · ${
                  derniereTerminee.dureeMin ? formatDuree(derniereTerminee.dureeMin) : "durée non notée"
                }`}
                action={
                  <Etiquette
                    ton={
                      derniereTerminee.resultat === "reussi"
                        ? "succes"
                        : derniereTerminee.resultat === "partiel"
                          ? "info"
                          : "alerte"
                    }
                  >
                    {derniereTerminee.resultat === "reussi"
                      ? "Réussi"
                      : derniereTerminee.resultat === "partiel"
                        ? "Partiel"
                        : "Non abouti"}
                  </Etiquette>
                }
              />
              <div className="px-4 py-3.5 text-sm">
                <Markdown contenu={exercice.correction} />
              </div>
            </Carte>

            {derniereTerminee.reponse && (
              <Carte>
                <EnTeteCarte titre="Ta réponse d'alors" />
                <div className="whitespace-pre-wrap px-4 py-3.5 text-xs text-texte-attenue">
                  {derniereTerminee.reponse}
                </div>
              </Carte>
            )}

            <Carte>
              <div className="px-4 py-3.5">
                <p className="text-sm">
                  Cet exercice a produit une preuve. Le refaire plus tard, après un délai, est
                  exactement ce qui fait monter la robustesse d&apos;une compétence.
                </p>
                <form action={demarrerTentative.bind(null, exercice.id)} className="mt-3">
                  <button type="submit" className={classesBouton("secondaire")}>
                    Refaire cet exercice
                  </button>
                </form>
              </div>
            </Carte>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* `ZoneReponse` vit désormais dans `components/exercices/zone-reponse.tsx` :
   le brouillon doit survivre à une navigation, ce qui demande du client. */
