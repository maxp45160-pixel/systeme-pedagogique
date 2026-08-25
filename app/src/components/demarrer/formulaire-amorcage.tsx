"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { IconeAmpoule, IconeFleche, IconeValide } from "@/components/ui/icones";
import { ReglagesTuteur } from "@/components/tuteur/reglages-tuteur";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { DemarrerTour, TOUR_DEMARRER_ID } from "@/components/onboarding/demarrer-tour";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import { AssistantOrientationProfil } from "@/components/profil/assistant-orientation-profil";
import {
  PREFERENCES_APPRENTISSAGE,
  SUGGESTIONS_DOMAINES,
  type ProfilSynthetise,
  type SuggestionDomaine,
} from "@/lib/domain/assistant-orientation";
import {
  orientationAmorcage,
  type OrientationAmorcage,
} from "@/lib/domain/intention";
import { useIntention } from "@/components/intention/contexte-intention";
import { urlPremierTest } from "@/lib/domain/navigation-exercice";

export function FormulaireAmorcage({
  objectifMoyenTerme,
  objectifLongTerme,
  compteId,
  cleServeurConfiguree = false,
  quotaRestant = null,
}: {
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  compteId: string;
  /** Une clé est configurée côté serveur : la génération marche sans clé navigateur. */
  cleServeurConfiguree?: boolean;
  /**
   * Générations encore offertes ce mois-ci sur la clé serveur (ADR-116).
   *
   * `null` quand la question ne se pose pas — administrateur, ou aucune ligne
   * d'accès. Zéro est une réponse, pas une absence : c'est le cas où la clé
   * serveur existe mais ne peut plus servir ce compte.
   */
  quotaRestant?: number | null;
}) {
  const router = useRouter();
  const { lancerTour } = useOnboarding();
  const { ouvrir: ouvrirIntention } = useIntention();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [validationOuverte, setValidationOuverte] = useState(false);

  const [modeGuide, setModeGuide] = useState(true);

  const [sujet, setSujet] = useState("");
  const [intention, setIntention] = useState(objectifMoyenTerme);

  /*
   * L'orientation projet / référentiel est un choix de la personne : la
   * présélection vient d'une heuristique locale sur sa phrase, mais un clic
   * sur une puce la fige. Elle part ensuite comme INDICE au tuteur (aucun
   * recadrage déterministe ne s'y attache) — jamais comme contrainte.
   */
  const [orientationManuelle, setOrientationManuelle] = useState<OrientationAmorcage | null>(null);
  const orientation: OrientationAmorcage =
    orientationManuelle ?? orientationAmorcage(intention);
  const [pointDeDepart, setPointDeDepart] = useState("");
  const [preferencesChoisies, setPreferencesChoisies] = useState<string[]>([
    "Pratiquer d'abord",
    "Des cas concrets",
  ]);

  const [cleConfiguree, setCleConfiguree] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setCleConfiguree(Boolean(lireConfigTuteur(compteId)));
    }, 0);
    return () => window.clearTimeout(id);
  }, [compteId]);
  const [panneauCleOuvert, setPanneauCleOuvert] = useState(false);

  /*
   * La clé peut venir du navigateur (localStorage, par compte) OU du serveur
   * (variables d'environnement). La génération ne se propose que si l'une des
   * deux existe : sans ce test AVANT soumission, le clic échouait après coup
   * à chaque maillon — premier risque d'abandon avant la première preuve.
   *
   * Depuis ADR-116, la clé serveur n'est disponible que tant qu'il reste du
   * quota : sans ce second test, le bouton resterait actif pour renvoyer un
   * 402 en pleine génération — exactement l'échec après coup qu'on évite ici.
   */
  const quotaServeurOuvert = quotaRestant === null || quotaRestant > 0;
  const serveurDisponible = cleServeurConfiguree && quotaServeurOuvert;
  const cleDisponible = cleConfiguree || serveurDisponible;

  /*
   * Le bloc « clé IA » ne s'affiche que s'il y a une décision à prendre.
   *
   * Quand le serveur génère et que le quota tient, il n'y en a aucune : montrer
   * le statut d'une clé d'API tierce, et un bouton pour la changer, à quelqu'un
   * qui vient déclarer ce qu'il veut apprendre, c'est de la plomberie sur le
   * premier écran du produit. Les réglages restent dans « Compte et réglages ».
   */
  const quotaEpuise = cleServeurConfiguree && quotaRestant === 0;
  const cleADecider = !serveurDisponible;

  const sujetValide = sujet.trim().length > 2;
  const intentionValide = intention.trim().length > 2;
  const pret = sujetValide && intentionValide;

  function choisirExemple(ex: SuggestionDomaine) {
    setSujet(ex.sujetExemple);
    setIntention(ex.objectifExemple);
    if (ex.pointDeDepartExemple) setPointDeDepart(ex.pointDeDepartExemple);
    if (ex.preferencesExemples) setPreferencesChoisies(ex.preferencesExemples);
    setModeGuide(false);
  }

  function basculerPreference(pref: string) {
    setPreferencesChoisies((prev) =>
      prev.includes(pref) ? prev.filter((p) => p !== pref) : [...prev, pref],
    );
  }

  /*
   * La synthèse du diagnostic guidé reste DANS le parcours guidé (25/08/2026).
   *
   * Elle basculait le formulaire en « saisie directe » : la personne qui
   * venait de répondre aux trois questions se retrouvait devant TOUTES les
   * zones déjà remplies à retraverser pour trouver le bouton d'action — un
   * écran déjà rempli, exactement ce qu'un récapitulatif ne doit pas être.
   * Désormais : les champs sont alimentés en silence (ils servent au profil et
   * à la modale), le profil déclaré part sur le clic « Appliquer et enregistrer
   * mon profil » du guidé — une confirmation humaine explicite — et la
   * validation du référentiel s'ouvre directement. Rien ne s'écrit sans elle.
   */
  function appliquerSyntheseOrientation(profil: ProfilSynthetise) {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: profil.formation?.trim() || undefined,
          objectifMoyenTerme: profil.intentionDeDepart.trim(),
          objectifLongTerme: objectifLongTerme || undefined,
          preferencesPedagogiques: profil.preferencesPedagogiques,
        });
        setSujet(profil.sujet);
        setIntention(profil.intentionDeDepart);
        setPointDeDepart(profil.formation);
        setPreferencesChoisies(profil.preferencesPedagogiques);
        if (orientationAmorcage(profil.intentionDeDepart) === "projet") {
          ouvrirIntention({ besoinInitial: profil.intentionDeDepart.trim(), contexte: "projet" });
        } else {
          setValidationOuverte(true);
        }
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: pointDeDepart.trim() || undefined,
          objectifMoyenTerme: intention.trim(),
          objectifLongTerme: objectifLongTerme || undefined,
          preferencesPedagogiques: preferencesChoisies,
        });
        if (orientation === "projet") {
          /*
           * « Mener un projet précis » : la phrase part à la traduction avec
           * l'indice `projet` — le tuteur choisit librement le genre, et
           * l'écran de résultat rejoint les surfaces existantes (parcours de
           * projet, fiche, référentiel). Le compte reste vierge : rien n'est
           * écrit avant sa confirmation.
           */
          ouvrirIntention({ besoinInitial: intention.trim(), contexte: "projet" });
        } else {
          setValidationOuverte(true);
        }
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* En-tête guidé pas-à-pas */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primaire/15 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            Étape 1 sur 3 · Votre axe d&apos;apprentissage
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => lancerTour(TOUR_DEMARRER_ID)}
            className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primaire hover:underline cursor-pointer touch-manipulation"
          >
            <span>Visite guidée</span>
          </button>
          <span className="text-xs text-texte-discret">·</span>
          <span className="text-xs text-texte-discret">2 minutes pour commencer</span>
        </div>
      </div>

      {/*
        État de la clé IA — affiché seulement quand il y a un choix à faire.

        Trois situations, et une seule justifie ce bloc :
         - le serveur génère et le quota tient → rien, le bloc disparaît ;
         - le quota est épuisé → il faut sa propre clé pour continuer ;
         - aucune clé nulle part → c'est un blocage, il doit être expliqué.
      */}
      {cleADecider && (
      <div
        data-tour="cle-ia"
        className="rounded-xl border border-bordure bg-surface px-4 py-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cx(
                "size-2 rounded-full",
                cleConfiguree ? "bg-succes" : "bg-avertissement",
              )}
            />
            <span className="text-xs font-medium text-texte">
              {cleConfiguree
                ? "Clé IA configurée (prête à générer)"
                : quotaEpuise
                  ? "Générations offertes épuisées ce mois-ci"
                  : "Clé IA non configurée (Mistral, Groq gratuit, Anthropic)"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPanneauCleOuvert((v) => !v)}
            className="text-xs font-medium text-primaire hover:underline"
          >
            {panneauCleOuvert ? "Fermer les réglages" : cleConfiguree ? "Modifier la clé" : "Renseigner ma clé IA"}
          </button>
        </div>

        {quotaEpuise && !cleConfiguree && (
          <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
            Le compteur repart le 1er du mois. Pour continuer maintenant,
            renseignez votre propre clé : elle est gratuite chez Mistral comme
            chez Groq, et n&apos;est alors plus décomptée.
          </p>
        )}

        {panneauCleOuvert && (
          <div className="mt-3 border-t border-bordure/60 pt-3">
            {/*
              Le panneau reste ouvert après l'enregistrement : fermer au même
              tick démontait ReglagesTuteur avant tout rendu, et le message
              « Clé enregistrée avec succès » n'apparaissait jamais. La
              confirmation reste visible ; l'utilisateur referme lui-même.
            */}
            <ReglagesTuteur
              compteId={compteId}
              compact
              surEnregistre={() => setCleConfiguree(true)}
            />
          </div>
        )}
      </div>
      )}

      {/* Commutateur de mode (Assistant interactif vs Saisie directe) */}
      <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2/40 border border-bordure/70 p-1.5">
        <button
          type="button"
          onClick={() => setModeGuide(true)}
          className={cx(
            "min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all text-center touch-manipulation",
            modeGuide
              ? "bg-surface text-texte shadow-xs font-semibold"
              : "text-texte-attenue hover:text-texte",
          )}
        >
          Diagnostic guidé (3 questions simples)
        </button>
        <button
          type="button"
          onClick={() => setModeGuide(false)}
          className={cx(
            "min-h-11 flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all text-center touch-manipulation",
            !modeGuide
              ? "bg-surface text-texte shadow-xs font-semibold"
              : "text-texte-attenue hover:text-texte",
          )}
        >
          Saisie directe
        </button>
      </div>

      {modeGuide ? (
        <AssistantOrientationProfil
          sujetInitial={sujet}
          formationInitiale={pointDeDepart}
          preferencesInitiales={preferencesChoisies}
          surSyntheseAppliquee={appliquerSyntheseOrientation}
        />
      ) : (
        <>
          {/* Chips d'exemples d'inspiration */}
          <div
            data-tour="exemples-inspiration"
            className="rounded-xl border border-bordure/80 bg-surface-2/60 p-4"
          >
            <p className="text-xs font-medium text-texte mb-2 flex items-center gap-1.5">
              <IconeAmpoule className="size-3.5 text-primaire" />
              <span>Exemples, pour remplir en un clic :</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS_DOMAINES.map((dom) => (
                <button
                  key={dom.id}
                  type="button"
                  onClick={() => choisirExemple(dom)}
                  className={cx(
                    "inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all shadow-xs",
                    sujet === dom.sujetExemple
                      ? "border-primaire bg-primaire/15 text-primaire font-semibold"
                      : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                  )}
                >
                  <span>{dom.nom}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Formulaire avec indicateurs d'étapes */}
          <div className="space-y-5">
            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 border border-bordure text-[0.6875rem] font-mono">
                    1
                  </span>
                  Ce que vous étudiez
                </span>
                {sujetValide && (
                  <span className="text-xs font-medium text-primaire flex items-center gap-1">
                    <IconeValide className="size-3.5" />
                    Prêt
                  </span>
                )}
              </div>
              <Champ
                label=""
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Ex : macroéconomie, statistiques, développement web"
                aide="Avec vos propres mots — vous pouvez en lister plusieurs, séparés par des virgules. Le tuteur IA les découpera ensuite en compétences mesurables ; cette intention déclarée ne constitue pas encore une mesure."
              />
            </div>

            <div className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 border border-bordure text-[0.6875rem] font-mono">
                    2
                  </span>
                  Ce que vous voulez pouvoir faire
                </span>
                {intentionValide && (
                  <span className="text-xs font-medium text-primaire flex items-center gap-1">
                    <IconeValide className="size-3.5" />
                    Prêt
                  </span>
                )}
              </div>
              <Champ
                label=""
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                placeholder="Ex : réussir mes partiels, préparer un concours, mener un projet en autonomie…"
                aide="Écrivez-le avec vos mots. Le système traduit cette intention en compétences puis en exercices ; vous n’avez pas à définir de cible ni de parcours."
              />

              {/* Indice d'orientation — la personne tranche, le tuteur reste libre. */}
              <div className="mt-3.5">
                <p className="mb-1.5 text-[0.6875rem] font-medium text-texte-attenue">
                  Pour commencer, vous voulez plutôt…
                </p>
                <div
                  role="radiogroup"
                  aria-label="Orientation de départ"
                  className="flex flex-wrap gap-2"
                >
                  {(
                    [
                      {
                        valeur: "referentiel",
                        libelle: "Organiser des compétences à faire monter",
                      },
                      { valeur: "projet", libelle: "Mener un projet précis" },
                    ] as const
                  ).map(({ valeur, libelle }) => {
                    const selectionne = orientation === valeur;
                    return (
                      <label
                        key={valeur}
                        className={cx(
                            "inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all shadow-xs",
                          selectionne
                            ? "border-primaire bg-primaire/15 text-primaire font-semibold ring-1 ring-primaire/30"
                            : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                        )}
                      >
                        <input
                          type="radio"
                          name="orientation-amorcage"
                          checked={selectionne}
                          onChange={() => setOrientationManuelle(valeur)}
                          className="sr-only"
                        />
                        <span
                          aria-hidden
                          className={cx(
                            "size-2 rounded-full border transition-colors",
                            selectionne ? "border-primaire bg-primaire" : "border-texte-discret bg-transparent",
                          )}
                        />
                        <span>{libelle}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[0.6875rem] text-texte-discret">
                  Un simple point de départ : le tuteur reste libre et vous proposera ce qui colle le mieux.
                </p>
              </div>
            </div>

            {/* Section 3 : Style d'apprentissage et point de départ */}
            <div
              data-tour="style-apprentissage"
              className="relative rounded-xl border border-bordure/80 bg-surface-2/40 p-4 space-y-3.5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-texte flex items-center gap-1.5">
                  <span className="flex size-5 items-center justify-center rounded-full bg-surface border border-bordure text-[0.6875rem] font-mono">
                    3
                  </span>
                  Votre style d&apos;apprentissage (calibrage direct du tuteur IA)
                </span>
                <span className="text-[0.6875rem] text-texte-discret">
                  Optionnel · Sélection en 1 clic
                </span>
              </div>

              <div>
                <label className="text-[0.6875rem] font-medium text-texte-attenue mb-1.5 block">
                  Comment préférez-vous apprendre ?
                </label>
                <div className="flex flex-wrap gap-2">
                  {PREFERENCES_APPRENTISSAGE.map((pref) => {
                    const selectionne = preferencesChoisies.includes(pref.libelle);
                    return (
                      <button
                        key={pref.id}
                        type="button"
                        onClick={() => basculerPreference(pref.libelle)}
                        className={cx(
                          "inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-all shadow-xs",
                          selectionne
                            ? "border-primaire bg-primaire/15 text-primaire font-semibold ring-1 ring-primaire/30"
                            : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte hover:bg-surface-2",
                        )}
                      >
                        <span>{pref.libelle}</span>
                        {selectionne && <IconeValide className="size-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Champ
                  label="Votre point de départ / contexte (facultatif)"
                  value={pointDeDepart}
                  onChange={(e) => setPointDeDepart(e.target.value)}
                  placeholder="Ex : étudiant en licence, débutant complet, junior, reconversion..."
                  aide="Transmis au tuteur pour qu'il adapte son vocabulaire et ses analogies sans inventer de diplôme."
                />
              </div>
            </div>
          </div>

          {erreur && (
            <BandeauInfo ton="alerte" taille="compacte">
              <p className="text-alerte">{erreur}</p>
            </BandeauInfo>
          )}

          {/* Bouton d'action interactif */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-bordure/60">
            <div className="flex flex-wrap items-center gap-3">
              <Bouton
                onClick={soumettre}
                disabled={!pret || enCours || !cleDisponible}
                variante="principal"
                title={
                  cleDisponible
                    ? undefined
                    : "Configurez d'abord une clé IA pour générer le référentiel"
                }
                className={cx(
                  "group px-5 py-2.5 shadow-md transition-all",
                  pret && cleDisponible && "ring-2 ring-primaire/30",
                )}
              >
                <span>{enCours ? "Préparation en cours…" : "Préparer mon point de départ"}</span>
                <IconeFleche className="size-3.5 transition-transform group-hover:translate-x-1" />
              </Bouton>

              {!pret && (
                <span className="text-xs text-texte-discret">
                  Remplissez le sujet et votre intention pour continuer.
                </span>
              )}
              {pret && !cleDisponible && (
                <button
                  type="button"
                  onClick={() => setPanneauCleOuvert(true)}
                  className="text-xs font-medium text-primaire hover:underline"
                >
                  Renseigner ma clé IA pour continuer
                </button>
              )}
            </div>

            <span className="text-xs text-texte-discret">
              Rien n&apos;est enregistré sans votre validation.
            </span>
          </div>
        </>
      )}

      {validationOuverte && (
        <ModaleReferentiel
          compteId={compteId}
          sujetInitial={sujet.trim()}
          demarrageAutomatique
          cleDisponible={cleDisponible}
          demarrageProgressif
          guideEtape="Étape 2 sur 3 : le tuteur propose plusieurs axes, mais un seul est coché. Validez ce point de départ pour passer directement à un premier test."
          onFermer={() => setValidationOuverte(false)}
          surEnregistre={({ codes }) => {
            router.replace(urlPremierTest(codes[0]));
          }}
        />
      )}

      {/* Visite guidée dynamique pour /demarrer */}
      <DemarrerTour afficherEtapeCle={cleADecider} />
    </div>
  );
}
