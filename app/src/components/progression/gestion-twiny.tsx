"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Domaine, LearningSession, Skill } from "@/lib/domain/types";
import type {
  CarteGlobale,
  CorrespondanceCarteGlobale,
  SelectionCarteGlobale,
} from "@/lib/domain/carte-globale";
import {
  HORIZONS_OBJECTIF,
  type CibleObjectif,
  type Objectif,
  type Parcours,
  type StatutObjectif,
  type StatutParcours,
} from "@/lib/domain/objectifs";
import {
  deselectionnerElementGlobal,
  rattacherCompetenceElementGlobal,
  retirerCorrespondanceCompetenceElementGlobal,
  selectionnerElementGlobal,
} from "@/lib/store/carte-globale-actions";
import {
  archiverObjectif,
  archiverParcours,
  changerStatutObjectif,
  changerStatutParcours,
  creerObjectif,
  creerParcours,
  modifierObjectif,
  rattacherSessionParcours,
} from "@/lib/store/objectifs-actions";
import { Bouton, Etiquette, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

const provenance = {
  type: "declaration-utilisateur",
  reference: "Déclaré depuis Progression",
};

function requestId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cibleLibelle(cible: CibleObjectif, carte: CarteGlobale, domaines: Domaine[], competences: Skill[]) {
  if (cible.type === "element-global") return carte.elements.find((e) => e.id === cible.elementId)?.nom ?? "Repère global";
  if (cible.type === "relation-globale") return `Relation : ${carte.relations.find((r) => r.id === cible.relationId)?.type ?? "globale"}`;
  if (cible.type === "domaine-local") return domaines.find((d) => d.id === cible.domaineId)?.nom ?? cible.domaineId;
  return competences.find((c) => c.code === cible.code)?.intitule ?? cible.code;
}

function libelleRelation(type: string): string {
  return type === "PART_OF" ? "fait partie de"
    : type === "PREREQUISITE_OF" ? "est prérequis de"
      : type === "RELATED_TO" ? "est lié à"
        : type === "APPLIED_IN" ? "s’applique dans"
          : "rend possible";
}

export function NavigationTwiny() {
  return (
    <nav aria-label="Sections de Progression" className="flex flex-wrap gap-2 rounded-xl border border-bordure bg-surface-2/50 p-2">
      {[
        ["bilan", "Bilan"],
        ["explorer", "Explorer"],
        ["objectifs", "Objectifs"],
        ["parcours", "Parcours"],
      ].map(([id, libelle]) => (
        <a key={id} href={`#${id}`} className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-texte-attenue hover:border-bordure hover:bg-surface hover:text-texte">
          {libelle}
        </a>
      ))}
    </nav>
  );
}

export function ExplorerCarteGlobale({
  carte,
  selections,
  correspondances,
  competences,
}: {
  carte: CarteGlobale;
  selections: SelectionCarteGlobale[];
  correspondances: CorrespondanceCarteGlobale[];
  competences: Skill[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [recherche, setRecherche] = useState("");
  const [elementId, setElementId] = useState<string | null>(null);
  const [competenceCode, setCompetenceCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cibleObjectif, setCibleObjectif] = useState<CibleObjectif | null>(null);
  const [formulationObjectif, setFormulationObjectif] = useState("");
  const selectionIds = new Set(selections.map((selection) => selection.elementId));
  const elements = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");
    return carte.elements.filter((element) =>
      !terme || `${element.nom} ${element.description}`.toLocaleLowerCase("fr").includes(terme),
    );
  }, [carte.elements, recherche]);
  const element = carte.elements.find((item) => item.id === elementId) ?? elements[0];
  const correspondancesElement = correspondances.filter((item) => item.elementGlobalId === element?.id);

  function executer(action: () => Promise<void>, succes: string) {
    setMessage(null);
    demarrer(async () => {
      try {
        await action();
        setMessage(succes);
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Action impossible.");
      }
    });
  }

  function creerObjectifDepuisCarte() {
    if (!cibleObjectif || formulationObjectif.trim().length < 3) return;
    executer(
      async () => {
        await creerObjectif(
          {
            formulation: formulationObjectif.trim(),
            cible: cibleObjectif,
            priorite: 3,
            horizon: "moyen-terme",
          },
          requestId("objectif"),
          provenance,
        );
        setFormulationObjectif("");
        setCibleObjectif(null);
      },
      "Objectif créé depuis la carte.",
    );
  }

  return (
    <section id="explorer" className="scroll-mt-6 rounded-2xl border border-bordure bg-surface p-5 shadow-xs sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-bordure/60 pb-4">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">Explorer la carte globale</h2>
          <p className="mt-1 max-w-2xl text-sm text-texte-attenue">Des repères communs, publiés avec une source. Les états de votre compte restent privés.</p>
        </div>
        <span className="text-xs text-texte-discret">{carte.elements.length} repère{carte.elements.length > 1 ? "s" : ""} · {carte.relations.length} relation{carte.relations.length > 1 ? "s" : ""}</span>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-3">
          <Champ label="Rechercher dans la carte" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Ex. algorithme, modèle, domaine…" />
          {elements.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {elements.map((item) => {
                const actif = item.id === element?.id;
                const selectionne = selectionIds.has(item.id);
                return (
                  <li key={item.id} className={cx("rounded-xl border p-3 transition-colors", actif ? "border-primaire bg-primaire/5" : "border-bordure bg-surface-2")}>
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setElementId(item.id)} className="min-w-0 text-left">
                        <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">{item.type}</span>
                        <span className="mt-1 block text-sm font-medium text-texte">{item.nom}</span>
                      </button>
                      <Bouton
                        type="button"
                        variante={selectionne ? "principal" : "secondaire"}
                        taille="compacte"
                        disabled={enCours}
                        onClick={() => executer(
                          () => selectionne ? deselectionnerElementGlobal(item.id) : selectionnerElementGlobal(item.id),
                          selectionne ? "Repère retiré de votre carte." : "Repère ajouté à votre carte.",
                        )}
                      >
                        {selectionne ? "Retirer" : "Sélectionner"}
                      </Bouton>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-texte-attenue">{item.description || "Aucune description."}</p>
                    <p className="mt-2 text-[0.6875rem] text-texte-discret">Source : {item.provenance.reference}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-bordure px-4 py-6 text-sm text-texte-discret">La carte globale ne contient encore aucun repère publié.</p>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-bordure bg-surface-2/60 p-4">
          {element ? (
            <>
              <div>
                <span className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">Repère choisi</span>
                <h3 className="mt-1 text-base font-semibold text-texte">{element.nom}</h3>
                <p className="mt-1 text-xs text-texte-attenue">{element.description}</p>
                <Bouton
                  type="button"
                  variante="secondaire"
                  taille="compacte"
                  className="mt-3"
                  disabled={enCours}
                  onClick={() => setCibleObjectif({ type: "element-global", elementId: element.id })}
                >
                  Créer un objectif pour ce repère
                </Bouton>
              </div>

              <div className="border-t border-bordure/60 pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Relations publiées</h3>
                {carte.relations.filter((relation) => relation.sourceId === element.id || relation.cibleId === element.id).length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-xs text-texte-attenue">
                    {carte.relations.filter((relation) => relation.sourceId === element.id || relation.cibleId === element.id).map((relation) => {
                      const autreId = relation.sourceId === element.id ? relation.cibleId : relation.sourceId;
                      const autre = carte.elements.find((item) => item.id === autreId);
                      return (
                        <li key={relation.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{relation.sourceId === element.id ? "Ce repère" : autre?.nom ?? "Ce repère"} {libelleRelation(relation.type)} {relation.sourceId === element.id ? autre?.nom ?? "un autre repère" : element.nom}.</span>
                          <button
                            type="button"
                            className="shrink-0 text-primaire hover:underline"
                            onClick={() => setCibleObjectif({ type: "relation-globale", relationId: relation.id })}
                          >
                            Créer un objectif
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : <p className="mt-2 text-xs text-texte-discret">Aucune relation publiée pour ce repère.</p>}
              </div>

              {cibleObjectif && (
                <div className="border-t border-bordure/60 pt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Nouvel objectif</h3>
                  <p className="mt-1 text-xs text-texte-attenue">La cible est conservée telle que choisie ; la priorité initiale est 3/5 et l’horizon moyen terme.</p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <Champ label="Formulation" value={formulationObjectif} onChange={(event) => setFormulationObjectif(event.target.value)} placeholder="Ce que je veux accomplir…" className="min-w-[14rem] flex-1" />
                    <Bouton type="button" variante="principal" taille="compacte" disabled={formulationObjectif.trim().length < 3 || enCours} onClick={creerObjectifDepuisCarte}>Créer</Bouton>
                    <Bouton type="button" variante="secondaire" taille="compacte" onClick={() => setCibleObjectif(null)}>Annuler</Bouton>
                  </div>
                </div>
              )}

              <div className="border-t border-bordure/60 pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Relier une compétence locale</h3>
                <p className="mt-1 text-xs text-texte-attenue">Ce geste est privé, explicite et retirable. Il ne mesure pas la compétence.</p>
                <div className="mt-2 flex gap-2">
                  <select aria-label="Compétence locale à relier" value={competenceCode} onChange={(event) => setCompetenceCode(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte">
                    <option value="">Choisir une compétence</option>
                    {competences.filter((competence) => competence.active && !competence.archive).map((competence) => <option key={competence.code} value={competence.code}>{competence.intitule}</option>)}
                  </select>
                  <Bouton type="button" variante="secondaire" taille="compacte" disabled={!competenceCode || enCours} onClick={() => executer(() => rattacherCompetenceElementGlobal(competenceCode, element.id, provenance), "Correspondance enregistrée.")}>Relier</Bouton>
                </div>
                {correspondancesElement.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {correspondancesElement.map((correspondance) => {
                      const competence = competences.find((item) => item.code === correspondance.competenceCode);
                      return <li key={`${correspondance.competenceCode}-${correspondance.elementGlobalId}`} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-texte">{competence?.intitule ?? correspondance.competenceCode}</span><button type="button" disabled={enCours} onClick={() => executer(() => retirerCorrespondanceCompetenceElementGlobal(correspondance.competenceCode, correspondance.elementGlobalId), "Correspondance retirée.")} className="shrink-0 text-primaire hover:underline">Retirer</button></li>;
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-texte-discret">Sélectionnez un repère pour voir ses relations et le relier à votre référentiel.</p>
          )}
          {message && <p className="text-xs text-texte-attenue" role="status">{message}</p>}
        </div>
      </div>
    </section>
  );
}

function CibleSelect({
  carte,
  domaines,
  competences,
  value,
  onChange,
}: {
  carte: CarteGlobale;
  domaines: Domaine[];
  competences: Skill[];
  value: CibleObjectif;
  onChange: (cible: CibleObjectif) => void;
}) {
  const type = value.type;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <select aria-label="Type de cible" value={type} onChange={(event) => {
        const next = event.target.value as CibleObjectif["type"];
        onChange(next === "element-global" ? { type: next, elementId: carte.elements[0]?.id ?? "" } : next === "relation-globale" ? { type: next, relationId: carte.relations[0]?.id ?? "" } : next === "domaine-local" ? { type: next, domaineId: domaines[0]?.id ?? "" } : { type: next, code: competences[0]?.code ?? "" });
      }} className="rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte">
        <option value="element-global">Repère global</option>
        <option value="relation-globale">Relation globale</option>
        <option value="domaine-local">Domaine local</option>
        <option value="competence-locale">Compétence locale</option>
      </select>
      <select aria-label="Référence de cible" value={"elementId" in value ? value.elementId : "relationId" in value ? value.relationId : "domaineId" in value ? value.domaineId : value.code} onChange={(event) => {
        const next = event.target.value;
        onChange(type === "element-global" ? { type, elementId: next } : type === "relation-globale" ? { type, relationId: next } : type === "domaine-local" ? { type, domaineId: next } : { type, code: next });
      }} className="rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte">
        {type === "element-global" && carte.elements.map((element) => <option key={element.id} value={element.id}>{element.nom}</option>)}
        {type === "relation-globale" && carte.relations.map((relation) => <option key={relation.id} value={relation.id}>{relation.type}</option>)}
        {type === "domaine-local" && domaines.map((domaine) => <option key={domaine.id} value={domaine.id}>{domaine.nom}</option>)}
        {type === "competence-locale" && competences.map((competence) => <option key={competence.code} value={competence.code}>{competence.intitule}</option>)}
      </select>
    </div>
  );
}

function cibleInitiale(carte: CarteGlobale, domaines: Domaine[], competences: Skill[]): CibleObjectif {
  if (carte.elements[0]) return { type: "element-global", elementId: carte.elements[0].id };
  if (domaines[0]) return { type: "domaine-local", domaineId: domaines[0].id };
  return { type: "competence-locale", code: competences[0]?.code ?? "" };
}

export function GestionObjectifsParcours({
  carte,
  domaines,
  competences,
  objectifs,
  parcours,
  sessions,
}: {
  carte: CarteGlobale;
  domaines: Domaine[];
  competences: Skill[];
  objectifs: Objectif[];
  parcours: Parcours[];
  sessions: LearningSession[];
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [formulation, setFormulation] = useState("");
  const [priorite, setPriorite] = useState("3");
  const [horizon, setHorizon] = useState<(typeof HORIZONS_OBJECTIF)[number]>("moyen-terme");
  const [echeanceLe, setEcheanceLe] = useState("");
  const [cible, setCible] = useState<CibleObjectif>(() => cibleInitiale(carte, domaines, competences));
  const [contexteParcours, setContexteParcours] = useState("");
  const [edition, setEdition] = useState<string | null>(null);
  const [sessionParcours, setSessionParcours] = useState<Record<string, string>>({});

  function executer(action: () => Promise<unknown>, succes: string) {
    setMessage(null);
    demarrer(async () => {
      try {
        await action();
        setMessage(succes);
        router.refresh();
      } catch (erreur) {
        setMessage(erreur instanceof Error ? erreur.message : "Action impossible.");
      }
    });
  }

  function creer() {
    executer(() => creerObjectif({ formulation, cible, priorite: Number(priorite), horizon, ...(echeanceLe ? { echeanceLe } : {}) }, requestId("objectif"), provenance), "Objectif créé.");
    setFormulation("");
  }

  function creerDepuisObjectif(objectif: Objectif) {
    executer(() => creerParcours({ objectifId: objectif.id, contexte: contexteParcours.trim() || objectif.formulation, cible: objectif.cible }, requestId("parcours"), provenance), "Parcours créé depuis l’objectif.");
    setContexteParcours("");
  }

  function statutObjectif(objectif: Objectif, statut: StatutObjectif) {
    executer(() => changerStatutObjectif(objectif.id, objectif.version, statut, objectif.statut, requestId("objectif-statut"), provenance), `Objectif ${statut}.`);
  }

  function statutParcours(chemin: Parcours, statut: StatutParcours) {
    executer(() => changerStatutParcours(chemin.id, chemin.version, statut, chemin.statut, requestId("parcours-statut"), provenance), `Parcours ${statut}.`);
  }

  return (
    <>
      <section id="objectifs" className="scroll-mt-6 rounded-2xl border border-bordure bg-surface p-5 shadow-xs sm:p-7">
        <div className="border-b border-bordure/60 pb-4">
          <h2 className="font-serif text-xl font-medium tracking-tight">Objectifs</h2>
          <p className="mt-1 text-sm text-texte-attenue">Plusieurs objectifs peuvent coexister. Chacun garde sa formulation, sa cible, sa priorité et son cycle de vie.</p>
        </div>
        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <div className="space-y-3">
            {objectifs.filter((objectif) => !objectif.archiveLe).map((objectif) => (
              <article key={objectif.id} className="rounded-xl border border-bordure bg-surface-2 p-4">
                {edition === objectif.id ? (
                  <div className="space-y-3">
                    <Champ label="Formulation" value={formulation || objectif.formulation} onChange={(event) => setFormulation(event.target.value)} />
                    <CibleSelect carte={carte} domaines={domaines} competences={competences} value={cible} onChange={setCible} />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <Champ label="Priorité" type="number" min={1} max={5} value={priorite} onChange={(event) => setPriorite(event.target.value)} />
                      <label className="text-xs text-texte-attenue">Horizon<select value={horizon} onChange={(event) => setHorizon(event.target.value as typeof horizon)} className="mt-1 block w-full rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte">{HORIZONS_OBJECTIF.map((item) => <option key={item}>{item}</option>)}</select></label>
                      <Champ label="Échéance" type="date" value={echeanceLe} onChange={(event) => setEcheanceLe(event.target.value)} />
                    </div>
                    <div className="flex gap-2"><Bouton type="button" variante="principal" taille="compacte" disabled={enCours} onClick={() => { executer(() => modifierObjectif(objectif.id, objectif.version, { formulation: formulation || objectif.formulation, cible, priorite: Number(priorite), horizon, ...(echeanceLe ? { echeanceLe } : {}) }, requestId("objectif-modification"), provenance), "Objectif modifié."); setEdition(null); }}>Enregistrer</Bouton><Bouton type="button" variante="secondaire" taille="compacte" onClick={() => setEdition(null)}>Annuler</Bouton></div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2"><p className="font-medium text-texte">{objectif.formulation}</p><Etiquette ton={objectif.statut === "actif" ? "succes" : "info"}>{objectif.statut}</Etiquette></div>
                    <p className="mt-2 text-xs text-texte-attenue">Cible : {cibleLibelle(objectif.cible, carte, domaines, competences)} · priorité {objectif.priorite}/5 · {objectif.horizon}{objectif.echeanceLe ? ` · échéance ${objectif.echeanceLe}` : ""}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><Bouton type="button" variante="secondaire" taille="compacte" onClick={() => { setEdition(objectif.id); setFormulation(objectif.formulation); setCible(objectif.cible); setPriorite(String(objectif.priorite)); setHorizon(objectif.horizon); setEcheanceLe(objectif.echeanceLe ?? ""); }}>Modifier</Bouton>{objectif.statut === "brouillon" && <Bouton type="button" variante="principal" taille="compacte" disabled={enCours} onClick={() => statutObjectif(objectif, "actif")}>Activer</Bouton>}{objectif.statut === "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutObjectif(objectif, "en-pause")}>Mettre en pause</Bouton>}{objectif.statut === "en-pause" && <Bouton type="button" variante="principal" taille="compacte" disabled={enCours} onClick={() => statutObjectif(objectif, "actif")}>Reprendre</Bouton>}{objectif.statut === "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutObjectif(objectif, "atteint")}>Marquer atteint</Bouton>}{(objectif.statut === "actif" || objectif.statut === "en-pause" || objectif.statut === "brouillon") && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutObjectif(objectif, "abandonne")}>Abandonner</Bouton>}{objectif.statut !== "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => executer(() => archiverObjectif(objectif.id, objectif.version, requestId("objectif-archive"), provenance), "Objectif archivé.")}>Archiver</Bouton>}</div>
                    <div className="mt-3 border-t border-bordure/60 pt-3"><label className="text-xs text-texte-attenue">Créer un parcours depuis cet objectif<textarea value={contexteParcours} onChange={(event) => setContexteParcours(event.target.value)} placeholder="Contexte de travail facultatif" rows={2} className="mt-1 block w-full rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte" /></label><Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => creerDepuisObjectif(objectif)} className="mt-2">Créer le parcours</Bouton></div>
                  </>
                )}
              </article>
            ))}
            {objectifs.length === 0 && <p className="rounded-xl border border-dashed border-bordure px-4 py-6 text-sm text-texte-discret">Aucun objectif structuré. Commencez par en créer un.</p>}
          </div>
          <div className="rounded-xl border border-bordure bg-surface-2/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Nouvel objectif</h3>
            <div className="mt-3 space-y-3"><Champ label="Ce que vous voulez atteindre" value={formulation} onChange={(event) => setFormulation(event.target.value)} placeholder="Formulation exacte de votre objectif" multiligne rows={3} /><CibleSelect carte={carte} domaines={domaines} competences={competences} value={cible} onChange={setCible} /><div className="grid gap-2 sm:grid-cols-3"><Champ label="Priorité" type="number" min={1} max={5} value={priorite} onChange={(event) => setPriorite(event.target.value)} /><label className="text-xs text-texte-attenue">Horizon<select value={horizon} onChange={(event) => setHorizon(event.target.value as typeof horizon)} className="mt-1 block w-full rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte">{HORIZONS_OBJECTIF.map((item) => <option key={item}>{item}</option>)}</select></label><Champ label="Échéance" type="date" value={echeanceLe} onChange={(event) => setEcheanceLe(event.target.value)} /></div><Bouton type="button" variante="principal" disabled={!formulation.trim() || enCours} onClick={creer}>Créer l’objectif</Bouton></div>
          </div>
        </div>
        {message && <p className="mt-4 text-xs text-texte-attenue" role="status">{message}</p>}
      </section>

      <section id="parcours" className="scroll-mt-6 rounded-2xl border border-bordure bg-surface p-5 shadow-xs sm:p-7">
        <div className="border-b border-bordure/60 pb-4"><h2 className="font-serif text-xl font-medium tracking-tight">Parcours</h2><p className="mt-1 text-sm text-texte-attenue">Un parcours donne un contexte à un objectif et peut reprendre une séance existante. Il devient prioritaire lorsqu’il est actif.</p></div>
        <div className="mt-4 space-y-3">{parcours.filter((chemin) => !chemin.archiveLe).map((chemin) => <article key={chemin.id} className="rounded-xl border border-bordure bg-surface-2 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium text-texte">{chemin.contexte}</p><p className="mt-1 text-xs text-texte-attenue">Cible : {cibleLibelle(chemin.cible, carte, domaines, competences)}{chemin.objectifId ? " · issu d’un objectif" : ""}</p></div><Etiquette ton={chemin.statut === "actif" ? "succes" : "info"}>{chemin.statut}</Etiquette></div><div className="mt-3 flex flex-wrap gap-2">{chemin.statut === "brouillon" && <Bouton type="button" variante="principal" taille="compacte" disabled={enCours} onClick={() => statutParcours(chemin, "actif")}>Activer</Bouton>}{chemin.statut === "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutParcours(chemin, "en-pause")}>Mettre en pause</Bouton>}{chemin.statut === "en-pause" && <Bouton type="button" variante="principal" taille="compacte" disabled={enCours} onClick={() => statutParcours(chemin, "actif")}>Reprendre</Bouton>}{chemin.statut === "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutParcours(chemin, "termine")}>Terminer</Bouton>}{(chemin.statut === "actif" || chemin.statut === "en-pause" || chemin.statut === "brouillon") && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => statutParcours(chemin, "abandonne")}>Abandonner</Bouton>}{chemin.statut !== "actif" && <Bouton type="button" variante="secondaire" taille="compacte" disabled={enCours} onClick={() => executer(() => archiverParcours(chemin.id, chemin.version, requestId("parcours-archive"), provenance), "Parcours archivé.")}>Archiver</Bouton>}</div><div className="mt-3 flex flex-wrap items-end gap-2 border-t border-bordure/60 pt-3"><label className="min-w-[14rem] flex-1 text-xs text-texte-attenue">Rattacher une séance<select value={sessionParcours[chemin.id] ?? ""} onChange={(event) => setSessionParcours((avant) => ({ ...avant, [chemin.id]: event.target.value }))} className="mt-1 block w-full rounded-lg border border-bordure bg-surface px-2.5 py-2 text-xs text-texte"><option value="">Choisir une séance existante</option>{sessions.map((session) => <option key={session.id} value={session.id}>{session.date.slice(0, 10)} · {session.id}</option>)}</select></label><Bouton type="button" variante="secondaire" taille="compacte" disabled={!sessionParcours[chemin.id] || enCours} onClick={() => executer(() => rattacherSessionParcours(chemin.id, sessionParcours[chemin.id], requestId("session-rattachee"), provenance), "Séance rattachée.")}>Rattacher</Bouton></div></article>)}{parcours.length === 0 && <p className="rounded-xl border border-dashed border-bordure px-4 py-6 text-sm text-texte-discret">Aucun parcours. Créez-en un depuis un objectif.</p>}</div>
      </section>
    </>
  );
}
