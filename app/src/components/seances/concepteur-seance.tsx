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
import { BandeauInfo, Bouton, Carte, cx, Etiquette } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { Modale } from "@/components/ui/modale";
import type {
  BesoinDeclare,
  DemandeSeance,
  Exercise,
  ExerciseAttempt,
  Referentiel,
  Skill,
  SkillState,
} from "@/lib/domain/types";
import {
  EXERCICES_PAR_SEANCE_MAX,
  EXERCICES_PAR_SEANCE_MIN,
  motifRefusBesoin,
  motifRefusDemande,
  TEMPS_DECLARE_MAX,
} from "@/lib/domain/seance";
import { DUREE_ESTIMEE_MIN } from "@/lib/domain/exercice";
import { themeVersThemeSeance, themesEnregistres, type Theme } from "@/lib/domain/theme";
import {
  composerSeance,
  nombreExercicesConseille,
  themePourDomaine,
  themesSuggeres,
  type ActiviteComposee,
  type CompositionSeance,
  type ManquantSeance,
  type ThemeSeance,
} from "@/lib/engine/caf";
import type { Calibration } from "@/lib/engine/calibration";
import type { ResumeObservationsDocumentaires } from "@/lib/engine/document-context";
import type { Recommandation } from "@/lib/engine/recommend";
import {
  creerSeance,
  type EntreePlanification,
} from "@/lib/store/seance-actions";
import { ModaleExercice } from "@/components/exercices/modale-exercice";
import {
  competencesPourModale,
  type CalibrageModale,
  type CompetenceModale,
} from "@/components/exercices/proprietes-generation";

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
  /** Thèmes enregistrés du compte (chantier « thèmes », ADR-053). */
  themes: Theme[];
  compteId: string;
  /** Pré-remplit le compositeur (ex. « Refaire cette séance »). */
  preset?: PresetSeance;
  /** Domaine déclaré dans la fiche qui a lancé la composition. */
  domaineInitial?: string;
  /** Contexte déclaré dans la fiche qui a lancé la composition. */
  contexteInitial?: string;
  /** Thème choisi dans la fiche qui a lancé la composition. */
  themeInitial?: Theme;
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
  themes,
  compteId,
  preset,
  domaineInitial,
  contexteInitial,
  themeInitial,
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

  /*
   * Référentiel « léger », reconstruit côté client à partir des seules pièces
   * déjà envoyées par le serveur (`actifs`) — pour convertir le thème choisi
   * sans faire porter au client un `Referentiel` complet. Seuls `codesActifs`
   * et `parCode` sont lus par cette conversion ; les autres champs restent
   * vides, structurellement présents mais inertes.
   */
  const referentielLeger: Referentiel = useMemo(
    () => ({
      domaines: [],
      skills: actifs,
      actifs,
      parCode: new Map(actifs.map((s) => [s.code, s])),
      codesActifs: new Set(actifs.map((s) => s.code)),
      domainesParId: new Map(),
    }),
    [actifs],
  );

  const themeDuThemeInitial = useMemo(
    () => (themeInitial ? themeVersThemeSeance(themeInitial, referentielLeger) : null),
    [themeInitial, referentielLeger],
  );

  /**
   * Le sujet choisi à la main, qui prime sur toutes les sources dérivées.
   *
   * Le compositeur affichait « Le sujet est déjà choisi » et n'offrait aucun
   * moyen d'en changer : ouvert sans code, il retombait sur la tête du
   * classement, et la seule sortie pour travailler autre chose était de fermer
   * la modale et de repasser par un autre écran. Une valeur dérivée reste
   * modifiable — c'est la règle du reste de cet écran (le nombre d'exercices,
   * le temps), elle manquait au sujet lui-même.
   */
  const [themeChoisi, setThemeChoisi] = useState<ThemeSeance | null>(null);

  /** Les thèmes enregistrés du compte, convertis en portées de séance. */
  const themesDuCompte = useMemo(
    () => themesEnregistres(themes, referentielLeger),
    [themes, referentielLeger],
  );

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
    themeDuThemeInitial ??
    themeDuDomaine ??
    themeSansSujet ??
    (sansThemeInitial ? null : themesSug[0] ?? null);

  const theme = themePrincipal;

  const [temps, setTemps] = useState(
    String(preset?.dureeCibleMin ?? TEMPS_PAR_DEFAUT),
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
    const codesVises =
      theme?.portee.type === "theme" ? theme.portee.codes : theme?.codesImposes ?? [];
    const themeId = theme?.portee.type === "theme" ? theme.portee.themeId : undefined;

    return {
      ...(intention.trim() ? { intention: intention.trim() } : {}),
      codesVises,
      tempsDisponibleMin: tempsMin,
      declareLe: new Date().toISOString(),
      ...(themeId ? { themeId } : {}),
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
      };
      const id = await creerSeance(entree, demarrer ? "en-cours" : "planifiee");
      await surSeanceCreee?.({ id, activites: entree.activites, codesVises: besoin.codesVises });
      if (demarrer) {
        router.push(`/seances?session=${id}&focus=1`);
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
                    : themeDuThemeInitial
                      ? "Thème choisi"
                      : themeDuDomaine
                        ? "Domaine choisi"
                        : themeSansSujet
                          ? "Aucun sujet imposé"
                          : "Prochaine action"
              }
              suggestions={themesSug}
              themesEnregistres={themesDuCompte}
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
              planifieePour={planifieePour}
              setPlanifieePour={setPlanifieePour}
              enregistrement={enregistrement}
              erreur={erreur}
              planifier={() => enregistrer(false)}
              onDeclencherGeneration={(cibles) => setGenerationCibles(cibles)}
            />
          )}
        </Modale>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 — le thème et le temps                                      */
