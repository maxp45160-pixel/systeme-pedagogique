"use client";

import { useState, useTransition } from "react";
import {
  archiverCompetence,
  basculerActive,
  basculerActives,
  desarchiverCompetence,
  modifierCompetence,
  retirerCompetences,
  retirerDomaine,
  supprimerCompetence,
} from "@/lib/store/referentiel-actions";
import { classesBouton, Carte, CodeCompetence, cx, Etiquette } from "@/components/ui/primitives";
import type { Domaine, Palier, Skill } from "@/lib/domain/types";
import type { EtatRetrait } from "@/lib/domain/referentiel-compte";

/**
 * Entretien du référentiel : modifier, sortir du périmètre, retirer.
 *
 * LA RÈGLE D'ADR-027 EST AFFICHÉE AVANT LE CLIC, pas découverte après. Chaque
 * compétence porte le nombre de preuves qu'elle a produites, et le bouton de
 * retrait dit lequel des deux gestes s'appliquera :
 *
 *   0 preuve   → « Supprimer », et la ligne disparaît vraiment ;
 *   ≥1 preuve  → « Archiver », et les preuves restent.
 *
 * Aucun choix n'est offert entre les deux : le mode est dérivé du nombre de
 * preuves. Un bouton « supprimer » qui archive en douce, ou qui détruit des
 * preuves sans le dire, serait trompeur dans un sens comme dans l'autre.
 *
 * Le code n'est jamais éditable : c'est la clé étrangère des preuves.
 */
const PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

const champ =
  "w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm focus:border-primaire focus:outline-none";

