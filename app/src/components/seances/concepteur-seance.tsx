"use client";

/**
 * Concepteur de séance — l'écran de composition (lots 2.1, 2.2 du plan de
 * refonte Séances).
 *
 * Toute la logique vient du lot 1. Ce composant n'en recopie aucune : il appelle
 * `composerSeance` (lib/engine/caf.ts) avec le besoin déclaré et affiche ce
 * qu'elle rend — activités retenues avec leur raison, manquants avec la leur,
 * explication. Un second classement ici aurait divergé du tableau de bord sans
 * que rien ne le signale (ADR-049).
 *
 * Le besoin est saisi mot pour mot, jamais reformulé (D6) ; l'écart entre le
 * déclaré et le réalisé est dérivé par `ecartBesoinRealise`, jamais ici.
 *
 * RIEN n'est écrit avant la validation de la dernière étape (D3, ADR-037) : un
 * manquant est généré par la modale existante, relu, et la séance n'est
 * persistée qu'au clic « Planifier ».
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton, Carte, SelecteurSegmente } from "@/components/ui/primitives";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { Modale } from "@/components/ui/modale";
import type { DemandeSeance, Exercise, ExerciseAttempt, Skill, SkillState } from "@/lib/domain/types";
import { motifRefusBesoin } from "@/lib/domain/seance";
import {
  composerSeance,
  nombreExercicesConseille,
  type ActiviteComposee,
  type ManquantSeance,
  type CompositionSeance,
} from "@/lib/engine/caf";
import type { Calibration } from "@/lib/engine/calibration";
import { planifierSeance, type EntreePlanification } from "@/lib/store/seance-actions";
import { BoutonGenerer } from "@/components/exercices/bouton-generer";
import {
  competencesPourModale,
  type CalibrageModale,
  type CompetenceModale,
} from "@/components/exercices/proprietes-generation";

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
  codesRecommandes: string[];
  domaines: { id: string; nom: string }[];
  compteId: string;
  /** Pré-remplit le compositeur (ex. « Refaire cette séance »). */
  preset?: PresetSeance;
  /** Libellé du bouton déclencheur. */
  libelle?: string;
}

type Phase = "besoin" | "composition" | "planification";