/* ------------------------------------------------------------------ */

/**
 * Un sujet proposé au choix, avec son détail.
 *
 * Le détail n'est pas décoratif : c'est lui qui distingue « Tout le domaine
 * Logistique » d'une compétence isolée du même domaine, et qui dit d'où vient
 * la suggestion. Un libellé seul rendrait deux portées très différentes
 * indiscernables (P3).
 */
function BoutonSujet({
  sujet,
  actif,
  surChoisir,
}: {
  sujet: ThemeSeance;
  actif: boolean;
  surChoisir: (sujet: ThemeSeance) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => surChoisir(sujet)}
      aria-pressed={actif}
      className={cx(
        "block w-full rounded-lg border px-3 py-2 text-left transition-colors",
        actif
          ? "border-primaire bg-primaire-faible"
          : "border-bordure bg-surface hover:border-primaire/35 hover:bg-primaire-faible/35",
      )}
    >
      <span className="block text-xs font-medium">{sujet.libelle}</span>
      <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">{sujet.detail}</span>
    </button>
  );
}

function ListeSujets({
  titre,
  sujets,
  actif,
  surChoisir,
  vide,
}: {
  titre: string;
  sujets: ThemeSeance[];
  /** Clé du sujet courant, pour le marquer sans le rendre deux fois. */
  actif: string;
  surChoisir: (sujet: ThemeSeance) => void;
  /** Phrase affichée quand la liste est vide. Absente : la section disparaît. */
  vide?: string;
}) {
  if (sujets.length === 0 && !vide) return null;
  return (
    <div className="space-y-2">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
        {titre}
      </p>
      {sujets.length === 0 ? (
        <p className="text-xs text-texte-discret">{vide}</p>
      ) : (
        <div className="space-y-1.5">
          {sujets.map((sujet) => (
            <BoutonSujet
              key={sujet.cle}
              sujet={sujet}
              actif={sujet.cle === actif}
              surChoisir={surChoisir}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EtapeBesoin({
  themePrincipal,
  sourceTheme,
  suggestions,
  themesEnregistres: themesDuCompte,
  themesDeDomaine,
  themesDeCompetence,
  surChoisirTheme,
  temps,
  setTemps,
  conseil,
  intention,
  setIntention,
  intentionOuverte,
  setIntentionOuverte,
  erreur,
}: {
  themePrincipal: ThemeSeance | null;
  sourceTheme: string;
  suggestions: ThemeSeance[];
  themesEnregistres: ThemeSeance[];
  themesDeDomaine: ThemeSeance[];
  themesDeCompetence: ThemeSeance[];
  surChoisirTheme: (theme: ThemeSeance | null) => void;
  temps: string;
  setTemps: (v: string) => void;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  intention: string;
  setIntention: (v: string) => void;
  intentionOuverte: boolean;
  setIntentionOuverte: (v: boolean) => void;
  erreur: string | null;
}) {
  // Déclarés avant toute sortie anticipée : l'ordre des hooks ne se négocie pas.
  const [choixOuvert, setChoixOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");

  const q = recherche.trim().toLowerCase();
  /*
   * La recherche ne porte que sur les compétences : les trois autres listes
   * sont courtes et se lisent d'un coup d'œil, là où le référentiel actif peut
   * compter des dizaines d'entrées. Sans filtre, choisir une compétence précise
   * redeviendrait l'inventaire à trier que cet écran a supprimé.
   */
  const competencesFiltrees = q
    ? themesDeCompetence
        .filter(
          (t) =>
            t.libelle.toLowerCase().includes(q) || t.detail.toLowerCase().includes(q),
        )
        .slice(0, 12)
    : [];

  if (!themePrincipal) {
    return (
      <div className="space-y-3 pt-2">
        <Carte>
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">Aucun thème à proposer</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-texte-attenue">
              Le moteur n&apos;a rien à recommander : soit le référentiel est vide, soit
              toutes les compétences actives ont été écartées récemment.
            </p>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {/* Hero Card thématique */}
      <div className="rounded-xl border border-primaire/30 bg-gradient-to-br from-surface to-surface-2 p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-primaire-faible px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">
            {sourceTheme}
          </span>
        </div>
        <h3 className="mt-2 text-base font-semibold tracking-tight text-texte">
              {themePrincipal.libelle}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
          {themePrincipal.detail}
        </p>
        <button
          type="button"
          onClick={() => setChoixOuvert((ouvert) => !ouvert)}
          className="mt-2 text-xs text-primaire underline-offset-2 hover:underline"
          aria-expanded={choixOuvert}
        >
          {choixOuvert
            ? "Garder ce sujet"
            : sourceTheme === "Aucun sujet imposé"
              ? "Choisir un sujet"
              : "Choisir un autre sujet"}
        </button>
      </div>

      {choixOuvert && (
        <div className="space-y-4 rounded-xl border border-bordure bg-surface-2 p-4">
          <ListeSujets
            titre="Ce que le moteur recommande"
            sujets={suggestions}
            actif={themePrincipal.cle}
            surChoisir={(theme) => {
              surChoisirTheme(theme);
              setChoixOuvert(false);
            }}
          />
          <ListeSujets
            titre="Tes thèmes enregistrés"
            sujets={themesDuCompte}
            actif={themePrincipal.cle}
            surChoisir={(theme) => {
              surChoisirTheme(theme);
              setChoixOuvert(false);
            }}
            vide="Aucun thème enregistré pour l'instant."
          />
          <ListeSujets
            titre="Un domaine entier"
            sujets={themesDeDomaine}
            actif={themePrincipal.cle}
            surChoisir={(theme) => {
              surChoisirTheme(theme);
              setChoixOuvert(false);
            }}
          />
          <div className="space-y-2">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Une compétence précise
            </p>
            <input
              type="search"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              placeholder="Filtrer par intitulé ou par code…"
              className="w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-xs placeholder:text-texte-discret focus:border-primaire focus:outline-none"
            />
            {q && competencesFiltrees.length === 0 && (
              <p className="text-xs text-texte-discret">
                Aucune compétence active ne correspond.
              </p>
            )}
            {competencesFiltrees.length > 0 && (
              <div className="space-y-1.5">
                {competencesFiltrees.map((sujet) => (
                  <BoutonSujet
                    key={sujet.cle}
                    sujet={sujet}
                    actif={sujet.cle === themePrincipal.cle}
                    surChoisir={(theme) => {
                      surChoisirTheme(theme);
                      setChoixOuvert(false);
                      setRecherche("");
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sélection du temps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Temps disponible pour la séance
          </label>
          <span className="text-xs font-mono font-medium text-primaire">
            {temps} minutes
          </span>
        </div>

        {/* Puces de presets rapides */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { temps: 15, titre: "15 min", badge: "Express" },
            { temps: 30, titre: "30 min", badge: "Équilibré" },
            { temps: 45, titre: "45 min", badge: "Approfondi" },
            { temps: 60, titre: "60 min", badge: "Standard" },
          ].map((preset) => {
            const actif = temps === String(preset.temps);
            return (
              <button
                key={preset.temps}
                type="button"
                onClick={() => setTemps(String(preset.temps))}
                className={cx(
                  "flex flex-col items-center justify-center rounded-xl border p-2.5 transition-all cursor-pointer text-center",
                  actif
                    ? "border-primaire bg-primaire-faible/70 text-primaire ring-1 ring-primaire shadow-xs font-semibold"
                    : "border-bordure bg-surface hover:bg-surface-2 text-texte-attenue hover:text-texte",
                )}
              >
                <span className="text-xs font-bold">
                  {preset.titre}
                </span>
                <span className="mt-0.5 text-[0.625rem] text-texte-discret">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>

        <Champ
          label="Durée personnalisée (minutes)"
          type="number"
          min={DUREE_ESTIMEE_MIN}
          max={TEMPS_DECLARE_MAX}
          value={temps}
          onChange={(e) => setTemps(e.target.value)}
          aide={
            conseil
              ? conseil.explication
              : "Aucune durée de référence observée : tu fixeras le nombre d'exercices à l'étape suivante."
          }
        />
      </div>

      {/* Intention facultative */}
      {intentionOuverte ? (
        <div className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs">
          <Champ
            label="Pourquoi cette séance ? (facultatif)"
            multiligne
            rows={2}
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Ex. : Révision avant l'examen de vendredi, focus sur les biais..."
            aide="Conservée telle quelle dans ton journal de travail."
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIntentionOuverte(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-primaire hover:underline cursor-pointer"
        >
          <span>+</span>
          <span>Ajouter une note d&apos;intention (facultatif)</span>
        </button>
      )}

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-xs text-danger">{erreur}</p>
        </BandeauInfo>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 2 — ce que le moteur propose                                  */
/* ------------------------------------------------------------------ */

function EtapeComposition({
  composition,
  theme,
  tempsMin,
  conseil,
  nombreExercices,
  refusDemande,
  setNombreExercices,
  planifieePour,
  setPlanifieePour,
  enregistrement,
  erreur,
  planifier,
  onDeclencherGeneration,
}: {
  composition: CompositionSeance | null;
  theme: ThemeSeance | null;
  tempsMin: number;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  nombreExercices: number;
  refusDemande: string | null;
  setNombreExercices: (v: number) => void;
  planifieePour: string;
  setPlanifieePour: (v: string) => void;
  enregistrement: boolean;
  erreur: string | null;
  planifier: () => void;
  onDeclencherGeneration: (cibles: { codeInitial: string; codes?: string[] }) => void;
}) {
  if (!theme) return null;

  if (!composition) {
    return (
      <div className="space-y-4 pt-2">
        <BandeauInfo ton="danger">
          <p className="text-xs text-danger">
            {refusDemande ?? "Cette composition est incohérente. Reviens au besoin et ajuste la durée."}
          </p>
        </BandeauInfo>
      </div>
    );
  }

  const vide = composition.activites.length === 0 && composition.manquants.length === 0;
  const sansExerciceDisponible = composition.activites.length === 0;
  const dureeRetenue = composition.activites.reduce((acc, a) => acc + a.dureeEstimeeMin, 0);

  return (
    <div className="space-y-5 pt-2">
      {/* En-tête : rappel du thème + sélecteur d'exercices */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-bordure bg-surface-2/50 p-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-primaire-faible px-2 py-0.5 text-[0.6875rem] font-semibold text-primaire">
              {theme.cle === "sans-sujet" ? "Sujet libre" : "Thème ciblé"}
            </span>
          </div>
          <p className="mt-1 text-sm font-semibold text-texte">{theme.libelle}</p>
          <p className="text-xs text-texte-discret">{theme.detail}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <label className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Exercices demandés
            </label>
            <div className="mt-1 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setNombreExercices(
                    Math.max(EXERCICES_PAR_SEANCE_MIN, nombreExercices - 1),
                  )
                }
                disabled={nombreExercices <= EXERCICES_PAR_SEANCE_MIN}
                aria-label="Moins d'exercices"
                className="flex size-7 items-center justify-center rounded-lg border border-bordure bg-surface text-sm font-bold text-texte transition-colors hover:bg-surface-2 disabled:opacity-40 cursor-pointer"
              >
                −
              </button>
              <span className="w-8 text-center font-mono text-sm font-bold">
                {nombreExercices}
              </span>
              <button
                type="button"
                onClick={() =>
                  setNombreExercices(
                    Math.min(EXERCICES_PAR_SEANCE_MAX, nombreExercices + 1),
                  )
                }
                disabled={nombreExercices >= EXERCICES_PAR_SEANCE_MAX}
                aria-label="Plus d'exercices"
                className="flex size-7 items-center justify-center rounded-lg border border-bordure bg-surface text-sm font-bold text-texte transition-colors hover:bg-surface-2 disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>
            {conseil && (
              <span className="mt-0.5 text-[0.625rem] text-texte-discret">
                Conseillé : {conseil.nombre}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grille de 3 métriques de synthèse */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {/* Exercices disponibles */}
        <div className="rounded-xl border border-bordure bg-surface p-3 shadow-xs">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Exercices prêts
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cx(
                "font-mono text-xl font-bold",
                composition.activites.length > 0 ? "text-succes" : "text-alerte",
              )}
            >
              {composition.activites.length}
            </span>
            <span className="text-xs text-texte-attenue">
              / {nombreExercices} demandé{nombreExercices > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-[0.6875rem] text-texte-discret">
            {composition.activites.length === 0
              ? "0 déjà en bibliothèque"
              : `${composition.activites.length} prêt${composition.activites.length > 1 ? "s" : ""} à jouer`}
          </p>
        </div>

        {/* Durée estimée */}
        <div className="rounded-xl border border-bordure bg-surface p-3 shadow-xs">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            Durée retenue
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-xl font-bold text-texte">
              {dureeRetenue} min
            </span>
            <span className="text-xs text-texte-attenue">/ cible {tempsMin} min</span>
          </div>
          <p className="mt-1 text-[0.6875rem] text-texte-discret">
            {composition.manquants.length > 0
              ? `+ ${composition.manquants.length} exercice${composition.manquants.length > 1 ? "s" : ""} à créer`
              : "Durée calibrée"}
          </p>
        </div>

        {/* À rédiger */}
        <div
          className={cx(
            "rounded-xl border p-3 shadow-xs",
            composition.manquants.length > 0
              ? "border-primaire/40 bg-primaire-faible/30"
              : "border-succes/40 bg-succes-faible/30",
          )}
        >
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
            À rédiger avec l&apos;IA
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={cx(
                "font-mono text-xl font-bold",
                composition.manquants.length > 0 ? "text-primaire" : "text-succes",
              )}
            >
              {composition.manquants.length}
            </span>
            <span className="text-xs text-texte-attenue">
              manquant{composition.manquants.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="mt-1 text-[0.6875rem] text-texte-discret">
            {composition.manquants.length > 0
              ? "Génération IA en 1 clic"
              : "Tous les exercices sont prêts"}
          </p>
        </div>
      </div>

      {/* Liste des exercices retenus */}
      {composition.activites.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Exercices retenus ({composition.activites.length})
            </h4>
            <span className="text-[0.6875rem] font-medium text-succes">
              Prêts pour la séance
            </span>
          </div>
          <div className="space-y-2">
            {composition.activites.map((a) => (
              <LigneActivite key={a.ref} activite={a} />
            ))}
          </div>
        </div>
      )}

      {/* Section des exercices à rédiger / manquants */}
      {composition.manquants.length > 0 && (
        <div className="space-y-3 rounded-xl border border-primaire/30 bg-surface p-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h4 className="flex items-center gap-1.5 text-sm font-semibold text-texte">
                <span>À rédiger</span>
                <span className="rounded-full bg-primaire-faible px-2 py-0.5 text-xs font-bold text-primaire">
                  {composition.manquants.length} manquant
                  {composition.manquants.length > 1 ? "s" : ""}
                </span>
              </h4>
              <p className="mt-0.5 text-[0.6875rem] text-texte-attenue">
                Génère et valide ces exercices avec le tuteur pour les intégrer à ta séance.
              </p>
            </div>
            <Bouton
              type="button"
              onClick={() => {
                onDeclencherGeneration({
                  codeInitial: composition.manquants[0].code,
                  codes: composition.manquants.map((m) => m.code),
                });
              }}
              variante="principal"
              className="cursor-pointer text-xs shadow-xs"
            >
              <span>Générer les {composition.manquants.length} exercices manquants</span>
            </Bouton>
          </div>

          <div className="space-y-2 pt-1">
            {composition.manquants.map((m) => (
              <LigneManquant
                key={m.code}
                manquant={m}
                onGenerer={() => {
                  onDeclencherGeneration({
                    codeInitial: m.code,
                    codes: [m.code],
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bandeau d'état et d'orientation */}
      {sansExerciceDisponible && !vide && (
        <BandeauInfo ton="alerte" taille="compacte">
          <p className="text-xs">
            <strong>Il manque des exercices :</strong> rien n&apos;est encore prêt pour ce thème.
            Cliquez sur <strong>Générer les exercices manquants</strong> ci-dessus pour en créer.
          </p>
        </BandeauInfo>
      )}

      {vide && (
        <Carte>
          <div className="px-4 py-8 text-center text-xs text-texte-attenue">
            Aucune compétence à travailler dans ce périmètre : choisis un autre thème.
          </div>
        </Carte>
      )}

      {/* Planifier pour plus tard */}
      <details className="rounded-xl border border-bordure bg-surface p-3 transition-all">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-texte-attenue hover:text-texte">
          <span>Planifier pour plus tard plutôt que démarrer maintenant</span>
        </summary>
        <div className="mt-3 border-t border-bordure pt-3 space-y-3">
          <Champ
            label="Date et heure prévues"
            type="datetime-local"
            value={planifieePour}
            onChange={(e) => setPlanifieePour(e.target.value)}
            aide="La séance apparaîtra dans l'historique en « Planifiée », prête à démarrer."
          />
          <div className="flex justify-end">
            <Bouton
              type="button"
              variante="secondaire"
              onClick={planifier}
              enChargement={enregistrement}
              disabled={vide || sansExerciceDisponible}
            >
              Planifier sans démarrer
            </Bouton>
          </div>
        </div>
      </details>

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-xs text-danger">{erreur}</p>
        </BandeauInfo>
      )}
    </div>
  );
}

function LigneActivite({ activite }: { activite: ActiviteComposee }) {
  return (
    <div className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs transition-colors hover:border-primaire/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Etiquette mono ton="primaire">
              {activite.code}
            </Etiquette>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-texte-attenue">
              Difficulté {activite.difficulte}/5
            </span>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-texte-attenue">
              ≈ {activite.dureeEstimeeMin} min
            </span>
          </div>
          <h5 className="mt-1.5 text-sm font-semibold text-texte">{activite.libelle}</h5>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">{activite.raison}</p>
        </div>
      </div>
    </div>
  );
}

function LigneManquant({
  manquant,
  onGenerer,
}: {
  manquant: ManquantSeance;
  onGenerer: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-dashed border-bordure bg-surface-2/40 p-3 transition-colors hover:border-primaire/40">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Etiquette mono>{manquant.code}</Etiquette>
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] text-texte-discret">
            Difficulté cible {manquant.difficulteCible}/5
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-texte">{manquant.intitule}</p>
        <p className="mt-0.5 text-[0.6875rem] text-texte-attenue">{manquant.raison}</p>
      </div>
      <div className="shrink-0">
        <Bouton
          type="button"
          taille="petite"
          variante="secondaire"
          onClick={onGenerer}
          className="w-full sm:w-auto text-xs cursor-pointer"
        >
          <span>Générer</span>
        </Bouton>
      </div>
    </div>
  );
}

