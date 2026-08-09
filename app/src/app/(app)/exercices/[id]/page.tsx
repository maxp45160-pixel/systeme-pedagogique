import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { LienRetour } from "@/components/ui/lien-retour";
import { libelleDomaine } from "@/lib/domain/referentiel-compte";
import { DIFFICULTES } from "@/lib/domain/types";
import {
  debloquerIndice,
  demarrerTentative,
} from "@/lib/store/actions";
import {
  BandeauInfo,
  Carte,
  classesLienBouton,
  CodeCompetence,
  cx,
  EnTeteCarte,
  Etiquette,
  JaugeNiveau,
} from "@/components/ui/primitives";
import { PanneauPliable } from "@/components/ui/panneau-pliable";
import { Markdown } from "@/components/ui/markdown";
import { BilanAssiste } from "@/components/exercices/bilan-assiste";
import { BoutonAbandon } from "@/components/exercices/abandon";
import { ZoneReponse } from "@/components/exercices/zone-reponse";
import { BoutonSoumission } from "@/components/ui/bouton-soumission";
import { FocusActe } from "@/components/exercices/focus-acte";
import { motifBlocageBilan, reponseSuffisante } from "@/lib/domain/tentative";
import { IconeAmpoule, IconeFleche, IconeValide } from "@/components/ui/icones";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { BilanRedigeVue } from "@/components/exercices/bilan-redige";
import { tentativeMenee } from "@/lib/engine/calibration";
import { amorceExercice, lienTuteur } from "@/lib/tutor/amorces";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import {
  calibragesPourModale,
  competencesPourModale,
} from "@/components/exercices/proprietes-generation";

