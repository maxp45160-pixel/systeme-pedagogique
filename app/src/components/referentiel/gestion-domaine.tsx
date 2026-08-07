"use client";

/**
 * Gestion d'un domaine et de ses compétences — pour la sous-page domaine.
 *
 * R5 : la page `/competences` est épurée (grands champs seulement), et la
 * gestion se fait ici, dans la sous-page domaine. Ce composant reprend les
 * fonctionnalités de `GestionReferentiel` : sélection multiple, barre
 * d'action groupée, édition inline, sortie/remise au périmètre,
 * archiver/supprimer (ADR-027), dossier des compétences archivées.
 *
 * LA RÈGLE D'ADR-027 EST AFFICHÉE AVANT LE CLIC : chaque compétence porte le
 * nombre de preuves, et le bouton de retrait dit lequel des deux gestes
 * s'appliquera — supprimer (0 preuve) ou archiver (≥1 preuve). Aucun choix
 * n'est offert : le mode est dérivé.
 */

import { useState, useTransition } from "react";
import {
  archiverCompetence,
  basculerActive,
  basculerActives,
  desarchiverCompetence,
  modifierCompetence,
  retirerCompetences,
  supprimerCompetence,
} from "@/lib/store/referentiel-actions";
import { classesBouton, CodeCompetence, cx, Etiquette } from "@/components/ui/primitives";
import type { Domaine, Palier, Skill } from "@/lib/domain/types";
import { comparerCodes, type EtatRetrait } from "@/lib/domain/referentiel-compte";

const PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

const champ =
  "w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none";

