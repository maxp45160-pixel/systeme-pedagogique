"use client";

/**
 * Étape 2 du compositeur — ce que le moteur propose.
 *
 * Extrait de `concepteur-seance.tsx` : la composition est déjà calculée par
 * le parent (`composerSeance`), cette étape ne fait que la relire et offrir
 * les gestes — ajuster le nombre, générer les manquants, planifier.
 */

import { BandeauInfo, Bouton, Carte, cx, Etiquette } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { EXERCICES_PAR_SEANCE_MAX, EXERCICES_PAR_SEANCE_MIN } from "@/lib/domain/seance";
import {
  nombreExercicesConseille,
  type ActiviteComposee,
  type CompositionSeance,
  type ManquantSeance,
  type ThemeSeance,
} from "@/lib/engine/caf";

export function EtapeComposition({
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