export function GestionReferentiel({
  domaines,
  skills,
  retraits,
}: {
  domaines: Domaine[];
  skills: Skill[];
  retraits: Record<string, EtatRetrait>;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);
  const [edite, setEdite] = useState<string | null>(null);
  const [confirme, setConfirme] = useState<string | null>(null);
  const [domaineConfirme, setDomaineConfirme] = useState<string | null>(null);

  /**
   * Sélection multiple.
   *
   * Sortir six compétences du périmètre demandait six clics, six écritures et
   * six rendus complets de la page — c'est le « ergonomiquement c'est une purge »
   * remonté à l'usage. La sélection est locale et volatile : elle ne survit pas
   * au rendu suivant, et c'est voulu — après une action groupée, ce qui reste à
   * l'écran est le nouvel état, pas l'ancienne intention.
   */
  const [selection, setSelection] = useState<Set<string>>(new Set());

  /*
   * Pas de `router.refresh()` ici.
   *
   * Chaque Server Function fait déjà `revalidatePath("/", "layout")`, et la
   * réponse de l'action embarque le rendu invalidé. Le `refresh` ajoutait un
   * SECOND aller-retour RSC pour recalculer ce qu'on venait de recevoir : la
   * page la plus lourde du produit était rendue deux fois par clic.
   */
  function agir(action: () => Promise<unknown>) {
    setErreur(null);
    setAvis(null);
    demarrer(async () => {
      try {
        await action();
        setEdite(null);
        setConfirme(null);
        setDomaineConfirme(null);
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

  const codesSelectionnes = [...selection];
  // Le mode reste dérivé PAR CODE, y compris en lot : on n'archive pas six
  // lignes vides parce que la septième porte une preuve (ADR-027).
  const aSupprimer = codesSelectionnes.filter(
    (c) => (retraits[c]?.mode ?? "suppression") === "suppression",
  );
  const aArchiver = codesSelectionnes.filter(
    (c) => (retraits[c]?.mode ?? "suppression") === "archivage",
  );

  // Les domaines sans compétence ne sont pas affichés : un en-tête suivi de
  // rien laisserait croire à un domaine vide plutôt qu'à un domaine absent.
  const groupes = domaines
    .map((d) => ({ domaine: d, items: skills.filter((s) => s.domaine === d.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
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

      {/*
        Barre d'action groupée. Elle annonce la répartition exacte AVANT le
        clic — combien seront effacées, combien archivées — parce que le mode
        reste dérivé code par code et qu'un bouton unique masquerait ce
        partage (ADR-027).
      */}
      {codesSelectionnes.length > 0 && (
        <div className="sticky top-2 z-10 rounded-md border border-primaire/30 bg-surface-2 px-3 py-2.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium">
              {codesSelectionnes.length} compétence{codesSelectionnes.length > 1 ? "s" : ""}{" "}
              sélectionnée{codesSelectionnes.length > 1 ? "s" : ""}
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

      {groupes.map(({ domaine, items }) => (
        <Carte key={domaine.id}>
          <div className="border-b border-bordure px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{domaine.nom}</span>
                <Etiquette mono>{domaine.prefixe}</Etiquette>
                {domaine.archive && <Etiquette>Archivé</Etiquette>}
                <span className="text-xs text-texte-discret">
                  {items.filter((s) => s.active && !s.archive).length} / {items.length} au périmètre
                </span>
              </div>

              {/*
                `retirerDomaine` existait depuis ADR-027, testée, et aucune
                interface ne l'appelait : retirer une branche entière se faisait
                donc compétence par compétence. Le mode est dérivé de la branche
                entière — archivage dès qu'une seule de ses compétences porte
                une preuve.
              */}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() =>
                    setSelection(
                      new Set(items.filter((s) => !s.archive).map((s) => s.code)),
                    )
                  }
                  className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                >
                  Tout sélectionner
                </button>
                {domaineConfirme === domaine.id ? (
                  <>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() =>
                        agir(async () => {
                          const mode = await retirerDomaine(domaine.id);
                          setAvis(
                            mode === "suppression"
                              ? `Domaine « ${domaine.nom} » supprimé avec ses ${items.length} compétence(s).`
                              : `Domaine « ${domaine.nom} » archivé : ses preuves restent en base.`,
                          );
                        })
                      }
                      className={classesBouton("secondaire", "petite")}
                    >
                      Confirmer le retrait du domaine
                    </button>
                    <button
                      type="button"
                      onClick={() => setDomaineConfirme(null)}
                      className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={() => setDomaineConfirme(domaine.id)}
                    className={classesBouton("discret", "petite")}
                  >
                    Retirer le domaine
                  </button>
                )}
              </div>
            </div>
            {domaine.description && (
              <p className="mt-1 text-xs text-texte-attenue">{domaine.description}</p>
            )}
            {domaineConfirme === domaine.id && (
              <p className="mt-2 rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs text-texte-attenue">
                {items.some((s) => (retraits[s.code]?.preuves ?? 0) > 0) ? (
                  <>
                    <span className="font-medium">Archivage, pas suppression.</span> Au moins une
                    compétence de ce domaine porte des preuves : le domaine et ses{" "}
                    {items.length} compétences sont archivés ensemble, et les preuves restent
                    lisibles au journal.
                  </>
                ) : (
                  <>
                    <span className="font-medium">Suppression définitive.</span> Aucune des{" "}
                    {items.length} compétences de ce domaine n&apos;a produit de preuve : la
                    branche entière disparaît. Les codes ne seront pas réattribués.
                  </>
                )}
              </p>
            )}
          </div>

          <ul className="divide-y divide-bordure">
            {items.map((s) => {
              const retrait = retraits[s.code] ?? { preuves: 0, mode: "suppression" as const };
              const enEdition = edite === s.code;

              return (
                <li
                  key={s.code}
                  className={cx(
                    "px-4 py-3",
                    s.archive && "opacity-60",
                    selection.has(s.code) && "bg-primaire-faible/40",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!s.archive && (
                          <input
                            type="checkbox"
                            checked={selection.has(s.code)}
                            onChange={() => basculerSelection(s.code)}
                            aria-label={`Sélectionner ${s.code}`}
                            className="mr-1 size-3.5 accent-[var(--primaire)]"
                          />
                        )}
                        <CodeCompetence code={s.code} />
                        <Etiquette>{s.palier}</Etiquette>
                        {s.archive ? (
                          <Etiquette>Archivée</Etiquette>
                        ) : s.active ? (
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

                        {s.archive ? (
                          <button
                            type="button"
                            onClick={() => agir(() => desarchiverCompetence(s.code))}
                            disabled={enCours}
                            className={classesBouton("secondaire", "petite")}
                          >
                            Désarchiver
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => agir(() => basculerActive(s.code, !s.active))}
                            disabled={enCours}
                            className={classesBouton("secondaire", "petite")}
                          >
                            {s.active ? "Sortir du périmètre" : "Remettre au périmètre"}
                          </button>
                        )}

                        {!s.archive &&
                          (confirme === s.code ? (
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
                          ))}
                      </div>
                    )}
                  </div>

                  {/*
                    L'annonce du geste, avant qu'il ne se produise. C'est le
                    cœur d'ADR-027 : la personne doit savoir si elle efface une
                    ligne vide ou si elle range une compétence qui a produit des
                    preuves — et que ces preuves, elles, ne partiront pas.
                  */}
                  {confirme === s.code && (
                    <p className="mt-2 rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs text-texte-attenue">
                      {retrait.mode === "suppression" ? (
                        <>
                          <span className="font-medium">Suppression définitive.</span>{" "}
                          {s.code} n&apos;a produit aucune preuve : la ligne disparaît, rien
                          n&apos;est perdu. Le code ne sera pas réattribué.
                        </>
                      ) : (
                        <>
                          <span className="font-medium">Archivage, pas suppression.</span> {s.code}{" "}
                          porte {retrait.preuves} preuve
                          {retrait.preuves > 1 ? "s" : ""} : elles restent en base et gardent leur
                          intitulé dans ton journal. La compétence sort des calculs et de
                          l&apos;affichage — une preuve ne disparaît pas.
                        </>
                      )}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </Carte>
      ))}
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
          le code {skill.code} n&apos;est pas modifiable — les preuves s&apos;y rattachent
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
