"use client";

/**
 * Concepteur de séance — deux gestes, pas un formulaire.
 *
 * ## Ce qui a été retiré, et pourquoi
 *
 * La première version demandait quatre choses avant de composer : une phrase
 * d'intention rédigée, un temps, **une sélection dans une liste de 77 cases à
 * cocher**, puis un écran de portée/nombre, puis un écran de date. Cinq
 * décisions et trois écrans pour lancer une séance de travail — le formulaire
 * coûtait plus cher que la séance qu'il préparait, et la liste de compétences
 * transformait « je veux bosser ce sujet » en inventaire à trier.
 *
 * Il en reste deux : **un thème** (pré-sélectionné sur la prochaine action) et
 * **un temps**. Tout le reste est dérivé et affiché avec sa source :
 *
 *  - les compétences visées viennent du thème (`themesSuggeres`, qui lit le
 *    même classement que la carte « Prochaine meilleure action » — les deux ne
 *    peuvent pas diverger, ADR-049) ;
 *  - le nombre d'exercices vient du temps (`nombreExercicesConseille`, médiane
 *    des durées **observées**, ADR-045) ;
 *  - la portée vient du thème.
 *
 * Rien n'est perdu : chaque valeur dérivée reste modifiable à l'étape de
 * composition, et l'intention rédigée survit en champ facultatif replié.
 *
 * ## Ce qui n'a pas bougé
 *
 * Aucune logique n'est recopiée ici : `composerSeance` compose, `motifRefusBesoin`
 * valide (la même fonction que le serveur), `creerSeance` écrit. Et **rien
 * n'est écrit avant la validation finale** (D3, ADR-037) : un manquant se
 * génère par la modale existante, se relit, et la séance n'est persistée qu'au
 * clic « Démarrer » ou « Planifier ».
 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bouton, cx } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import type {
  BesoinDeclare,
  DemandeSeance,
  Exercise,
  ExerciseAttempt,
  Skill,
  SkillState,
} from "@/lib/domain/types";
import {
  EXERCICES_PAR_SEANCE_MAX,
  EXERCICES_PAR_SEANCE_MIN,
  motifRefusBesoin,
  motifRefusDemande,
} from "@/lib/domain/seance";
import { DUREE_ESTIMEE_MIN } from "@/lib/domain/exercice";
import {
  composerSeance,
  nombreExercicesConseille,
  themePourDomaine,
  themesSuggeres,
  type CompositionSeance,
  type ThemeSeance,
} from "@/lib/engine/caf";
import type { Calibration } from "@/lib/engine/calibration";
import type { ResumeObservationsDocumentaires } from "@/lib/engine/document-context";
import type { Recommandation } from "@/lib/engine/recommend";
import {
  creerSeance,
  type EntreePlanification,
} from "@/lib/store/seance-actions";
import { EtapeBesoin } from "./etape-besoin";
import { EtapeComposition } from "./etape-composition";
import { ModaleExercice } from "@/components/exercices/modale-exercice";
import {
  competencesPourModale,
  type CalibrageModale,
  type CompetenceModale,
} from "@/lib/domain/proprietes-generation";

/** Temps proposé par défaut, en minutes. Modifiable au premier écran. */
const TEMPS_PAR_DEFAUT = 60;

export interface PresetSeance {
  libelle?: string;
  codesVises: string[];
  nombreExercices: number;
  dureeCibleMin: number;
  /** Présent : séance mono-domaine. Absent : transverse. */
  domaine?: string;
}