export function GestionDomaine({
  domaine,
  skills,
  retraits,
}: {
  domaine: Domaine;
  /** Compétences du domaine, toutes (vivantes et archivées). */
  skills: Skill[];
  retraits: Record<string, EtatRetrait>;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [edite, setEdite] = useState<string | null>(null);
  const [confirme, setConfirme] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);

  const items = [...skills].sort((a, b) => comparerCodes(a.code, b.code));
  const vivantes = items.filter((s) => !s.archive);
  const archivees = items.filter((s) => s.archive);
  const codesSelectionnes = [...selection];

  const aSupprimer = codesSelectionnes.filter(
    (c) => (retraits[c]?.mode ?? "suppression") === "suppression",
  );
  const aArchiver = codesSelectionnes.filter(
    (c) => (retraits[c]?.mode ?? "suppression") === "archivage",
  );

  function agir(action: () => Promise<unknown>) {
    setErreur(null);
    setAvis(null);
    demarrer(async () => {
      try {
        await action();
        setEdite(null);
        setConfirme(null);
        setSelection(new Set());
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Opération impossible.");
      }
    });
  }

  function basculerSelection(code: string) {
    setSelection((s) => {
      const suivant = new Set(s);
      if (suivant.has(code)) suivant.delete(code);
      else suivant.add(code);
      return suivant;
    });
  }

  return (
    <div className="space-y-4">
      {/* Nom du domaine — utile en tête de la gestion, prop `domaine` devient utile. */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-texte-discret">
          Gestion des compétences du domaine « {domaine.nom} »
        </span>
      </div>

      {erreur && (
        <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
          {erreur}
        </p>
      )}
      {avis && (
        <p className="rounded-md border border-succes/30 bg-succes-faible px-3 py-2 text-xs text-succes">
          {avis}
        </p>
      )}

      {/* Barre d'action groupée */}
      {codesSelectionnes.length > 0 && (
        <div className="sticky top-2 z-10 rounded-md border border-primaire/30 bg-surface-2 px-3 py-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">
              {codesSelectionnes.length} compétence
              {codesSelectionnes.length > 1 ? "s" : ""} sélectionnée
              {codesSelectionnes.length > 1 ? "s" : ""}
            </span>
            <button
              type="button"
              disabled={enCours}
              onClick={() => agir(() => basculerActives(codesSelectionnes, false))}
              className={classesBouton("secondaire", "petite")}
            >
              Sortir du périmètre
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => agir(() => basculerActives(codesSelectionnes, true))}
              className={classesBouton("secondaire", "petite")}
            >
              Remettre au périmètre
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() =>
                agir(async () => {
                  const r = await retirerCompetences(codesSelectionnes);
                  setAvis(
                    `${r.supprimees.length} supprimée(s), ${r.archivees.length} archivée(s).`,
                  );
                })
              }
              className={classesBouton("secondaire", "petite")}
            >
              Retirer
            </button>
            <button
              type="button"
              onClick={() => setSelection(new Set())}
              className="text-[0.6875rem] text-texte-attenue hover:text-texte"
            >
              Tout désélectionner
            </button>
          </div>
          <p className="mt-1.5 text-[0.6875rem] text-texte-attenue">
            « Retirer » effacerait {aSupprimer.length} ligne
            {aSupprimer.length > 1 ? "s" : ""} sans preuve et archiverait {aArchiver.length}{" "}
            compétence{aArchiver.length > 1 ? "s" : ""} qui en portent. Les preuves restent en
            base dans les deux cas.
          </p>
        </div>
      )}

      {vivantes.length === 0 ? (
        <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
          Aucune compétence active dans ce domaine.
          {archivees.length > 0 && " Des compétences archivées existent — voir plus bas."}
        </p>
      ) : (
        <ul className="divide-y divide-bordure rounded-carte border border-bordure bg-surface">
          {vivantes.map((s) => {
            const retrait = retraits[s.code] ?? { preuves: 0, mode: "suppression" as const };
            const enEdition = edite === s.code;

            return (
              <li
                key={s.code}
                className={cx(
                  "px-4 py-3",
                  selection.has(s.code) && "bg-primaire-faible/40",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={selection.has(s.code)}
                        onChange={() => basculerSelection(s.code)}
                        aria-label={`Sélectionner ${s.code}`}
                        className="mr-1 size-3.5 accent-[var(--primaire)]"
                      />
                      <CodeCompetence code={s.code} />
                      <Etiquette>{s.palier}</Etiquette>
                      {s.active ? (
                        <Etiquette ton="primaire">Au périmètre</Etiquette>
                      ) : (
                        <Etiquette>Hors périmètre</Etiquette>
                      )}
                      <span className="chiffres text-[0.6875rem] text-texte-discret">
                        importance {s.importance} ·{" "}
                        {retrait.preuves === 0
                          ? "aucune preuve"
                          : `${retrait.preuves} preuve${retrait.preuves > 1 ? "s" : ""}`}
                      </span>
                    </div>

                    {enEdition ? (
                      <FormulaireEdition
                        skill={s}
                        enCours={enCours}
                        onAnnuler={() => setEdite(null)}
                        onValider={(champs) => agir(() => modifierCompetence(s.code, champs))}
                      />
                    ) : (
                      <p className="mt-1 text-sm">{s.intitule}</p>
                    )}

                    {s.prerequis.length > 0 && !enEdition && (
                      <p className="mt-1 text-[0.6875rem] text-texte-discret">
                        prérequis : {s.prerequis.join(", ")} (indicatifs, jamais bloquants)
                      </p>
                    )}
                  </div>

                  {!enEdition && (
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEdite(s.code)}
                        disabled={enCours}
                        className={classesBouton("secondaire", "petite")}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => agir(() => basculerActive(s.code, !s.active))}
                        disabled={enCours}
                        className={classesBouton("secondaire", "petite")}
                      >
                        {s.active ? "Sortir du périmètre" : "Remettre au périmètre"}
                      </button>
                      {confirme === s.code ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              agir(() =>
                                retrait.mode === "suppression"
                                  ? supprimerCompetence(s.code)
                                  : archiverCompetence(s.code),
                              )
                            }
                            disabled={enCours}
                            className={classesBouton("secondaire", "petite")}
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirme(null)}
                            className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirme(s.code)}
                          disabled={enCours}
                          className={classesBouton("secondaire", "petite")}
                        >
                          {retrait.mode === "suppression" ? "Supprimer" : "Archiver"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* L'annonce du geste, avant qu'il ne se produise (ADR-027). */}
                {confirme === s.code && (
                  <p className="mt-2 rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs text-texte-attenue">
                    {retrait.mode === "suppression" ? (
                      <>
                        <span className="font-medium">Suppression définitive.</span>{" "}
                        {s.code} n{"'"}a produit aucune preuve : la ligne disparaît, rien
                        n{"'"}est perdu. Le code ne sera pas réattribué.
                      </>
                    ) : (
                      <>
                        <span className="font-medium">Archivage, pas suppression.</span> {s.code}{" "}
                        porte {retrait.preuves} preuve
                        {retrait.preuves > 1 ? "s" : ""} : elles restent en base et gardent leur
                        intitulé dans ton journal. La compétence sort des calculs et de
                        l{"'"}affichage — une preuve ne disparaît pas.
                      </>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Tiroir des compétences archivées du domaine */}
      {archivees.length > 0 && (
        <div className="rounded-carte border border-bordure bg-surface">
          <button
            type="button"
            onClick={() => setArchivesOuvertes((o) => !o)}
            aria-expanded={archivesOuvertes}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[0.6875rem] text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            <span aria-hidden className="text-[0.625rem] text-texte-discret">
              {archivesOuvertes ? "▼" : "▶"}
            </span>
            <span className="font-medium">
              {archivees.length} compétence{archivees.length > 1 ? "s" : ""} archivée
              {archivees.length > 1 ? "s" : ""}
            </span>
            <span className="text-texte-discret">— preuves conservées</span>
          </button>
          {archivesOuvertes && (
            <ul className="divide-y divide-bordure border-t border-bordure">
              {archivees.map((s) => (
                <li key={s.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 opacity-70">
                  <div className="flex items-center gap-1.5">
                    <CodeCompetence code={s.code} />
                    <span className="text-xs">{s.intitule}</span>
                    <Etiquette>Archivée</Etiquette>
                  </div>
                  <button
                    type="button"
                    onClick={() => agir(() => desarchiverCompetence(s.code))}
                    disabled={enCours}
                    className={classesBouton("secondaire", "petite")}
                  >
                    Désarchiver
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FormulaireEdition({
  skill,
  enCours,
  onValider,
  onAnnuler,
}: {
  skill: Skill;
  enCours: boolean;
  onValider: (champs: { intitule: string; palier: Palier; importance: number }) => void;
  onAnnuler: () => void;
}) {
  const [intitule, setIntitule] = useState(skill.intitule);
  const [palier, setPalier] = useState<Palier>(skill.palier);
  const [importance, setImportance] = useState(String(skill.importance));

  return (
    <div className="mt-2 space-y-2">
      <input value={intitule} onChange={(e) => setIntitule(e.target.value)} className={champ} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5">
          <span className="text-texte-attenue">Palier</span>
          <select
            value={palier}
            onChange={(e) => setPalier(e.target.value as Palier)}
            className="rounded-md border border-bordure bg-surface px-1.5 py-1"
          >
            {PALIERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-texte-attenue">Importance</span>
          <input
            value={importance}
            onChange={(e) => setImportance(e.target.value)}
            className="w-16 rounded-md border border-bordure bg-surface px-1.5 py-1"
          />
        </label>
        <span className="text-texte-discret">
          le code {skill.code} n{"'"}est pas modifiable — les preuves s{"'"}y rattachent
        </span>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={enCours || intitule.trim().length === 0}
          onClick={() =>
            onValider({
              intitule,
              palier,
              importance: Number.parseFloat(importance.replace(",", ".")),
            })
          }
          className={classesBouton("principal", "petite")}
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          className={classesBouton("secondaire", "petite")}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}