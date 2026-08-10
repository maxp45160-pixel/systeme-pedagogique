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
 * valide (la même fonction que le serveur), `planifierSeance` écrit. Et **rien
 * n'est écrit avant la validation finale** (D3, ADR-037) : un manquant se
 * génère par la modale existante, se relit, et la séance n'est persistée qu'au
 * clic « Démarrer » ou « Planifier ».
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { Modale } from "@/components/ui/modale";
import type {
  BesoinDeclare,
  DemandeSeance,
  Exercise,
  ExerciseAttempt,
  Skill,
  SkillState,
} from "@/lib/domain/types";
import { motifRefusBesoin, TEMPS_DECLARE_MAX } from "@/lib/domain/seance";
import { DUREE_ESTIMEE_MIN } from "@/lib/domain/exercice";
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
import type { Recommandation } from "@/lib/engine/recommend";
import {
  demarrerSeance,
  planifierSeance,
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
  domaines: { id: string; nom: string }[];
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
  domaines,
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
  const themes = useMemo(
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

  const tousThemes = useMemo(
    () => (themeDuPreset ? [themeDuPreset, ...themes] : themes),
    [themeDuPreset, themes],
  );

  const [cleTheme, setCleTheme] = useState(() => tousThemes[0]?.cle ?? "");
  const theme = tousThemes.find((t) => t.cle === cleTheme) ?? tousThemes[0] ?? null;

  const [temps, setTemps] = useState(
    String(preset?.dureeCibleMin ?? TEMPS_PAR_DEFAUT),
  );
  const [intention, setIntention] = useState("");
  const [intentionOuverte, setIntentionOuverte] = useState(false);

  const [nombreExercices, setNombreExercices] = useState(preset?.nombreExercices ?? 3);
  const [nombreTouche, setNombreTouche] = useState(Boolean(preset));

  const [planifieePour, setPlanifieePour] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const calibMap = useMemo(() => new Map(calibrations), [calibrations]);
  const tempsMin = Math.max(DUREE_ESTIMEE_MIN, Number(temps) || TEMPS_PAR_DEFAUT);

  const conseil = useMemo(
    () => nombreExercicesConseille(tempsMin, exercices, tentatives),
    [tempsMin, exercices, tentatives],
  );

  // `demande` est reconstruite À L'INTÉRIEUR du memo : un objet littéral change
  // de référence à chaque rendu, ce qui recalculerait `composerSeance` (non
  // gratuit — il parcourt tout le classement) même quand rien n'a changé.
  const composition: CompositionSeance | null = useMemo(() => {
    if (!theme) return null;
    const demande: DemandeSeance = {
      dureeCibleMin: tempsMin,
      nombreExercices,
      portee: theme.portee,
      codesImposes: theme.codesImposes,
    };
    return composerSeance(demande, etats, exercices, tentatives, calibMap, new Date());
  }, [theme, tempsMin, nombreExercices, etats, exercices, tentatives, calibMap]);

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
    return {
      // Absente plutôt que chaîne vide : un champ laissé vide n'est pas une
      // intention déclarée, et `ecartBesoinRealise` ne doit pas afficher des
      // guillemets autour de rien.
      ...(intention.trim() ? { intention: intention.trim() } : {}),
      codesVises: theme?.codesImposes ?? [],
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
      const id = await planifierSeance(entree);
      if (demarrer) {
        await demarrerSeance(id);
        router.push(`/seances/${id}`);
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
              themes={tousThemes}
              cleTheme={cleTheme}
              setCleTheme={setCleTheme}
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
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Étape 1 — le thème et le temps                                      */
/* ------------------------------------------------------------------ */

function EtapeBesoin({
  themes,
  cleTheme,
  setCleTheme,
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
  themes: ThemeSeance[];
  cleTheme: string;
  setCleTheme: (v: string) => void;
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
  if (themes.length === 0) {
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
      <fieldset>
        <legend className="mb-2 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
          Sur quoi tu bosses
        </legend>
        <div className="space-y-1.5">
          {themes.map((t) => (
            <label
              key={t.cle}
              className={cx(
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
                t.cle === cleTheme
                  ? "border-primaire/40 bg-primaire-faible"
                  : "border-bordure hover:bg-surface-2",
              )}
            >
              <input
                type="radio"
                name="theme-seance"
                value={t.cle}
                checked={t.cle === cleTheme}
                onChange={() => setCleTheme(t.cle)}
                className="mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.libelle}</span>
                <span className="block text-[0.6875rem] text-texte-discret">
                  {t.detail}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
        <Bouton type="button" onClick={continuer} variante="principal">
          Voir la composition
        </Bouton>
      </div>
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
  if (!composition || !theme) return null;

  const vide = composition.activites.length === 0 && composition.manquants.length === 0;

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
            min={1}
            value={String(nombreExercices)}
            onChange={(e) => setNombreExercices(Math.max(1, Number(e.target.value) || 1))}
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
          <p className="text-sm font-medium">
            À rédiger — {composition.manquants.length} exercice
            {composition.manquants.length > 1 ? "s" : ""} manquant
            {composition.manquants.length > 1 ? "s" : ""}
          </p>
          {composition.manquants.map((m) => (
            <LigneManquant
              key={m.code}
              manquant={m}
              competencesModale={competencesModale}
              calibragesModale={calibragesModale}
              compteId={compteId}
            />
          ))}
          <p className="text-[0.6875rem] text-texte-discret">
            Génère et relis chaque exercice avant de démarrer : rien n&apos;est écrit sans
            ta validation. Les manquants non générés ne feront pas partie de la séance.
          </p>
        </div>
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
              disabled={vide}
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
          disabled={vide}
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

function LigneManquant({
  manquant,
  competencesModale,
  calibragesModale,
  compteId,
}: {
  manquant: ManquantSeance;
  competencesModale: CompetenceModale[];
  calibragesModale: Record<string, CalibrageModale>;
  compteId: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-bordure p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{manquant.intitule}</p>
        <BoutonGenerer
          competences={competencesModale}
          competenceInitiale={manquant.code}
          calibrages={calibragesModale}
          compteId={compteId}
          libelle="Générer"
          variante="secondaire"
        />
      </div>
      <p className="mt-0.5 text-xs text-texte-discret">
        {manquant.code} · difficulté cible {manquant.difficulteCible}/5
      </p>
      <p className="mt-1 text-xs text-texte-attenue">{manquant.raison}</p>
    </div>
  );
}