export interface DonneesSeance {
  etats: SkillState[];
  actifs: Skill[];
  exercices: Exercise[];
  tentatives: ExerciseAttempt[];
  /** Calibrages sérialisés — reconstitués en `Map` au rendu. */
  calibrations: [string, Calibration][];
  calibragesModale: Record<string, CalibrageModale>;
  /**
   * Le classement du moteur, sérialisé, d'où sortent les thèmes suggérés.
   *
   * On passe les recommandations et non les seuls codes : `themesSuggeres` a
   * besoin de l'intitulé et du domaine pour écrire ses libellés, et les relire
   * ici depuis `etats` reviendrait à refaire à la main ce que le moteur a déjà
   * assemblé.
   */
  recommandations: Recommandation[];
  /** Résumés documentaires sérialisables, issus du même contexte serveur. */
  contexteDocumentaire: [string, ResumeObservationsDocumentaires][];
  domaines: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Pré-remplit le compositeur (ex. « Refaire cette séance »). */
  preset?: PresetSeance;
  /**
   * Durée lue dans la demande (`?temps=`, ou relue dans l'intention).
   *
   * Elle ne fabrique pas de preset : elle remplace seulement le défaut du
   * champ temps quand ni `preset` ni la personne n'ont parlé avant elle.
   */
  dureeInitiale?: number;
  /** Domaine déclaré dans la fiche qui a lancé la composition. */
  domaineInitial?: string;
  /** Contexte déclaré dans la fiche qui a lancé la composition. */
  contexteInitial?: string;
  /** Ouvre une séance générale sans sélectionner la première recommandation. */
  sansThemeInitial?: boolean;
  /** Libellé du bouton déclencheur. */
  libelle?: string;
  /** Le bouton occupe toute la largeur de son conteneur. */
  pleineLargeur?: boolean;
  /** Variante visuelle du bouton. */
  variante?: "principal" | "secondaire" | "discret" | "danger";
  /** Classe CSS additionnelle pour le bouton. */
  className?: string;
  /** Icône facultative affichée dans le bouton. */
  icone?: ReactNode;
  /**
   * Ouvre la composition sans passer par le bouton.
   *
   * Sert à l'espace de travail d'une note « séance d'exercices » : capturer
   * cette note EST la demande de composer. Faire cliquer une fois de plus
   * ajouterait un geste sans rien décider.
   */
  ouvertParDefaut?: boolean;
  /**
   * Refermer le compositeur ramène à l'écran d'où l'on vient.
   *
   * Réservé au compositeur ouvert par un lien (`/seances?composer=1`) : on y
   * arrive depuis le tableau de bord, un exercice, une fiche — et renoncer à
   * composer doit rendre la main à cet écran-là, pas laisser sur une URL de
   * composition qui ne compose plus rien.
   *
   * Repli sur le cahier quand il n'y a pas d'historique (lien ouvert dans un
   * onglet neuf) : `router.back()` sortirait alors de l'application.
   */
  retourEnFermant?: boolean;
  /**
   * Appelé après l'écriture de la séance, avant toute navigation.
   *
   * Sert à la note opérationnelle qui a déclenché la composition : elle y
   * inscrit ses wikiliens vers les exercices retenus et les compétences visées.
   * Une erreur ici n'annule pas la séance — elle est déjà écrite, et prétendre
   * le contraire serait mentir sur l'état réel.
   */
  surSeanceCreee?: (seance: {
    id: string;
    activites: { type: string; ref: string; libelle: string }[];
    codesVises: string[];
  }) => Promise<void> | void;
}

type Phase = "besoin" | "composition";

