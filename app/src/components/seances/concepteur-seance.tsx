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

import { useMemo, useState, useTransition } from "react";
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
import { themesEnregistres, type Theme } from "@/lib/domain/theme";
import {
  composerSeance,
  nombreExercicesConseille,
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
import { etatRetraitTheme, modifierTheme, retirerTheme } from "@/lib/store/theme-actions";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import { ModaleTheme } from "./modale-theme";
import {
  competencesPourModale,
  type CalibrageModale,
  type CompetenceModale,
} from "@/components/exercices/proprietes-generation";

/** Temps proposé par défaut, en minutes. Modifiable au premier écran. */
const TEMPS_PAR_DEFAUT = 60;

export interface PresetSeance {
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
  /** Libellé du bouton déclencheur. */
  libelle?: string;
  /** Le bouton occupe toute la largeur de son conteneur. */
  pleineLargeur?: boolean;
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
  themes: themesPersistes,
  compteId,
  preset,
  libelle = "Composer une séance",
  pleineLargeur = false,
}: DonneesSeance) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [phase, setPhase] = useState<Phase>("besoin");

  const nomsDomaines = useMemo(
    () => new Map(domaines.map((d) => [d.id, d.nom])),
    [domaines],
  );
  const themesSug = useMemo(
    () => themesSuggeres(recommandations, nomsDomaines),
    [recommandations, nomsDomaines],
  );

  /*
   * Un preset (« Refaire cette séance ») n'est pas un thème suggéré : il vient
   * d'une séance passée. Il devient donc un thème à part, placé en tête, pour
   * que le même sélecteur serve les deux cas — plutôt qu'un mode caché où le
   * choix du thème disparaîtrait sans explication.
   */
  const themeDuPreset: ThemeSeance | null = useMemo(() => {
    if (!preset) return null;
    return {
      cle: "preset",
      libelle: "La même séance",
      detail: `${preset.codesVises.length} compétence(s) · ${preset.dureeCibleMin} min`,
      portee: preset.domaine
        ? { type: "mono", domaine: preset.domaine }
        : { type: "transverse", domaines: domaines.map((d) => d.id) },
      codesImposes: preset.codesVises,
    };
  }, [preset, domaines]);

  /**
   * Le premier thème de `themesSug` (ou le preset) EST la prochaine action —
   * c'est la propriété d'ADR-049, inchangée. Ce chantier n'y touche pas : il
   * ajoute un SECOND mode à côté, il ne modifie pas le premier.
   */
  const themePrincipal: ThemeSeance | null = themeDuPreset ?? themesSug[0] ?? null;

  /*
   * Référentiel « léger », reconstruit côté client à partir des seules pièces
   * déjà envoyées par le serveur (`actifs`) — pour appeler `themesEnregistres`
   * (lib/domain/theme.ts, pur) sans faire porter au client un `Referentiel`
   * complet. Seuls `codesActifs` et `parCode` sont lus par cette fonction ;
   * les autres champs restent vides, structurellement présents mais inertes.
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

  const competencesParCode = useMemo(
    () =>
      new Map(
        actifs.map((s) => [s.code, { intitule: s.intitule, domaine: nomsDomaines.get(s.domaine) ?? s.domaine }]),
      ),
    [actifs, nomsDomaines],
  );

  // Thèmes créés pendant cette session (via ModaleTheme) mais pas encore
  // reflétés dans `themesPersistes` : ajoutés côté client pour une sélection
  // immédiate, sans attendre un aller-retour serveur.
  const [themesLocaux, setThemesLocaux] = useState<Theme[]>([]);

  const themesEnreg = useMemo(
    () => themesEnregistres([...themesPersistes, ...themesLocaux], referentielLeger),
    [themesPersistes, themesLocaux, referentielLeger],
  );

  // Thèmes suggérés « larges » (domaine entier, transverse) à proposer en
  // repli dans le mode personnalisé — le premier (la prochaine action) reste
  // le contenu du mode « Prochaine action », pour ne pas le montrer deux fois.
  const themesSugRepli = themesSug.slice(themeDuPreset ? 0 : 1);

  const [mode, setMode] = useState<"prochaine-action" | "personnalisee">(
    // Sans recommandation, `themePrincipal` est nul : l'onglet « Prochaine
    // action » n'aurait rien à montrer. On bascule d'office vers le mode
    // personnalisé, où la personne choisit un thème enregistré ou en décrit un.
    themePrincipal ? "prochaine-action" : "personnalisee",
  );
  const [cleThemePerso, setCleThemePerso] = useState<string>("");
  const [modaleThemeOuverte, setModaleThemeOuverte] = useState(false);

  const themesPersonnalises = useMemo(
    () => [...themesEnreg, ...themesSugRepli],
    [themesEnreg, themesSugRepli],
  );

  // En mode personnalisé, AUCUN repli silencieux : le thème composé est
  // exactement celui coché dans la liste (`cleThemePerso`). Un repli vers le
  // premier thème afficherait une sélection que la liste ne montre pas —
  // l'écran composerait autre chose que ce que voit la personne.
  const theme: ThemeSeance | null =
    mode === "prochaine-action"
      ? themePrincipal
      : themesPersonnalises.find((t) => t.cle === cleThemePerso) ?? null;

  const [temps, setTemps] = useState(
    String(preset?.dureeCibleMin ?? TEMPS_PAR_DEFAUT),
  );
  const [intention, setIntention] = useState("");
  const [intentionOuverte, setIntentionOuverte] = useState(false);

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
        variante="principal"
        onClick={ouvrir}
        className={cx(pleineLargeur && "w-full")}
      >
        {libelle}
      </Bouton>

      {ouvert && (
        <Modale
          titre="Composer une séance"
          sousTitre="Un thème, un temps — le reste est dérivé et reste modifiable."
          onFermer={() => setOuvert(false)}
          largeur="2xl"
        >
          {phase === "besoin" ? (
            <EtapeBesoin
              mode={mode}
              setMode={setMode}
              themePrincipal={themePrincipal}
              themesPersonnalises={themesPersonnalises}
              themesEnreg={themesEnreg}
              cleThemePerso={cleThemePerso}
              themeChoisi={theme !== null}
              setCleThemePerso={setCleThemePerso}
              ouvrirModaleTheme={() => setModaleThemeOuverte(true)}
              onThemeRetire={(id) => {
                setThemesLocaux((prev) => prev.filter((t) => t.id !== id));
                if (cleThemePerso === `theme:${id}`) setCleThemePerso("");
                router.refresh();
              }}
              onThemeRenomme={() => router.refresh()}
              temps={temps}
              setTemps={setTemps}
              conseil={conseil}
              intention={intention}
              setIntention={setIntention}
              intentionOuverte={intentionOuverte}
              setIntentionOuverte={setIntentionOuverte}
              erreur={erreur}
              continuer={passerComposition}
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
              retour={() => setPhase("besoin")}
              demarrer={() => enregistrer(true)}
              planifier={() => enregistrer(false)}
            />
          )}
        </Modale>
      )}

      {modaleThemeOuverte && (
        <ModaleTheme
          competencesParCode={competencesParCode}
          compteId={compteId}
          domainesExistants={domaines}
          onFermer={() => setModaleThemeOuverte(false)}
          onCree={(t) => {
            setThemesLocaux((prev) => [...prev, t]);
            setCleThemePerso(`theme:${t.id}`);
            setMode("personnalisee");
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 — le thème et le temps                                      */
/* ------------------------------------------------------------------ */