export default async function PageExercice(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    correction?: string;
    /** Passe l'écran de Comparer (correction visible) à Mesurer (bilan). */
    evaluer?: string;
    bilan?: string;
    abandon?: string;
  }>;
}) {
  const { id } = await props.params;
  const { correction, evaluer, bilan, abandon } = await props.searchParams;

  const ctx = await chargerContexte();
  const exercice = ctx.donnees.exercises.find((e) => e.id === id);
  if (!exercice) notFound();

  const tentatives = ctx.donnees.attempts.filter((a) => a.exerciseId === exercice.id);
  const enCours = tentatives.find((a) => a.statut === "en-cours") ?? null;
  // PostgreSQL ne garantit aucun ordre de retour : la « dernière » tentative ne
  // se lit pas en fin de tableau, elle se trie sur sa date (audit §2.5).
  const derniereTerminee =
    [...tentatives]
      .filter((a) => a.statut === "terminee")
      .sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut))[0] ?? null;

  /*
   * Deux chemins mènent désormais à `?abandon=1` :
   *
   * - l'abandon DÉRIVÉ — la tentative n'a pas duré le quart de la durée
   *   estimée, `tentativeMenee` refuse d'en conclure quoi que ce soit (ADR-030) ;
   * - l'abandon DÉLIBÉRÉ — la personne a cliqué « Abandonner ».
   *
   * Le bandeau invoquait la durée dans les deux cas. Sur un abandon délibéré
   * après 40 minutes de travail, il aurait affirmé une chose fausse à propos
   * de ce qui venait de se passer. On lit donc la même règle que le serveur
   * pour savoir laquelle des deux phrases est vraie.
   */
  const derniereAbandonnee =
    [...tentatives]
      .filter((a) => a.statut === "abandonnee")
      .sort((a, b) => (b.fin ?? b.debut).localeCompare(a.fin ?? a.debut))[0] ?? null;
  const abandonDelibere = derniereAbandonnee
    ? tentativeMenee(derniereAbandonnee, exercice)
    : false;

  const cible = ctx.etatsParCode.get(exercice.competences[0]);
  /*
   * Trois actes, un CTA principal chacun : Chercher (rien de visible ici
   * encore) → Comparer (`correctionVisible`, sans être encore à l'évaluation)
   * → Mesurer (`enMesure`, le formulaire de bilan). Chaque transition est un
   * clic explicite, pas une conséquence de l'ouverture de la correction —
   * avant ce chantier, révéler la correction affichait AUSSI le formulaire de
   * bilan dans le même geste, l'un des ~15 blocs simultanés du constat de
   * phase 3.
   *
   * La correction reste masquée quand on REFAIT un exercice : une nouvelle
   * tentative doit repartir sans la solution sous les yeux, sinon elle ne
   * mesure plus rien. `enCours` est vrai dès qu'une tentative est ouverte, et
   * `correction`/`evaluer` n'existent que dans son URL — un `refaire` crée une
   * tentative fraîche derrière un lien sans ces paramètres.
   */
  const correctionVisible = correction === "1" || evaluer === "1";
  const enMesure = evaluer === "1";
  // L'énoncé reste toujours atteignable — c'est le contexte, pas une action.
  // Il ne se replie que dans l'acte Mesurer, jamais avant : Chercher et
  // Comparer en ont encore besoin pour, respectivement, résoudre et comparer.
  const foldEnonce = Boolean(enCours) && enMesure;

  const dureeSuggeree = enCours
    ? Math.max(
        1,
        Math.round((ctx.now.getTime() - new Date(enCours.debut).getTime()) / 60_000),
      )
    : exercice.dureeEstimeeMin;

  // Contexte du tuteur pour le tiroir — même assemblage que la page /tuteur.
  const etatInitialTuteur = await construireEtatInitialTuteur(ctx, exercice.id);
  const codesCompetences = ctx.etats.map((e) => e.skill.code);
  const domainesExistants = ctx.referentiel.domaines.map((d) => ({
    id: d.id,
    nom: d.nom,
    prefixe: d.prefixe,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <LienRetour href="/exercices" libelle="Tous les exercices" />

      {/*
        Abandon : aucune preuve écrite, et il faut le dire.

        Le silence serait pire que le zéro qu'on vient de refuser d'écrire —
        l'utilisateur croirait sa mesure enregistrée. On annonce ce qui n'a pas
        été fait, et pourquoi (P3 : aucune valeur sans source, y compris quand
        la valeur est « rien »).

        Exclusif avec le bandeau « Preuve enregistrée » ci-dessous — un seul
        verdict sur cette tentative peut être vrai, l'URL ne doit pas pouvoir
        afficher les deux.
      */}
      {abandon === "1" && bilan !== "1" && (
        <BandeauInfo ton="info" className="mb-4">
        <div>
          <p className="text-sm font-medium text-info">Aucune preuve enregistrée</p>
          <p className="mt-1 text-xs text-texte-attenue">
            {abandonDelibere ? (
              <>
                Tu as clos cette tentative sans la mener à son terme : elle est marquée
                comme abandonnée. Un abandon n&apos;est pas un échec — un échec est une
                mesure, il suppose qu&apos;on ait essayé. Ton niveau sur{" "}
                {exercice.competences.join(", ")} est inchangé.
              </>
            ) : (
              <>
                La tentative a duré moins d&apos;un quart de la durée estimée
                ({exercice.dureeEstimeeMin} min) sans être réussie : elle est marquée comme
                abandonnée. En tirer un niveau reviendrait à confondre « pas mesuré » et
                « raté » — ton niveau sur{" "}
                {exercice.competences.join(", ")} est inchangé.
              </>
            )}
          </p>
          <p className="mt-1 text-xs text-texte-discret">
            La tentative reste au journal : elle explique pourquoi aucune difficulté
            n&apos;est conseillée pour le prochain exercice.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link href={`/exercices/${exercice.id}`} className={classesLienBouton("principal", "petite")}>
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
              className={classesLienBouton("secondaire", "petite")}
            >
              En demander un autre au tuteur
            </Link>
          </div>
        </div>
        </BandeauInfo>
      )}

      {/* Bilan après enregistrement */}
      {bilan === "1" && derniereTerminee && (
        <BandeauInfo ton="succes" className="mb-4">
        <div>
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
              className={classesLienBouton("secondaire", "petite")}
            >
              Voir l&apos;effet sur la compétence
            </Link>
            <Link href="/" className={classesLienBouton("secondaire", "petite")}>
              Prochaine action recommandée
            </Link>
          </div>
        </div>
        </BandeauInfo>
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
        {foldEnonce ? (
          <PanneauPliable ouvertParDefaut={false} titre={<span className="text-sm font-medium">Énoncé</span>}>
            <div className="px-4 py-3.5 text-sm">
              <Markdown contenu={exercice.enonce} />
            </div>
          </PanneauPliable>
        ) : (
          <Carte>
            <EnTeteCarte titre="Énoncé" />
            <div className="px-4 py-3.5 text-sm">
              <Markdown contenu={exercice.enonce} />
            </div>
          </Carte>
        )}

        {/* -------------------------------- Données ------------------------- */}
        {exercice.donnees && exercice.donnees.length > 0 && (
          foldEnonce ? (
            <PanneauPliable ouvertParDefaut={false} titre={<span className="text-sm font-medium">Données</span>}>
              <ul className="divide-y divide-bordure">
                {exercice.donnees.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-baseline justify-between gap-3 px-4 py-2">
                    <span className="text-xs text-texte-attenue">{d.libelle}</span>
                    <span className="chiffres text-sm font-medium">{d.valeur}</span>
                  </li>
                ))}
              </ul>
            </PanneauPliable>
          ) : (
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
          )
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
                <BoutonSoumission variante="principal">
                  Commencer
                  <IconeFleche className="size-4" />
                </BoutonSoumission>
              </form>
            </div>
          </Carte>
        )}

        {enCours && (
          <>
            {/*
              Ta réponse — vivante dans l'acte Chercher, repliée dès que la
              correction devient visible (Comparer, Mesurer). L'édition reste
              possible une fois repliée : rien n'interdit de continuer à
              préciser sa méthode en comparant à la correction, seul le poids
              visuel du bloc change.
            */}
            <PanneauPliable
              ouvertParDefaut={!correctionVisible}
              titre={<span className="text-sm font-medium">Ta réponse</span>}
              sousEntete={
                <p className="mt-0.5 text-xs text-texte-attenue">
                  Rédige ta méthode, pas seulement le résultat final
                </p>
              }
            >
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
                    competencesModale={competencesPourModale(ctx.referentiel.actifs)}
                    calibragesModale={calibragesPourModale(ctx.referentiel.actifs, ctx.calibrations)}
                    libelle="Demander de l'aide au tuteur sur cet exercice"
                  />{" "}
                  — il aura l&apos;énoncé et ton brouillon sous les yeux. Il ne donnera pas
                  d&apos;indice plus explicite que ceux que tu as laissés fermés.
                </p>
              </div>
            </PanneauPliable>

            {/*
              Indices — repliés par défaut dès l'acte Chercher (secondaires à
              la résolution elle-même), ouverts d'office si déjà entamés et
              que la correction n'est pas encore sortie.
            */}
            {exercice.indices.length > 0 && (
              <PanneauPliable
                ouvertParDefaut={!correctionVisible && enCours.indicesUtilises > 0}
                titre={
                  <span className="text-sm font-medium">
                    Indices — {enCours.indicesUtilises} / {exercice.indices.length} consulté
                    {enCours.indicesUtilises > 1 ? "s" : ""}
                  </span>
                }
                actions={
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
                pied={
                  enCours.indicesUtilises < exercice.indices.length && (
                    <div className="border-t border-bordure px-4 py-3">
                      <form action={debloquerIndice.bind(null, enCours.id, enCours.indicesUtilises)}>
                        <BoutonSoumission variante="secondaire" taille="petite">
                          <IconeAmpoule className="size-3.5" />
                          Débloquer l&apos;indice {enCours.indicesUtilises + 1}
                        </BoutonSoumission>
                      </form>
                    </div>
                  )
                }
              >
                <div className="px-4 py-3">
                  {enCours.indicesUtilises === 0 ? (
                    <p className="text-xs text-texte-attenue">
                      Aucun indice consulté. Si tu résous l&apos;exercice ainsi, la preuve sera
                      enregistrée en autonomie A3.
                    </p>
                  ) : (
                    <ul className="space-y-2">
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
                </div>
              </PanneauPliable>
            )}

            {/* -------------------- Acte : Chercher (teaser) ----------------- */}
            {!correctionVisible && (
              <Carte>
                <div className="px-4 py-3.5">
                  <p className="text-sm font-medium">Correction</p>
                  <p className="mt-1 text-xs text-texte-attenue">
                    Elle reste masquée tant que tu ne l&apos;ouvres pas. La révéler ne pénalise pas
                    ton autonomie — seuls les indices comptent — mais cherche d&apos;abord.
                  </p>
                  <Link
                    href={`/exercices/${exercice.id}?correction=1`}
                    className={cx(classesLienBouton("principal"), "mt-3")}
                  >
                    Afficher la correction
                    <IconeFleche className="size-4" />
                  </Link>
                </div>
              </Carte>
            )}

            {/*
              -------------------- Acte : Comparer ---------------------------
              Correction visible, réponse et indices repliés (ci-dessus).
              L'auto-évaluation n'apparaît qu'après un clic explicite — avant
              ce chantier, révéler la correction affichait AUSSI le formulaire
              de bilan dans le même geste.
            */}
            {correctionVisible && !enMesure && (
              <>
                <FocusActe cle="comparer" cible="titre-comparer" />
                <Carte>
                  <EnTeteCarte
                    id="titre-comparer"
                    titre="Correction"
                    legende="Compare ta méthode, pas seulement ton résultat"
                  />
                  <div className="px-4 py-3.5 text-sm">
                    <Markdown contenu={exercice.correction} />
                  </div>
                </Carte>
                <Carte accent>
                  <div className="px-4 py-3.5">
                    <p className="text-sm">
                      Relis ta méthode à côté de la correction. Quand tu es prêt, passe à
                      l&apos;auto-évaluation — c&apos;est cette étape qui produit la preuve.
                    </p>
                    <Link
                      href={`/exercices/${exercice.id}?evaluer=1`}
                      className={cx(classesLienBouton("principal"), "mt-3")}
                    >
                      Passer à l&apos;auto-évaluation
                      <IconeFleche className="size-4" />
                    </Link>
                  </div>
                </Carte>
              </>
            )}

            {/*
              -------------------- Acte : Mesurer ----------------------------
              Énoncé, données, réponse, indices et correction sont tous
              repliés (foldEnonce plus haut, PanneauPliable ci-dessus) : seul
              le formulaire de bilan — ou le blocage qui l'empêche — reste
              déployé.

              La condition `reponseSuffisante` porte sur `enCours.reponse` —
              ce que la BASE porte — et non sur le texte à l'écran :
              `zone-reponse.tsx` exige un « Enregistrer le brouillon »
              explicite. D'où le message, qui nomme le bouton plutôt que
              l'intention.

              Mesuré le 07/08/2026 : 16 des 37 tentatives terminées n'avaient
              aucune réponse. La règle change donc réellement le parcours, et
              sa sortie est le bouton « Abandonner » rendu en pied de section —
               disponible dans les trois actes, sans coûter la révélation de la
               correction.
            */}
            {enMesure && (
              <>
                <FocusActe cle="mesurer" cible="titre-mesurer" />
                <PanneauPliable
                  ouvertParDefaut={false}
                  titre={<span className="text-sm font-medium">Correction</span>}
                  sousEntete={
                    <p className="mt-0.5 text-xs text-texte-attenue">
                      Compare ta méthode, pas seulement ton résultat
                    </p>
                  }
                >
                  <div className="px-4 py-3.5 text-sm">
                    <Markdown contenu={exercice.correction} />
                  </div>
                </PanneauPliable>

                {reponseSuffisante(enCours.reponse) ? (
                  <Carte accent>
                    <EnTeteCarte
                      id="titre-mesurer"
                      titre="Auto-évaluation"
                      legende="C'est cette étape qui produit la preuve"
                    />
                    <div className="px-4 py-3.5">
                      {/*
                        `BilanAssiste` lance la relecture puis rend le même
                        `FormulaireBilan`, pré-rempli. En cas d'échec — 503,
                        fournisseur sans outils, verdict illisible — il rend le
                        formulaire NU avec la raison. Le chemin manuel n'est
                        donc jamais perdu.
                      */}
                      <BilanAssiste
                        exercice={exercice}
                        attemptId={enCours.id}
                        dureeSuggeree={dureeSuggeree}
                        indicesUtilises={enCours.indicesUtilises}
                        compteId={ctx.donnees.user.id}
                      />
                    </div>
                  </Carte>
                ) : (
                  <Carte>
                    <EnTeteCarte
                      id="titre-mesurer"
                      titre="Auto-évaluation"
                      legende="Elle attend ta réponse écrite"
                    />
                    <div className="px-4 py-3.5">
                      <p className="text-xs text-texte-attenue">
                        {motifBlocageBilan(enCours.reponse)}
                      </p>
                      <p className="mt-2 text-xs text-texte-discret">
                        Si tu ne veux pas mener cet exercice, clos-le franchement : aucune
                        preuve ne sera écrite, et ton niveau restera inchangé. Le bouton
                        « Abandonner cette tentative » est disponible en bas de page, dans
                        les trois actes.
                      </p>
                    </div>
                  </Carte>
                )}
              </>
            )}

            {/*
              -------------------- Pied de section — Abandonner -----------------
              Disponible dans les trois actes, quel que soit l'état du brouillon.
              Abandonner ne doit pas coûter la révélation de la correction (audit
              §2.2) : ce n'est pas une sortie qu'on atteint en traversant Comparer,
              c'est une sortie qui existe toujours. Et symétriquement, dès qu'un
              brouillon suffisant existe, le bouton ne doit pas disparaître.
            */}
            <Carte className="border-dashed">
              <EnTeteCarte
                titre="Abandonner cette tentative"
                legende="Aucune preuve ne sera écrite, ton niveau reste inchangé"
              />
              <div className="px-4 py-3.5">
                <p className="text-xs text-texte-attenue">
                  Tu peux clore cette tentative à tout moment, depuis n&apos;importe lequel des
                  trois actes, que ta réponse soit rédigée ou non. La tentative reste au
                  journal : elle explique pourquoi aucune difficulté n&apos;est conseillée pour
                  le prochain exercice.
                </p>
                <div className="mt-3">
                  <BoutonAbandon
                    attemptId={enCours.id}
                    exerciceId={exercice.id}
                    dureeMin={dureeSuggeree}
                    codes={exercice.competences}
                  />
                </div>
              </div>
            </Carte>
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

            {/*
              Le verdict archivé (ADR-046). C'est la moitié de la raison de le
              persister : la seconde est que le tuteur le retrouve, mais la
              première est que la personne puisse le relire — un conseil qu'on
              ne peut consulter qu'une fois, au moment où l'on valide, n'est pas
              un conseil.
            */}
            {derniereTerminee.verdictTuteur && (
              <Carte>
                <EnTeteCarte
                  titre="Ce que le tuteur avait relevé"
                  legende={`Verdict du ${formatDateCourte(derniereTerminee.verdictTuteur.date)}`}
                />
                <div className="px-4 py-3.5">
                  <BilanRedigeVue
                    bilan={derniereTerminee.verdictTuteur.bilan}
                    titre="Sa lecture de ta réponse"
                    legende="Il proposait ; c'est ton auto-évaluation qui a été enregistrée."
                  />
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
                  <BoutonSoumission variante="secondaire">
                    Refaire cet exercice
                  </BoutonSoumission>
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