const PLAFOND_EXERCICES = 8;
export function ConcepteurSeance({
  etats,
  actifs,
  exercices,
  tentatives,
  calibrations,
  calibragesModale,
  codesRecommandes,
  domaines,
  compteId,
  preset,
  libelle = "Composer une séance",
}: DonneesSeance) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [phase, setPhase] = useState<Phase>("besoin");

  const [intention, setIntention] = useState("");
  const [temps, setTemps] = useState(preset ? String(preset.dureeCibleMin) : "");
  const [codesVises, setCodesVises] = useState<string[]>(
    preset?.codesVises ?? codesRecommandes.slice(0, 5),
  );

  const [transverse, setTransverse] = useState(!preset?.domaine);
  const [domaine, setDomaine] = useState(preset?.domaine ?? domaines[0]?.id ?? "");
  const [nombreExercices, setNombreExercices] = useState(preset?.nombreExercices ?? 3);
  /**
   * Le nombre affiché suit `nombreExercicesConseille` tant que la personne n'a
   * pas mis la main dessus. « Refaire cette séance » compte comme un choix
   * explicite (`preset`) : le conseil du jour ne doit pas écraser un nombre
   * qui vient d'ailleurs.
   */
  const [nombreTouche, setNombreTouche] = useState(Boolean(preset));

  const [planifieePour, setPlanifieePour] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const calibMap = useMemo(() => new Map(calibrations), [calibrations]);

  // `demande` est reconstruite À L'INTÉRIEUR du memo plutôt que passée en
  // dépendance : un objet littéral change de référence à chaque rendu, ce qui
  // aurait recalculé `composerSeance` (non gratuit — il parcourt tout le
  // classement) même quand rien de ce qu'il lit n'a changé.
  const composition: CompositionSeance = useMemo(() => {
    const demande: DemandeSeance = {
      dureeCibleMin: Math.max(1, Number(temps) || 30),
      nombreExercices,
      portee: transverse
        ? { type: "transverse", domaines: deduireDomaines(etats) }
        : { type: "mono", domaine },
      codesImposes: codesVises,
    };
    return composerSeance(demande, etats, exercices, tentatives, calibMap, new Date());
  }, [temps, nombreExercices, transverse, domaine, codesVises, etats, exercices, tentatives, calibMap]);

  const conseil = useMemo(
    () => nombreExercicesConseille(Math.max(1, Number(temps) || 30), exercices, tentatives),
    [temps, exercices, tentatives],
  );

  const competencesModale: CompetenceModale[] = useMemo(
    () => competencesPourModale(actifs),
    [actifs],
  );

  function ouvrir() {
    setErreur(null);
    setPhase("besoin");
    setOuvert(true);
  }

  function passerComposition() {
    const refus = motifRefusBesoin({
      intention: intention.trim(),
      codesVises,
      tempsDisponibleMin: Math.max(1, Number(temps) || 30),
      declareLe: new Date().toISOString(),
    });
    if (refus) {
      setErreur(refus);
      return;
    }
    // Le nombre proposé s'applique une fois qu'on connaît le temps déclaré —
    // pas avant, pas à chaque frappe : la personne verrait le champ bouger
    // sous ses yeux pendant qu'elle tape. `nombreTouche` reste vrai si elle
    // avait déjà corrigé le nombre à une étape précédente.
    if (!nombreTouche && conseil) setNombreExercices(conseil.nombre);
    setErreur(null);
    setPhase("composition");
  }

  async function planifier() {
    const besoin = {
      intention: intention.trim(),
      codesVises,
      tempsDisponibleMin: Math.max(1, Number(temps) || 30),
      declareLe: new Date().toISOString(),
    };
    const refus = motifRefusBesoin(besoin);
    if (refus) {
      setErreur(refus);
      return;
    }
    setEnregistrement(true);
    setErreur(null);
    try {
      const activites = composition.activites.map((a) => ({
        type: a.type,
        ref: a.ref,
        libelle: a.libelle,
      }));
      const entree: EntreePlanification = {
        besoin,
        blueprint: composition.blueprint,
        activites,
        planifieePour: planifieePour ? new Date(planifieePour).toISOString() : undefined,
      };
      await planifierSeance(entree);
      setOuvert(false);
      router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Impossible de planifier la séance.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <>
      <Bouton variante="principal" onClick={ouvrir}>
        {libelle}
      </Bouton>

      {ouvert && (
        <Modale
          titre="Composer une séance"
          sousTitre="Ce que tu veux travailler, ce que le système propose, ce qui manque."
          onFermer={() => setOuvert(false)}
          largeur="2xl"
        >
          {phase === "besoin" && (
            <EtapeBesoin
              intention={intention}
              setIntention={setIntention}
              temps={temps}
              setTemps={setTemps}
              codesVises={codesVises}
              basculerCode={(c) =>
                setCodesVises((v) => (v.includes(c) ? v.filter((x) => x !== c) : [...v, c]))
              }
              etats={etats}
              erreur={erreur}
              continuer={passerComposition}
            />
          )}

          {phase === "composition" && (
            <EtapeComposition
              composition={composition}
              conseil={conseil}
              transverse={transverse}
              setTransverse={setTransverse}
              domaine={domaine}
              setDomaine={setDomaine}
              domaines={domaines}
              nombreExercices={nombreExercices}
              setNombreExercices={(v) => {
                setNombreTouche(true);
                setNombreExercices(v);
              }}
              competencesModale={competencesModale}
              calibragesModale={calibragesModale}
              compteId={compteId}
              retour={() => setPhase("besoin")}
              continuer={() => setPhase("planification")}
            />
          )}

          {phase === "planification" && (
            <EtapePlanification
              planifieePour={planifieePour}
              setPlanifieePour={setPlanifieePour}
              composition={composition}
              planifier={planifier}
              enregistrement={enregistrement}
              erreur={erreur}
              retour={() => setPhase("composition")}
              besoinRecap={{ intention, temps, codesVises }}
            />
          )}
        </Modale>
      )}
    </>
  );
}