function EtapeBesoin({
  mode,
  setMode,
  themePrincipal,
  themesPersonnalises,
  themesEnreg,
  cleThemePerso,
  themeChoisi,
  setCleThemePerso,
  ouvrirModaleTheme,
  onThemeRetire,
  onThemeRenomme,
  temps,
  setTemps,
  conseil,
  intention,
  setIntention,
  intentionOuverte,
  setIntentionOuverte,
  erreur,
  continuer,
}: {
  mode: "prochaine-action" | "personnalisee";
  setMode: (v: "prochaine-action" | "personnalisee") => void;
  themePrincipal: ThemeSeance | null;
  themesPersonnalises: ThemeSeance[];
  /** Les seuls thèmes enregistrés (sans les suggestions de repli) — pour la gestion. */
  themesEnreg: ThemeSeance[];
  cleThemePerso: string;
  /** Un thème est effectivement sélectionné (vrai hors mode sans recommandation). */
  themeChoisi: boolean;
  setCleThemePerso: (v: string) => void;
  ouvrirModaleTheme: () => void;
  onThemeRetire: (themeId: string) => void;
  onThemeRenomme: () => void;
  temps: string;
  setTemps: (v: string) => void;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  intention: string;
  setIntention: (v: string) => void;
  intentionOuverte: boolean;
  setIntentionOuverte: (v: boolean) => void;
  erreur: string | null;
  continuer: () => void;
}) {
  if (!themePrincipal && themesPersonnalises.length === 0) {
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
      {/*
        Deux gestes distincts, pas une liste unique : « prochaine action » est
        pré-sélectionné et n'exige aucun choix — c'est le classement du moteur,
        identique à la carte du tableau de bord (ADR-049). « Séance
        personnalisée » ouvre sur les thèmes déjà enregistrés, une intention
        libre résolue par le tuteur, et les thèmes larges (domaine, transverse)
        en repli.
      */}
      <div role="tablist" className="flex gap-2 border-b border-bordure pb-3">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "prochaine-action"}
          onClick={() => setMode("prochaine-action")}
          disabled={!themePrincipal}
          className={cx(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "prochaine-action"
              ? "bg-primaire-faible text-primaire"
              : "text-texte-attenue hover:bg-surface-2",
            !themePrincipal && "opacity-40",
          )}
        >
          Prochaine action
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "personnalisee"}
          onClick={() => setMode("personnalisee")}
          className={cx(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            mode === "personnalisee"
              ? "bg-primaire-faible text-primaire"
              : "text-texte-attenue hover:bg-surface-2",
          )}
        >
          Séance personnalisée
        </button>
      </div>

      {mode === "prochaine-action" && themePrincipal && (
        <Carte>
          <div className="px-4 py-3.5">
            <p className="text-sm font-medium">{themePrincipal.libelle}</p>
            <p className="mt-0.5 text-[0.6875rem] text-texte-discret">{themePrincipal.detail}</p>
          </div>
        </Carte>
      )}

      {mode === "personnalisee" && (
        <fieldset className="space-y-2.5">
          <legend className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Sur quoi tu veux travailler
          </legend>

          <button
            type="button"
            onClick={ouvrirModaleTheme}
            className="w-full rounded-md border border-dashed border-primaire/40 px-3 py-2.5 text-left text-sm text-primaire hover:bg-primaire-faible"
          >
            + Décrire ce que je veux apprendre
          </button>

          {themesPersonnalises.length === 0 ? (
            <p className="text-xs text-texte-attenue">
              Aucun thème enregistré pour l&apos;instant. Décris une intention ci-dessus, ou
              utilise le classement du moteur via « Prochaine action ».
            </p>
          ) : (
            <div className="space-y-1.5">
              {themesPersonnalises.map((t) => (
                <label
                  key={t.cle}
                  className={cx(
                    "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                    t.cle === cleThemePerso
                      ? "border-primaire/40 bg-primaire-faible"
                      : "border-bordure hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="theme-seance-perso"
                    value={t.cle}
                    checked={t.cle === cleThemePerso}
                    onChange={() => setCleThemePerso(t.cle)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t.libelle}</span>
                    <span className="block text-[0.6875rem] text-texte-discret">{t.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {themesEnreg.length > 0 && (
            <GestionThemes
              themes={themesEnreg}
              onRetire={onThemeRetire}
              onRenomme={onThemeRenomme}
            />
          )}
        </fieldset>
      )}

      <Champ
        label="Temps disponible (minutes)"
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

      <div className="flex justify-end border-t border-bordure pt-3">
        <Bouton
          type="button"
          onClick={continuer}
          variante="principal"
          disabled={!themeChoisi}
          title={
            themeChoisi
              ? undefined
              : "Choisis un thème dans la liste (ou décris-en un) avant de composer."
          }
        >
          Voir la composition
        </Bouton>
      </div>
    </div>
  );
}

/**
 * Gérer ses thèmes enregistrés — renommer, retirer. Vit ici plutôt que dans un
 * nouvel onglet : c'est un réglage de la composition, pas un écran à part.
 *
 * Le retrait annonce son geste avant le clic (ADR-027, même charte que le
 * référentiel) : `etatRetraitTheme` le dérive du nombre de séances qui citent
 * ce thème, jamais offert au choix.
 */
function GestionThemes({
  themes,
  onRetire,
  onRenomme,
}: {
  themes: ThemeSeance[];
  onRetire: (themeId: string) => void;
  onRenomme: () => void;
}) {
  const [edite, setEdite] = useState<string | null>(null);
  const [libelleEdite, setLibelleEdite] = useState("");
  const [confirme, setConfirme] = useState<string | null>(null);
  const [geste, setGeste] = useState<{ seances: number; mode: "suppression" | "archivage" } | null>(
    null,
  );
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div className="space-y-1.5 border-t border-bordure pt-2.5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
        Mes thèmes
      </p>
      {erreur && (
        <p role="alert" className="text-[0.6875rem] text-danger">
          {erreur}
        </p>
      )}
      <ul className="space-y-1">
        {themes.map((t) => {
          if (t.portee.type !== "theme") return null;
          const themeId = t.portee.themeId;
          return (
            <li
              key={themeId}
              className="rounded-md border border-bordure bg-surface-2/60 px-2.5 py-1.5"
            >
              {edite === themeId ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={libelleEdite}
                    onChange={(e) => setLibelleEdite(e.target.value)}
                    className="min-w-0 flex-1 rounded border border-bordure-controle bg-surface px-1.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() =>
                      demarrer(async () => {
                        setErreur(null);
                        try {
                          await modifierTheme(themeId, {
                            libelle: libelleEdite,
                            codes: t.portee.type === "theme" ? t.portee.codes : [],
                          });
                          setEdite(null);
                          onRenomme();
                        } catch (e) {
                          setErreur(e instanceof Error ? e.message : "Renommage impossible.");
                        }
                      })
                    }
                    className="text-[0.6875rem] font-medium text-primaire hover:underline"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setEdite(null)}
                    className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs">{t.libelle}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEdite(themeId);
                        setLibelleEdite(t.libelle);
                      }}
                      className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                    >
                      Renommer
                    </button>
                    {confirme === themeId ? (
                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() =>
                          demarrer(async () => {
                            setErreur(null);
                            try {
                              await retirerTheme(themeId);
                              onRetire(themeId);
                            } catch (e) {
                              setErreur(e instanceof Error ? e.message : "Retrait impossible.");
                            }
                          })
                        }
                        className="text-[0.6875rem] font-medium text-danger hover:underline"
                      >
                        Confirmer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          demarrer(async () => {
                            const etat = await etatRetraitTheme(themeId);
                            setGeste(etat);
                            setConfirme(themeId);
                          })
                        }
                        className="text-[0.6875rem] text-texte-attenue hover:text-danger"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* L'annonce du geste, avant qu'il ne se produise (ADR-027). */}
              {confirme === themeId && geste && (
                <p className="mt-1 text-[0.6875rem] text-texte-discret">
                  {geste.mode === "suppression" ? (
                    <>Aucune séance ne le cite : suppression définitive.</>
                  ) : (
                    <>
                      {geste.seances} séance{geste.seances > 1 ? "s" : ""} le cite
                      {geste.seances > 1 ? "nt" : ""} : archivage, pas suppression — les séances
                      passées restent lisibles.
                    </>
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
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
  retour,
  demarrer,
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
  retour: () => void;
  demarrer: () => void;
  planifier: () => void;
}) {
  if (!theme) return null;

  if (!composition) {
    return (
      <div className="space-y-4 pt-4">
        <p role="alert" className="text-xs text-danger">
          {refusDemande ?? "Cette composition est incohérente. Reviens au besoin et ajuste la durée."}
        </p>
        <Bouton type="button" onClick={retour} variante="secondaire">Revenir au besoin</Bouton>
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

      <div className="flex justify-between border-t border-bordure pt-3">
        <Bouton type="button" onClick={retour} variante="secondaire">
          Changer de thème
        </Bouton>
        <Bouton
          type="button"
          onClick={demarrer}
          enChargement={enregistrement}
          disabled={vide || sansExerciceDisponible}
          variante="principal"
        >
          Démarrer la séance
        </Bouton>
      </div>
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
