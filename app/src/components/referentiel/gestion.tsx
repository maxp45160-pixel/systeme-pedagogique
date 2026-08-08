"use client";

import { Fragment, useState, useTransition } from "react";
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
import { BandeauInfo, Bouton, CodeCompetence, cx, Etiquette } from "@/components/ui/primitives";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { PanneauPliable, TiroirRepliable } from "@/components/ui/panneau-pliable";
import type { Domaine, Palier, Skill } from "@/lib/domain/types";
import { comparerCodes, type EtatRetrait } from "@/lib/domain/referentiel-compte";

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
const OPTIONS_PALIER = PALIERS.map((p) => ({ valeur: p, libelle: p }));

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
  /**
   * `enCours` (ci-dessus) est un seul `useTransition` partagé par toutes les
   * mutations de cet écran — il ne dit pas LAQUELLE est en vol. Lui brancher
   * `enChargement` sur chaque bouton aurait fait tourner tous les boutons à
   * la fois pour une seule action réelle. `actionEnCours` porte l'identifiant
   * de l'action cliquée ; seul le bouton qui la porte reçoit `enChargement`.
   */
  const [actionEnCours, setActionEnCours] = useState<string | null>(null);
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

  /** Les domaines périmés sont hors du champ de vision tant qu'on ne les demande pas. */
  const [archivesOuverts, setArchivesOuverts] = useState(false);
  /** Par domaine vivant : ses compétences archivées, repliées par défaut. */
  const [archiveesOuvertes, setArchiveesOuvertes] = useState<Set<string>>(new Set());

  function basculerDans(
    valeur: string,
    lire: Set<string>,
    ecrire: (s: Set<string>) => void,
  ) {
    const suivant = new Set(lire);
    if (suivant.has(valeur)) suivant.delete(valeur);
    else suivant.add(valeur);
    ecrire(suivant);
  }

  /*
   * Pas de `router.refresh()` ici.
   *
   * Chaque Server Function fait déjà `revalidatePath("/", "layout")`, et la
   * réponse de l'action embarque le rendu invalidé. Le `refresh` ajoutait un
   * SECOND aller-retour RSC pour recalculer ce qu'on venait de recevoir : la
   * page la plus lourde du produit était rendue deux fois par clic.
   */
  function agir(id: string, action: () => Promise<unknown>) {
    setErreur(null);
    setAvis(null);
    setActionEnCours(id);
    demarrer(async () => {
      try {
        await action();
        setEdite(null);
        setConfirme(null);
        setDomaineConfirme(null);
        setSelection(new Set());
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Opération impossible.");
      } finally {
        setActionEnCours(null);
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
  //
  // L'ordre à l'intérieur d'un domaine est **numérique** : LOG-09 avant LOG-10.
  // L'ordre général du référentiel (`comparerSkills` : palier, rang, code) reste
  // celui du diagnostic — il répond à « par où commencer ? ». Ici la question
  // est « où est LOG-12 ? », et seul le numéro y répond.
  const groupes = domaines
    .map((d) => ({
      domaine: d,
      items: [...skills.filter((s) => s.domaine === d.id)].sort((a, b) =>
        comparerCodes(a.code, b.code),
      ),
    }))
    .filter((g) => g.items.length > 0);

  /**
   * Un domaine est périmé quand il est archivé, ou quand plus aucune de ses
   * compétences ne l'est. Le second cas compte autant que le premier : une
   * branche vidée compétence par compétence encombre la vue exactement comme
   * une branche archivée d'un bloc, sans jamais porter l'étiquette.
   */
  const perime = (g: (typeof groupes)[number]) =>
    g.domaine.archive || g.items.every((s) => s.archive);
  const vivants = groupes.filter((g) => !perime(g));
  const archives = groupes.filter(perime);
  const affiches = archivesOuverts ? [...vivants, ...archives] : vivants;

  return (
    <div className="space-y-4">
      {erreur && (
        <BandeauInfo ton="alerte" taille="compacte">
          <p className="text-alerte">{erreur}</p>
        </BandeauInfo>
      )}
      {avis && (
        <BandeauInfo ton="succes" taille="compacte">
          <p className="text-succes">{avis}</p>
        </BandeauInfo>
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
            <Bouton
              enChargement={actionEnCours === "lot-sortir"}
              disabled={enCours}
              onClick={() => agir("lot-sortir", () => basculerActives(codesSelectionnes, false))}
              variante="secondaire"
              taille="petite"
            >
              Sortir du périmètre
            </Bouton>
            <Bouton
              enChargement={actionEnCours === "lot-remettre"}
              disabled={enCours}
              onClick={() => agir("lot-remettre", () => basculerActives(codesSelectionnes, true))}
              variante="secondaire"
              taille="petite"
            >
              Remettre au périmètre
            </Bouton>
            <Bouton
              enChargement={actionEnCours === "lot-retirer"}
              disabled={enCours}
              onClick={() =>
                agir("lot-retirer", async () => {
                  const r = await retirerCompetences(codesSelectionnes);
                  setAvis(
                    `${r.supprimees.length} supprimée(s), ${r.archivees.length} archivée(s).`,
                  );
                })
              }
              variante="secondaire"
              taille="petite"
            >
              Retirer
            </Bouton>
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

      {affiches.map(({ domaine, items }, i) => (
        <Fragment key={domaine.id}>
          {i === vivants.length && (
            <BandeauArchives
              nombre={archives.length}
              ouvert={archivesOuverts}
              onBasculer={() => setArchivesOuverts((o) => !o)}
            />
          )}
          <PanneauPliable
            // Un domaine périmé s'ouvre replié : on l'a déjà sorti du champ de
            // vision, l'ouvrir d'office le remettrait dedans.
            ouvertParDefaut={!perime({ domaine, items })}
            titre={
              <>
                <span className="text-sm font-medium">{domaine.nom}</span>
                <Etiquette mono>{domaine.prefixe}</Etiquette>
                {domaine.archive && <Etiquette>Archivé</Etiquette>}
                <span className="text-xs text-texte-discret">
                  {items.filter((s) => s.active && !s.archive).length} / {items.length} au périmètre
                </span>
              </>
            }
            actions={
              /*
                `retirerDomaine` existait depuis ADR-027, testée, et aucune
                interface ne l'appelait : retirer une branche entière se faisait
                donc compétence par compétence. Le mode est dérivé de la branche
                entière — archivage dès qu'une seule de ses compétences porte
                une preuve.
              */
              <>
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
                    <Bouton
                      enChargement={actionEnCours === `retirer-domaine-${domaine.id}`}
                      disabled={enCours}
                      onClick={() =>
                        agir(`retirer-domaine-${domaine.id}`, async () => {
                          const mode = await retirerDomaine(domaine.id);
                          setAvis(
                            mode === "suppression"
                              ? `Domaine « ${domaine.nom} » supprimé avec ses ${items.length} compétence(s).`
                              : `Domaine « ${domaine.nom} » archivé : ses preuves restent en base.`,
                          );
                        })
                      }
                      variante="secondaire"
                      taille="petite"
                    >
                      Confirmer le retrait du domaine
                    </Bouton>
                    <button
                      type="button"
                      onClick={() => setDomaineConfirme(null)}
                      className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <Bouton
                    disabled={enCours}
                    onClick={() => setDomaineConfirme(domaine.id)}
                    variante="discret"
                    taille="petite"
                  >
                    Retirer le domaine
                  </Bouton>
                )}
              </>
            }
            sousEntete={
              <>
                {domaine.description && (
                  <p className="mt-1 text-xs text-texte-attenue">{domaine.description}</p>
                )}
                {domaineConfirme === domaine.id && (
                  <BandeauInfo ton="info" taille="compacte" className="mt-2">
                    <p className="text-texte-attenue">
                      {items.some((s) => (retraits[s.code]?.preuves ?? 0) > 0) ? (
                        <>
                          <span className="font-medium">Archivage, pas suppression.</span> Au moins
                          une compétence de ce domaine porte des preuves : le domaine et ses{" "}
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
                  </BandeauInfo>
                )}
              </>
            }
            pied={
              /*
                Le tiroir des archivées d'un domaine vivant. Il n'apparaît que
                s'il a quelque chose à ranger, et il dit combien : un tiroir
                muet se confondrait avec un domaine sans archive.
              */
              !domaine.archive && items.some((s) => s.archive) ? (
                <TiroirRepliable
                  ouvert={archiveesOuvertes.has(domaine.id)}
                  onBasculer={() => basculerDans(domaine.id, archiveesOuvertes, setArchiveesOuvertes)}
                  className="border-t border-bordure px-4 py-2 text-[0.6875rem] text-texte-attenue hover:bg-surface-2 hover:text-texte"
                  libelle={
                    <>
                      {items.filter((s) => s.archive).length} compétence
                      {items.filter((s) => s.archive).length > 1 ? "s" : ""} archivée
                      {items.filter((s) => s.archive).length > 1 ? "s" : ""}
                    </>
                  }
                />
              ) : undefined
            }
          >
          <ul className="divide-y divide-bordure">
            {items
              .filter(
                (s) =>
                  // Les compétences archivées d'un domaine vivant sont repliées
                  // à part : elles ne comptent plus, et les laisser dans le flux
                  // fait chercher les vivantes au milieu d'elles.
                  !s.archive || domaine.archive || archiveesOuvertes.has(domaine.id),
              )
              .map((s) => {
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
                          enChargement={actionEnCours === `modifier-${s.code}`}
                          onAnnuler={() => setEdite(null)}
                          onValider={(champs) =>
                            agir(`modifier-${s.code}`, () => modifierCompetence(s.code, champs))
                          }
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
                        <Bouton
                          onClick={() => setEdite(s.code)}
                          disabled={enCours}
                          variante="secondaire"
                          taille="petite"
                        >
                          Modifier
                        </Bouton>

                        {s.archive ? (
                          <Bouton
                            enChargement={actionEnCours === `desarchiver-${s.code}`}
                            onClick={() => agir(`desarchiver-${s.code}`, () => desarchiverCompetence(s.code))}
                            disabled={enCours}
                            variante="secondaire"
                            taille="petite"
                          >
                            Désarchiver
                          </Bouton>
                        ) : (
                          <Bouton
                            enChargement={actionEnCours === `perimetre-${s.code}`}
                            onClick={() => agir(`perimetre-${s.code}`, () => basculerActive(s.code, !s.active))}
                            disabled={enCours}
                            variante="secondaire"
                            taille="petite"
                          >
                            {s.active ? "Sortir du périmètre" : "Remettre au périmètre"}
                          </Bouton>
                        )}

                        {!s.archive &&
                          (confirme === s.code ? (
                            <div className="flex items-center gap-1.5">
                              <Bouton
                                enChargement={actionEnCours === `retrait-${s.code}`}
                                onClick={() =>
                                  agir(`retrait-${s.code}`, () =>
                                    retrait.mode === "suppression"
                                      ? supprimerCompetence(s.code)
                                      : archiverCompetence(s.code),
                                  )
                                }
                                disabled={enCours}
                                variante="secondaire"
                                taille="petite"
                              >
                                Confirmer
                              </Bouton>
                              <button
                                type="button"
                                onClick={() => setConfirme(null)}
                                className="text-[0.6875rem] text-texte-attenue hover:text-texte"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <Bouton
                              onClick={() => setConfirme(s.code)}
                              disabled={enCours}
                              variante="secondaire"
                              taille="petite"
                            >
                              {retrait.mode === "suppression" ? "Supprimer" : "Archiver"}
                            </Bouton>
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
                    <BandeauInfo ton="info" taille="compacte" className="mt-2">
                      <p className="text-texte-attenue">
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
                    </BandeauInfo>
                  )}
                </li>
              );
            })}
          </ul>
          </PanneauPliable>
        </Fragment>
      ))}

      {/*
        Quand le dossier est replié, aucun groupe archivé n'est rendu : le
        bandeau ne peut plus s'insérer dans la liste, il se pose après elle.
      */}
      {archives.length > 0 && !archivesOuverts && (
        <BandeauArchives
          nombre={archives.length}
          ouvert={false}
          onBasculer={() => setArchivesOuverts(true)}
        />
      )}
    </div>
  );
}

/**
 * Le dossier des référentiels périmés.
 *
 * Un domaine archivé, ou dont plus aucune compétence n'est vivante, n'a plus à
 * occuper le champ de vision : il reste consultable, mais on va le chercher.
 * Le compte est affiché sur le bandeau replié — sinon le dossier ne dirait pas
 * s'il vaut la peine d'être ouvert.
 */
function BandeauArchives({
  nombre,
  ouvert,
  onBasculer,
}: {
  nombre: number;
  ouvert: boolean;
  onBasculer: () => void;
}) {
  return (
    <TiroirRepliable
      ouvert={ouvert}
      onBasculer={onBasculer}
      className="rounded-carte border border-dashed border-bordure px-4 py-2.5 text-xs text-texte-attenue hover:border-bordure hover:bg-surface-2 hover:text-texte"
      libelle={
        <>
          <span className="font-medium">Référentiels archivés</span>
          <span className="text-texte-discret">
            {nombre} domaine{nombre > 1 ? "s" : ""} — hors périmètre, preuves conservées
          </span>
        </>
      }
    />
  );
}

function FormulaireEdition({
  skill,
  enCours,
  enChargement,
  onValider,
  onAnnuler,
}: {
  skill: Skill;
  /** Une autre action que la sienne est en vol : désactive sans faire tourner. */
  enCours: boolean;
  /** Sa propre soumission est en vol. */
  enChargement: boolean;
  onValider: (champs: { intitule: string; palier: Palier; importance: number }) => void;
  onAnnuler: () => void;
}) {
  const [intitule, setIntitule] = useState(skill.intitule);
  const [palier, setPalier] = useState<Palier>(skill.palier);
  const [importance, setImportance] = useState(String(skill.importance));

  return (
    <div className="mt-2 space-y-2">
      <Champ label="Intitulé" value={intitule} onChange={(e) => setIntitule(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ChampSelect
          label="Palier"
          taille="compacte"
          value={palier}
          onChange={(e) => setPalier(e.target.value as Palier)}
          options={OPTIONS_PALIER}
        />
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
        <Bouton
          enChargement={enChargement}
          disabled={enCours || intitule.trim().length === 0}
          onClick={() =>
            onValider({
              intitule,
              palier,
              importance: Number.parseFloat(importance.replace(",", ".")),
            })
          }
          variante="principal"
          taille="petite"
        >
          Enregistrer
        </Bouton>
        <Bouton onClick={onAnnuler} disabled={enCours} variante="secondaire" taille="petite">
          Annuler
        </Bouton>
      </div>
    </div>
  );
}