function EtapeBesoin(props: {
  intention: string;
  setIntention: (v: string) => void;
  temps: string;
  setTemps: (v: string) => void;
  codesVises: string[];
  basculerCode: (c: string) => void;
  etats: SkillState[];
  erreur: string | null;
  continuer: () => void;
}) {
  const { intention, setIntention, temps, setTemps, codesVises, basculerCode, etats, erreur, continuer } = props;
  return (
    <div className="space-y-4 pt-4">
      <Champ
        label="Ce que tu veux travailler"
        multiligne
        rows={3}
        value={intention}
        onChange={(e) => setIntention(e.target.value)}
        placeholder="Ex. : reprendre les suites numériques et la loi normale avant l'examen."
        aide="Écris-le à ta main : la phrase est conservée telle quelle, et comparée à ce que tu auras réellement fait."
      />
      <Champ
        label="Temps disponible (minutes)"
        type="number"
        min={1}
        max={480}
        value={temps}
        onChange={(e) => setTemps(e.target.value)}
        aide="Une déclaration, pas un chronométrage — elle sert à proposer un nombre d'exercices."
      />
      <fieldset>
        <legend className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
          Compétences visées
        </legend>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-bordure p-2">
          {etats.map((e) => (
            <label key={e.skill.code} className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={codesVises.includes(e.skill.code)}
                onChange={() => basculerCode(e.skill.code)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">{e.skill.intitule}</span>{" "}
                <span className="text-texte-discret">({e.skill.code})</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[0.6875rem] text-texte-discret">
          Pré-cochées depuis tes recommandations, modifiables à la main.
        </p>
      </fieldset>

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-bordure pt-3">
        <Bouton type="button" onClick={continuer} variante="principal">
          Voir la composition
        </Bouton>
      </div>
    </div>
  );
}

function EtapeComposition(props: {
  composition: CompositionSeance;
  conseil: ReturnType<typeof nombreExercicesConseille>;
  transverse: boolean;
  setTransverse: (v: boolean) => void;
  domaine: string;
  setDomaine: (v: string) => void;
  domaines: { id: string; nom: string }[];
  nombreExercices: number;
  setNombreExercices: (v: number) => void;
  competencesModale: CompetenceModale[];
  calibragesModale: Record<string, CalibrageModale>;
  compteId: string;
  retour: () => void;
  continuer: () => void;
}) {
  const {
    composition,
    conseil,
    transverse,
    setTransverse,
    domaine,
    setDomaine,
    domaines,
    nombreExercices,
    setNombreExercices,
    competencesModale,
    calibragesModale,
    compteId,
    retour,
    continuer,
  } = props;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-end gap-4">
        <SelecteurSegmente
          options={[
            { cle: "transverse", libelle: "Transverse" },
            { cle: "mono", libelle: "Un domaine" },
          ]}
          actif={transverse ? "transverse" : "mono"}
          rendreItem={(o, cls, act) => (
            <button
              key={o.cle}
              type="button"
              onClick={() => setTransverse(o.cle === "transverse")}
              aria-pressed={act}
              className={cls}
            >
              {o.libelle}
            </button>
          )}
        />
        {!transverse && (
          <div className="w-56">
            <ChampSelect
              label="Domaine"
              value={domaine}
              onChange={(e) => setDomaine(e.target.value)}
              options={domaines.map((d) => ({ valeur: d.id, libelle: d.nom }))}
            />
          </div>
        )}
        <div className="w-40">
          <Champ
            label="Exercices"
            type="number"
            min={1}
            max={PLAFOND_EXERCICES}
            value={String(nombreExercices)}
            onChange={(e) => setNombreExercices(Math.max(1, Number(e.target.value) || 1))}
            aide={
              conseil
                ? `Conseillé : ${conseil.nombre} (${conseil.explication})`
                : "Aucune durée de référence encore : fixe le nombre toi-même."
            }
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
            Génère et relis chaque exercice avant de planifier : rien n&apos;est écrit sans ta
            validation.
          </p>
        </div>
      )}

      {composition.activites.length === 0 && composition.manquants.length === 0 && (
        <Carte>
          <div className="px-4 py-8 text-center text-xs text-texte-attenue">
            Aucune compétence active dans ce périmètre : rien à composer.
          </div>
        </Carte>
      )}

      <div className="flex justify-between border-t border-bordure pt-3">
        <Bouton type="button" onClick={retour} variante="secondaire">
          Modifier le besoin
        </Bouton>
        <Bouton type="button" onClick={continuer} variante="principal">
          Continuer
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

function EtapePlanification(props: {
  planifieePour: string;
  setPlanifieePour: (v: string) => void;
  composition: CompositionSeance;
  planifier: () => void;
  enregistrement: boolean;
  erreur: string | null;
  retour: () => void;
  besoinRecap: { intention: string; temps: string; codesVises: string[] };
}) {
  const {
    planifieePour,
    setPlanifieePour,
    composition,
    planifier,
    enregistrement,
    erreur,
    retour,
    besoinRecap,
  } = props;
  const formatte = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="space-y-4 pt-4">
      <Carte>
        <div className="px-4 py-3">
          <p className="text-xs text-texte-discret">Besoin déclaré</p>
          <p className="mt-0.5 text-sm italic">« {besoinRecap.intention} »</p>
          <p className="mt-1 text-xs text-texte-attenue">
            {besoinRecap.codesVises.length} compétence(s) visée(s) ·{" "}
            {besoinRecap.temps || "30"} min déclarées
          </p>
        </div>
      </Carte>

      <p className="text-xs text-texte-attenue">
        {composition.activites.length} exercice(s) retenu(s) — durée estimée{" "}
        {composition.dureeEstimeeTotaleMin} min pour une cible de{" "}
        {composition.blueprint.dureeCibleMin}.
      </p>

      <Champ
        label="Date et heure prévues (optionnel)"
        type="datetime-local"
        value={planifieePour}
        onChange={(e) => setPlanifieePour(e.target.value)}
        aide={
          planifieePour
            ? `Planifiée le ${formatte.format(new Date(planifieePour))}.`
            : "Laisse vide pour commencer tout de suite."
        }
      />

      {erreur && (
        <p role="alert" className="text-xs text-danger">
          {erreur}
        </p>
      )}

      <div className="flex justify-between border-t border-bordure pt-3">
        <Bouton type="button" onClick={retour} variante="secondaire">
          Retour
        </Bouton>
        <Bouton
          type="button"
          onClick={planifier}
          enChargement={enregistrement}
          variante="principal"
        >
          Planifier la séance
        </Bouton>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Petits aides d'assemblage — purs, sans état.                        */
/* ------------------------------------------------------------------ */

function deduireDomaines(etats: SkillState[]): string[] {
  return [...new Set(etats.map((e) => e.skill.domaine))];
}

