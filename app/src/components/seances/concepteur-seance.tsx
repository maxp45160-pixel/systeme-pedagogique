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

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
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
import { themeVersThemeSeance, type Theme } from "@/lib/domain/theme";
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
import type { ResumePreuvesDocumentaires } from "@/lib/engine/document-context";
import type { Recommandation } from "@/lib/engine/recommend";
import {
  creerSeance,
  type EntreePlanification,
} from "@/lib/store/seance-actions";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
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
  contexteDocumentaire: [string, ResumePreuvesDocumentaires][];
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
  domaineInitial,
  contexteInitial,
  themeInitial,
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
   * Le sujet choisi dans le premier formulaire passe avant la recommandation
   * globale : l'intention explicite de la personne borne la séance. Le domaine
   * reste le repli des anciennes fiches qui n'ont pas encore de thème.
   */
  const themePrincipal: ThemeSeance | null =
    themeDuPreset ?? themeDuThemeInitial ?? themeDuDomaine ?? themesSug[0] ?? null;

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
    // Un thème enregistré n'impose aucun code (voir composerSeance : il
    // fournit une PORTÉE, pas une liste imposée, ADR-053) — mais la personne
    // a explicitement nommé ces compétences en créant le thème, donc elles
    // sont bien ce qu'elle vise. `codesImposes` reste la source pour les
    // thèmes ciblés (une seule compétence, ADR-049).
    const codesVises =
      theme?.portee.type === "theme" ? theme.portee.codes : theme?.codesImposes ?? [];
    const themeId = theme?.portee.type === "theme" ? theme.portee.themeId : undefined;

    return {
      // Absente plutôt que chaîne vide : un champ laissé vide n'est pas une
      // intention déclarée, et `ecartBesoinRealise` ne doit pas afficher des
      // guillemets autour de rien.
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
    // Le nombre proposé s'applique une fois le temps connu — pas à chaque
    // frappe, sinon le champ bougerait sous les yeux pendant la saisie.
    if (!nombreTouche && conseil) setNombreExercices(conseil.nombre);
    setErreur(null);
    setPhase("composition");
  }

  /**
   * Écrit la séance, puis la démarre si on la veut tout de suite.
   *
   * Deux sorties et non deux boutons qui feraient deux choses différentes :
   * « Démarrer » planifie et démarre dans la foulée (le cas courant, celui que
   * « ça part » désigne) ; « Planifier pour plus tard » s'arrête après
   * l'écriture. Une séance planifiée sans date reste démarrable depuis son
   * déroulé — rien n'est enfermé.
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
      // Une écriture, pas « planifier puis démarrer » : si le mode « en-cours »
      // échoue (une autre séance est déjà ouverte), `creerSeance` refuse AVANT
      // d'écrire — aucune séance planifiée orpheline n'est laissée derrière.
      const id = await creerSeance(entree, demarrer ? "en-cours" : "planifiee");
      await surSeanceCreee?.({ id, activites: entree.activites, codesVises: besoin.codesVises });
      if (demarrer) {
        router.push(`/seances?session=${id}`);
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
          sousTitre="Le sujet est déjà choisi. Indique un temps — le reste est dérivé et modifiable."
          onFermer={fermer}
          largeur="2xl"
          /*
           * Les actions sont calculées ici plutôt que dans les étapes : le pied
           * de la modale vit hors du défilement, et la composition est
           * précisément l'écran assez long pour que « Démarrer la séance »
           * finisse hors de vue. Les deux sorties anticipées de
           * `EtapeComposition` sont reproduites à l'identique — sans quoi le
           * pied proposerait de démarrer une séance qui n'existe pas.
           */
          pied={
            phase === "besoin" ? (
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
                Voir la composition
              </Bouton>
            ) : !theme ? null : !composition ? (
              <Bouton type="button" onClick={() => setPhase("besoin")} variante="secondaire">
                Ajuster les paramètres
              </Bouton>
            ) : (
              <div className="flex w-full items-center justify-between gap-2">
                <Bouton type="button" onClick={() => setPhase("besoin")} variante="secondaire">
                  Ajuster les paramètres
                </Bouton>
                <Bouton
                  type="button"
                  onClick={() => enregistrer(true)}
                  enChargement={enregistrement}
                  /*
                   * Une séance sans AUCUN exercice retenu ne peut pas être
                   * écrite : les places « à générer » ne deviennent des
                   * activités qu'une fois créées ET relues dans la composition
                   * (même règle que `motifRefusActivites` côté serveur).
                   */
                  disabled={composition.activites.length === 0}
                  variante="principal"
                >
                  Démarrer la séance
                </Bouton>
              </div>
            )
          }
        >
          {phase === "besoin" ? (
            <EtapeBesoin
              themePrincipal={themePrincipal}
              sourceTheme={
                themeDuPreset
                  ? "Séance précédente"
                  : themeDuThemeInitial
                    ? "Thème choisi"
                    : themeDuDomaine
                      ? "Domaine choisi"
                      : "Prochaine action"
              }
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
              conseil={conseil}
              nombreExercices={nombreExercices}
              refusDemande={refusDemande}
              setNombreExercices={(v) => {
                setNombreTouche(true);
                setNombreExercices(v);
              }}
              planifieePour={planifieePour}
              setPlanifieePour={setPlanifieePour}
              competencesModale={competencesModale}
              calibragesModale={calibragesModale}
              compteId={compteId}
              enregistrement={enregistrement}
              erreur={erreur}
              planifier={() => enregistrer(false)}
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

function EtapeBesoin({
  themePrincipal,
  sourceTheme,
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
  temps: string;
  setTemps: (v: string) => void;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  intention: string;
  setIntention: (v: string) => void;
  intentionOuverte: boolean;
  setIntentionOuverte: (v: boolean) => void;
  erreur: string | null;
}) {
  if (!themePrincipal) {
    return (
      <div className="space-y-3 pt-4">
        <Carte>
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">Aucun thème à proposer</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-texte-attenue">
              Le moteur n&apos;a rien à recommander : soit le référentiel est vide, soit
              toutes les compétences actives ont été écartées récemment. Rien n&apos;est
              proposé par défaut — il n&apos;y aurait aucune raison derrière.
            </p>
          </div>
        </Carte>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-4">
      <Carte>
        <div className="px-4 py-3.5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-primaire">
            {sourceTheme}
          </p>
          <p className="mt-1 text-sm font-medium">{themePrincipal.libelle}</p>
          <p className="mt-0.5 text-[0.6875rem] text-texte-discret">{themePrincipal.detail}</p>
        </div>
      </Carte>

      <div className="space-y-2">
        <label className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
          Temps disponible (minutes)
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            { temps: 15, libelle: "15 min (Express)" },
            { temps: 30, libelle: "30 min (Équilibré)" },
            { temps: 45, libelle: "45 min (Approfondi)" },
            { temps: 60, libelle: "60 min (Standard)" },
          ].map((preset) => (
            <button
              key={preset.temps}
              type="button"
              onClick={() => setTemps(String(preset.temps))}
              className={cx(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
                temps === String(preset.temps)
                  ? "border-primaire bg-primaire-faible text-primaire font-semibold shadow-xs"
                  : "border-bordure bg-surface hover:bg-surface-2 text-texte-attenue hover:text-texte",
              )}
            >
              {preset.libelle}
            </button>
          ))}
        </div>
        <Champ
          label=""
          type="number"
          min={DUREE_ESTIMEE_MIN}
          max={TEMPS_DECLARE_MAX}
          value={temps}
          onChange={(e) => setTemps(e.target.value)}
          aide={
            conseil
              ? conseil.explication
              : "Aucune durée de référence encore observée : tu fixeras le nombre d'exercices à l'étape suivante."
          }
        />
      </div>

      {/*
        L'intention rédigée reste possible, mais repliée et facultative : c'est
        elle qui rendait la composition plus longue que la séance. Son absence
        ne retire rien à l'écart besoin/réalisé, qui compare le thème et le
        temps — pas la phrase.
      */}
      {intentionOuverte ? (
        <Champ
          label="Pourquoi cette séance ? (facultatif)"
          multiligne
          rows={2}
          value={intention}
          onChange={(e) => setIntention(e.target.value)}
          placeholder="Ex. : avant l'examen de jeudi."
          aide="Conservée telle quelle, pour que tu puisses la relire plus tard."
        />
      ) : (
        <button
          type="button"
          onClick={() => setIntentionOuverte(true)}
          className="text-xs text-primaire hover:underline"
        >
          + Noter pourquoi (facultatif)
        </button>
      )}

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
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
  conseil,
  nombreExercices,
  refusDemande,
  setNombreExercices,
  planifieePour,
  setPlanifieePour,
  competencesModale,
  calibragesModale,
  compteId,
  enregistrement,
  erreur,
  planifier,
}: {
  composition: CompositionSeance | null;
  theme: ThemeSeance | null;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  nombreExercices: number;
  refusDemande: string | null;
  setNombreExercices: (v: number) => void;
  planifieePour: string;
  setPlanifieePour: (v: string) => void;
  competencesModale: CompetenceModale[];
  calibragesModale: Record<string, CalibrageModale>;
  compteId: string;
  enregistrement: boolean;
  erreur: string | null;
  planifier: () => void;
}) {
  if (!theme) return null;

  if (!composition) {
    return (
      <div className="space-y-4 pt-4">
        <p role="alert" className="text-xs text-danger">
          {refusDemande ?? "Cette composition est incohérente. Reviens au besoin et ajuste la durée."}
        </p>
      </div>
    );
  }

  const vide = composition.activites.length === 0 && composition.manquants.length === 0;
  // Une séance sans AUCUN exercice retenu ne peut pas être écrite : les places
  // « à générer » ne deviennent des activités qu'une fois créées ET relues dans
  // la composition (même règle que `motifRefusActivites` côté serveur).
  const sansExerciceDisponible = composition.activites.length === 0;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{theme.libelle}</p>
          <p className="text-[0.6875rem] text-texte-discret">{theme.detail}</p>
        </div>
        <div className="w-36 shrink-0">
          <Champ
            label="Exercices"
            type="number"
            min={EXERCICES_PAR_SEANCE_MIN}
            max={EXERCICES_PAR_SEANCE_MAX}
            value={String(nombreExercices)}
            onChange={(e) => setNombreExercices(Math.min(EXERCICES_PAR_SEANCE_MAX, Math.max(EXERCICES_PAR_SEANCE_MIN, Number(e.target.value) || EXERCICES_PAR_SEANCE_MIN)))}
            aide={conseil ? `Conseillé : ${conseil.nombre}` : "À fixer toi-même"}
          />
        </div>
      </div>

      {composition.explication.map((l, i) => (
        <p key={i} className="text-xs text-texte-attenue">
          {l}
        </p>
      ))}

      {composition.activites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Exercices retenus</p>
          {composition.activites.map((a) => (
            <LigneActivite key={a.ref} activite={a} />
          ))}
        </div>
      )}

      {composition.manquants.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              À rédiger — {composition.manquants.length} exercice
              {composition.manquants.length > 1 ? "s" : ""} manquant
              {composition.manquants.length > 1 ? "s" : ""}
            </p>
            {/*
              Un seul bouton pour tout le lot plutôt qu'un par compétence : la
              route et `genererExercices` font déjà un seul appel modèle pour
              N demandes (borné à EXERCICES_PAR_LOT_MAX). Générer un par un
              est une lenteur d'interface, pas une contrainte du moteur.
            */}
            <BoutonGenerer
              competences={competencesModale}
              competenceInitiale={composition.manquants[0].code}
              competencesCibles={composition.manquants.map((m) => m.code)}
              calibrages={calibragesModale}
              compteId={compteId}
              libelle={`Générer les ${composition.manquants.length} exercice${composition.manquants.length > 1 ? "s" : ""} manquant${composition.manquants.length > 1 ? "s" : ""}`}
              variante="secondaire"
            />
          </div>
          {composition.manquants.map((m) => (
            <LigneManquant key={m.code} manquant={m} />
          ))}
          <p className="text-[0.6875rem] text-texte-discret">
            Génère et relis chaque exercice avant de démarrer : rien n&apos;est écrit sans
            ta validation. Les manquants non générés ne feront pas partie de la séance.
          </p>
        </div>
      )}

      {sansExerciceDisponible && !vide && (
        <p role="alert" className="text-xs text-danger">
          Rien ne peut encore démarrer : aucun exercice n&apos;est déjà disponible. Génère
          au moins un exercice manquant, relis-le — il rejoindra la composition — puis
          valide. Les exercices non générés ne font pas partie de la séance.
        </p>
      )}

      {vide && (
        <Carte>
          <div className="px-4 py-8 text-center text-xs text-texte-attenue">
            Aucune compétence à travailler dans ce périmètre : choisis un autre thème.
          </div>
        </Carte>
      )}

      <details className="rounded-md border border-bordure px-3 py-2">
        <summary className="cursor-pointer text-xs text-texte-attenue">
          Planifier pour plus tard plutôt que démarrer maintenant
        </summary>
        <div className="mt-2">
          <Champ
            label="Date et heure prévues"
            type="datetime-local"
            value={planifieePour}
            onChange={(e) => setPlanifieePour(e.target.value)}
            aide="La séance apparaîtra dans l'historique en « Planifiée », prête à démarrer."
          />
          <div className="mt-2">
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
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

    </div>
  );
}

function LigneActivite({ activite }: { activite: ActiviteComposee }) {
  return (
    <div className="rounded-md border border-bordure bg-surface-2/60 p-3">
      <p className="text-sm font-medium">{activite.libelle}</p>
      <p className="mt-0.5 text-xs text-texte-discret">
        {activite.code} · Difficulté {activite.difficulte}/5 · ≈ {activite.dureeEstimeeMin} min
      </p>
      <p className="mt-1 text-xs text-texte-attenue">{activite.raison}</p>
    </div>
  );
}

function LigneManquant({ manquant }: { manquant: ManquantSeance }) {
  return (
    <div className="rounded-md border border-dashed border-bordure p-3">
      <p className="text-sm font-medium">{manquant.intitule}</p>
      <p className="mt-0.5 text-xs text-texte-discret">
        {manquant.code} · difficulté cible {manquant.difficulteCible}/5
      </p>
      <p className="mt-1 text-xs text-texte-attenue">{manquant.raison}</p>
    </div>
  );
}