export function ConcepteurSeance({
  etats,
  actifs,
  exercices,
  tentatives,
  calibrations,
  calibragesModale,
  recommandations,
  contexteDocumentaire: contexteDocumentaireSerialise,
  domaines,
  compteId,
  preset,
  dureeInitiale,
  domaineInitial,
  contexteInitial,
  sansThemeInitial = false,
  libelle = "Composer une séance",
  pleineLargeur = false,
  variante = "principal",
  className,
  icone,
  surSeanceCreee,
  ouvertParDefaut = false,
  retourEnFermant = false,
}: DonneesSeance) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  const [phase, setPhase] = useState<Phase>("besoin");
  const [generationCibles, setGenerationCibles] = useState<{
    codeInitial: string;
    codes?: string[];
    /** Budget de la séance : le tuteur calibre les durées des manquants dessus. */
    dureeCibleMin?: number;
  } | null>(null);

  function fermer() {
    setOuvert(false);
    if (!retourEnFermant) return;
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/seances");
  }

  const nomsDomaines = useMemo(
    () => new Map(domaines.map((d) => [d.id, d.nom])),
    [domaines],
  );
  const themesSug = useMemo(
    () => themesSuggeres(recommandations, nomsDomaines),
    [recommandations, nomsDomaines],
  );

  /*
   * Un preset (« Refaire cette séance ») n'est pas une recommandation : il vient
   * d'une séance passée et reste donc prioritaire sur les autres sources.
   */
  const themeDuPreset: ThemeSeance | null = useMemo(() => {
    if (!preset) return null;
    return {
      cle: "preset",
      libelle: preset.libelle ?? "La même séance",
      detail: `${preset.codesVises.length} compétence(s) · ${preset.dureeCibleMin} min`,
      portee: preset.domaine
        ? { type: "mono", domaine: preset.domaine }
        : { type: "transverse", domaines: domaines.map((d) => d.id) },
      codesImposes: preset.codesVises,
    };
  }, [preset, domaines]);

  const themeDuDomaine: ThemeSeance | null = useMemo(() => {
    if (!domaineInitial) return null;
    const domaine = domaines.find((item) => item.id === domaineInitial);
    return domaine ? themePourDomaine(domaine.id, domaine.nom) : null;
  }, [domaineInitial, domaines]);

  /**
   * Le sujet choisi à la main, qui prime sur toutes les sources dérivées.
   */
  const [themeChoisi, setThemeChoisi] = useState<ThemeSeance | null>(null);

  /** Un domaine entier — la portée la plus large qu'on puisse viser. */
  const themesDeDomaine = useMemo(
    () => domaines.map((d) => themePourDomaine(d.id, d.nom)),
    [domaines],
  );

  const themeSansSujet = useMemo<ThemeSeance | null>(() => {
    if (!sansThemeInitial) return null;
    const domainesActifs = [...new Set(actifs.map((skill) => skill.domaine))].filter((id) =>
      domaines.some((domaine) => domaine.id === id),
    );
    if (domainesActifs.length === 0) return null;
    return {
      cle: "sans-sujet",
      libelle: "Aucun thème imposé",
      detail: "Le moteur choisira dans les compétences actives ; tu peux cibler un sujet si tu le souhaites.",
      portee: { type: "transverse", domaines: domainesActifs },
      codesImposes: [],
    };
  }, [actifs, domaines, sansThemeInitial]);

  /**
   * N'importe quelle compétence active, visée seule.
   *
   * `codesImposes` et non une portée de thème : viser une compétence précise,
   * c'est demander cette compétence-là, pas le domaine qui la contient.
   */
  const themesDeCompetence = useMemo(
    () =>
      actifs.map((skill) => ({
        cle: `competence:${skill.code}`,
        libelle: skill.intitule,
        detail: `${skill.code} · ${nomsDomaines.get(skill.domaine) ?? skill.domaine}`,
        portee: { type: "mono" as const, domaine: skill.domaine },
        codesImposes: [skill.code],
      })),
    [actifs, nomsDomaines],
  );

  /**
   * Le sujet choisi dans le premier formulaire passe avant la recommandation
   * globale : l'intention explicite de la personne borne la séance. Le domaine
   * reste le repli des anciennes fiches qui n'ont pas encore de thème.
   */
  const themePrincipal: ThemeSeance | null =
    themeChoisi ??
    themeDuPreset ??
    themeDuDomaine ??
    themeSansSujet ??
    (sansThemeInitial ? null : themesSug[0] ?? null);

  const theme = themePrincipal;

  const [temps, setTemps] = useState(
    String(preset?.dureeCibleMin ?? dureeInitiale ?? TEMPS_PAR_DEFAUT),
  );
  const [intention, setIntention] = useState(contexteInitial ?? "");
  const [intentionOuverte, setIntentionOuverte] = useState(Boolean(contexteInitial?.trim()));

  const [nombreExercices, setNombreExercices] = useState(() =>
    Math.min(
      EXERCICES_PAR_SEANCE_MAX,
      Math.max(EXERCICES_PAR_SEANCE_MIN, preset?.nombreExercices ?? 3),
    ),
  );
  const [nombreTouche, setNombreTouche] = useState(Boolean(preset));

  const [planifieePour, setPlanifieePour] = useState("");
  // Mode épreuve : décision de composition, posée une fois à l'écriture.
  const [modeEpreuve, setModeEpreuve] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const calibMap = useMemo(() => new Map(calibrations), [calibrations]);
  const contexteDocumentaire = useMemo(
    () => new Map(contexteDocumentaireSerialise),
    [contexteDocumentaireSerialise],
  );
  const tempsMin = Math.max(DUREE_ESTIMEE_MIN, Number(temps) || TEMPS_PAR_DEFAUT);

  const conseil = useMemo(
    () => nombreExercicesConseille(tempsMin, exercices, tentatives),
    [tempsMin, exercices, tentatives],
  );

  // `demande` est reconstruite À L'INTÉRIEUR du memo : un objet littéral change
  // de référence à chaque rendu, ce qui recalculerait `composerSeance` (non
  // gratuit — il parcourt tout le classement) même quand rien n'a changé.
  const demande = useMemo<DemandeSeance | null>(() => {
    if (!theme) return null;
    return {
      dureeCibleMin: tempsMin,
      nombreExercices,
      portee: theme.portee,
      codesImposes: theme.codesImposes,
    };
  }, [theme, tempsMin, nombreExercices]);
  const refusDemande = demande ? motifRefusDemande(demande) : null;
  const composition: CompositionSeance | null = useMemo(() => {
    if (!demande || motifRefusDemande(demande)) return null;
    return composerSeance(
      demande,
      etats,
      exercices,
      tentatives,
      calibMap,
      new Date(),
      undefined,
      contexteDocumentaire,
    );
  }, [demande, etats, exercices, tentatives, calibMap, contexteDocumentaire]);

  const competencesModale: CompetenceModale[] = useMemo(
    () => competencesPourModale(actifs),
    [actifs],
  );

  function ouvrir() {
    setErreur(null);
    setPhase("besoin");
    setOuvert(true);
  }

  function besoinCourant(): BesoinDeclare {
    const codesVises = theme?.codesImposes ?? [];

    return {
      ...(intention.trim() ? { intention: intention.trim() } : {}),
      codesVises,
      tempsDisponibleMin: tempsMin,
      declareLe: new Date().toISOString(),
    };
  }

  function passerComposition() {
    const refus = motifRefusBesoin(besoinCourant());
    if (refus) {
      setErreur(refus);
      return;
    }
    if (!nombreTouche && conseil) setNombreExercices(conseil.nombre);
    setErreur(null);
    setPhase("composition");
  }

  /**
   * Écrit la séance, puis la démarre si on la veut tout de suite.
   */
  async function enregistrer(demarrer: boolean) {
    if (!composition) return;
    const besoin = besoinCourant();
    const refus = motifRefusBesoin(besoin);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      const entree: EntreePlanification = {
        besoin,
        blueprint: composition.blueprint,
        activites: composition.activites.map((a) => ({
          type: a.type,
          ref: a.ref,
          libelle: a.libelle,
        })),
        ...(planifieePour && !demarrer
          ? { planifieePour: new Date(planifieePour).toISOString() }
          : {}),
        ...(modeEpreuve ? { modeEpreuve: true } : {}),
      };
      const id = await creerSeance(entree, demarrer ? "en-cours" : "planifiee");
      await surSeanceCreee?.({ id, activites: entree.activites, codesVises: besoin.codesVises });
      if (demarrer) {
        router.push(`/seances?session=${id}&focus=1&sas=1`);
        router.refresh();
      } else {
        router.refresh();
      }
      setOuvert(false);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible d'enregistrer la séance.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <>
      <Bouton
        variante={variante}
        onClick={ouvrir}
        className={cx(pleineLargeur && "w-full", className)}
      >
        <span>{libelle}</span>
        {icone}
      </Bouton>

      {ouvert && (
        <Modale
          titre="Composer une séance"
          sousTitre="Configure le temps et prépare ton programme de travail sur-mesure."
          onFermer={fermer}
          largeur="3xl"
          pied={
            /*
             * La génération n'a pas de pied à elle : `ModaleExercice` en
             * présentation `inline` porte le sien (générer, accepter, retoucher).
             * Un second pied ici proposerait « Démarrer la séance » pendant
             * qu'on relit un exercice qui n'y est pas encore entré.
             */
            generationCibles ? null : phase === "besoin" ? (
              <div className="flex w-full items-center justify-between gap-2">
                <Bouton type="button" onClick={fermer} variante="secondaire">
                  Annuler
                </Bouton>
                <Bouton
                  type="button"
                  onClick={passerComposition}
                  variante="principal"
                  disabled={theme === null}
                  title={
                    theme !== null
                      ? undefined
                      : "Aucun domaine ou thème exploitable n'est disponible pour composer."
                  }
                >
                  <span>Voir la composition</span>
                  <span aria-hidden>→</span>
                </Bouton>
              </div>
            ) : !theme ? null : !composition ? (
              <Bouton type="button" onClick={() => setPhase("besoin")} variante="secondaire">
                ← Paramètres
              </Bouton>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <Bouton type="button" onClick={() => setPhase("besoin")} variante="secondaire">
                  <span>← Paramètres</span>
                </Bouton>
                <Bouton
                  type="button"
                  onClick={() => enregistrer(true)}
                  enChargement={enregistrement}
                  disabled={composition.activites.length === 0}
                  variante="principal"
                  className="shadow-xs"
                >
                  <span>Démarrer la séance</span>
                </Bouton>
              </div>
            )
          }
        >
          {/* Barre de navigation d'étapes visuelle */}
          <div className="mb-4 flex items-center justify-between border-b border-bordure pb-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGenerationCibles(null);
                  setPhase("besoin");
                }}
                className={cx(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                  phase === "besoin" && !generationCibles
                    ? "bg-primaire text-primaire-contraste shadow-xs"
                    : "bg-surface-2 text-texte-attenue hover:text-texte",
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[0.625rem]">
                  1
                </span>
                <span>Paramètres & Temps</span>
              </button>
              <span className="text-xs text-texte-discret">→</span>
              <button
                type="button"
                onClick={() => {
                  setGenerationCibles(null);
                  passerComposition();
                }}
                disabled={theme === null}
                className={cx(
                  "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  phase === "composition" && !generationCibles
                    ? "bg-primaire text-primaire-contraste shadow-xs"
                    : "bg-surface-2 text-texte-attenue hover:text-texte cursor-pointer",
                )}
              >
                <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[0.625rem]">
                  2
                </span>
                <span>Composition & Exercices</span>
              </button>
              {generationCibles && (
                <>
                  <span className="text-xs text-texte-discret">→</span>
                  <span className="flex items-center gap-2 rounded-full bg-primaire px-3 py-1 text-xs font-semibold text-primaire-contraste shadow-xs">
                    <span className="flex size-4 items-center justify-center rounded-full bg-white/20 text-[0.625rem]">
                      3
                    </span>
                    <span>Rédaction</span>
                  </span>
                </>
              )}
            </div>
            <span className="text-[0.6875rem] font-medium text-texte-discret">
              {generationCibles
                ? "Étape 3/3"
                : phase === "besoin"
                  ? "Étape 1/2"
                  : "Étape 2/2"}
            </span>
          </div>

          {generationCibles ? (
            /*
             * La rédaction des manquants se fait DANS le compositeur, pas dans
             * une seconde modale par-dessus la première : deux surfaces
             * `aria-modal` empilées imbriquent deux pièges de focus et rendent
             * `Échap` ambigu — la touche ferme celle qui a posé son écouteur en
             * dernier, jamais celle qu'on regarde. C'est la raison d'être du
             * mode `inline` de `ModaleExercice`.
             *
             * Chaque acceptation écrit l'exercice puis `router.refresh()` : les
             * props serveur reviennent, `composerSeance` recalcule, et
             * l'exercice passe de « à rédiger » à « retenu » sans rechargement.
             */
            <ModaleExercice
              presentation="inline"
              onFermer={() => setGenerationCibles(null)}
              competences={competencesModale}
              competenceInitiale={generationCibles.codeInitial}
              competencesCibles={generationCibles.codes}
              /*
               * La durée cible de la séance accompagne la demande : sans elle,
               * le tuteur rédigeait des exercices d'une heure pour une séance
               * de quinze minutes — et l'étiquette « ≈ 1 h » s'affichait sur
               * un programme qui devait durer un quart d'heure.
               *
               * Elle transite par `generationCibles`, qui la reçoit de
               * `tempsMin` au moment où les cibles sont posées : une seule
               * voie, plutôt que la même valeur passée deux fois.
               */
              dureeCibleMin={generationCibles.dureeCibleMin}
              calibrages={calibragesModale}
              compteId={compteId}
              surEnregistre={() => {
                router.refresh();
              }}
            />
          ) : phase === "besoin" ? (
            <EtapeBesoin
              themePrincipal={themePrincipal}
              sourceTheme={
                themeChoisi
                  ? "Sujet choisi"
                  : themeDuPreset
                    ? "Séance précédente"
                    : themeDuDomaine
                      ? "Domaine choisi"
                      : themeSansSujet
                        ? "Aucun sujet imposé"
                        : "Prochaine action"
              }
              suggestions={themesSug}
              themesDeDomaine={themesDeDomaine}
              themesDeCompetence={themesDeCompetence}
              surChoisirTheme={setThemeChoisi}
              temps={temps}
              setTemps={setTemps}
              conseil={conseil}
              intention={intention}
              setIntention={setIntention}
              intentionOuverte={intentionOuverte}
              setIntentionOuverte={setIntentionOuverte}
              erreur={erreur}
            />
          ) : (
            <EtapeComposition
              composition={composition}
              theme={theme}
              tempsMin={tempsMin}
              conseil={conseil}
              nombreExercices={nombreExercices}
              refusDemande={refusDemande}
              setNombreExercices={(v) => {
                setNombreTouche(true);
                setNombreExercices(v);
              }}
              modeEpreuve={modeEpreuve}
              setModeEpreuve={setModeEpreuve}
              planifieePour={planifieePour}
              setPlanifieePour={setPlanifieePour}
              enregistrement={enregistrement}
              erreur={erreur}
              planifier={() => enregistrer(false)}
              onDeclencherGeneration={(cibles) =>
                setGenerationCibles({ ...cibles, dureeCibleMin: tempsMin })
              }
            />
          )}
        </Modale>
      )}
    </>
  );
}
