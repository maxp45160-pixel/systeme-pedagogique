"use client";

/**
 * Création d'un domaine ou ajout de compétences au référentiel.
 *
 * - Mode « Assisté par IA » (résolution sémantique, étapes de chargement, relecture avec cases à cocher).
 * - Mode « Choisir moi-même » (formulaire direct épuré).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { PaletteFormulesTexte } from "@/components/ui/palette-formules";
import { Modale } from "@/components/ui/modale";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { creerBranche } from "@/lib/store/referentiel-actions";
import type { CompetenceDejaAuReferentiel } from "@/lib/domain/gouvernance-referentiel";
import { AvisDejaAuReferentiel } from "./avis-deja-au-referentiel";
import { BlocDomaineCible } from "./bloc-domaine-cible";
import { normaliserPalier, prefixeParDefaut } from "@/lib/domain/referentiel-compte";
import type { Palier } from "@/lib/domain/types";

const PALIERS: Array<{ id: Palier; libelle: string; desc: string }> = [
  { id: "fondamentaux", libelle: "Fondamentaux", desc: "Socle & notions" },
  { id: "intermediaire", libelle: "Intermédiaire", desc: "Pratique & analyse" },
  { id: "avance", libelle: "Avancé", desc: "Maîtrise & synthèse" },
];

const IMPORTANCES = [
  { valeur: "1.0", libelle: "Essentielle", note: "Socle clé" },
  { valeur: "0.5", libelle: "Standard", note: "Pratique régulière" },
  { valeur: "0.2", libelle: "Complémentaire", note: "Approfondissement" },
];

export interface BrancheInitiale {
  domaine: string;
  prefixe: string;
  description: string;
  justification: string;
  competences: { intitule: string; palier: string; importance: string }[];
}

interface LigneCompetenceManuelle {
  intitule: string;
  palier: Palier;
  importance: string;
}

interface LigneCompetenceIA {
  intitule: string;
  palier: Palier;
  importance: string;
}

type ModeCreation = "ia" | "manuel";

type Etat =
  | { phase: "saisie" }
  | { phase: "resolution"; progression: string | null }
  | { phase: "relecture"; proposition: PropositionReferentiel }
  | { phase: "erreur"; message: string };

export function ModaleCompetence({
  onFermer,
  domainesExistants,
  compteId,
  domaineInitial,
  brancheInitiale,
  sujetInitial = "",
  modeCible,
  descriptionInitiale = "",
  suggestionAutomatique = false,
  surEnregistre,
}: {
  onFermer: () => void;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Domaine pré-rempli — quand on ouvre depuis une carte de domaine. */
  domaineInitial?: string;
  /** Cible explicite du besoin : la modale demande alors seulement le domaine de rattachement. */
  modeCible?: "domaine" | "competence";
  /** Branche pré-remplie — quand on ouvre depuis une proposition du tuteur. */
  brancheInitiale?: BrancheInitiale;
  /** Sujet déjà déclaré avant l'ouverture de la modale (sans valoir proposition). */
  sujetInitial?: string;
  /** Contexte libre conservé dans le formulaire, toujours modifiable. */
  descriptionInitiale?: string;
  /** Lance immédiatement la suggestion, pour l'amorçage d'un compte neuf. */
  suggestionAutomatique?: boolean;
  /** Permet à l'appelant de reprendre son flux après la création. */
  surEnregistre?: () => void;
}) {
  const router = useRouter();
  const competenceSeule = modeCible === "competence";
  const estDomaineExistant = Boolean(domaineInitial);
  const [domaineCible, setDomaineCible] = useState(
    domaineInitial ?? brancheInitiale?.domaine ?? "",
  );
  const domaineConnu = domainesExistants.find(
    (d) => d.nom.toLowerCase() === domaineCible.trim().toLowerCase(),
  );

  const [mode, setMode] = useState<ModeCreation>(() => {
    if (brancheInitiale && brancheInitiale.competences.length > 0) {
      return "ia";
    }
    return "ia";
  });

  const [intention, setIntention] = useState(
    sujetInitial || domaineInitial || brancheInitiale?.competences[0]?.intitule || "",
  );
  const [etat, setEtat] = useState<Etat>(() => {
    if (brancheInitiale && brancheInitiale.competences.length > 0) {
      return {
        phase: "relecture",
        proposition: {
          domaine: brancheInitiale.domaine,
          prefixe: brancheInitiale.prefixe,
          description: brancheInitiale.description,
          justification: brancheInitiale.justification,
          competences: brancheInitiale.competences,
        },
      };
    }
    return { phase: "saisie" };
  });

  const [enCours, demarrer] = useTransition();
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [dejaAuReferentiel, setDejaAuReferentiel] = useState<CompetenceDejaAuReferentiel[]>([]);

  // ÉTAT RELECTURE IA
  const [iaDomaine, setIaDomaine] = useState(
    brancheInitiale?.domaine ?? domaineInitial ?? "",
  );
  const [iaPrefixe, setIaPrefixe] = useState(
    brancheInitiale?.prefixe ?? domaineConnu?.prefixe ?? "",
  );
  const iaPrefixeManuelRef = useRef(Boolean(brancheInitiale?.prefixe));
  const [iaDescription, setIaDescription] = useState(
    brancheInitiale?.description ?? descriptionInitiale ?? "",
  );
  const [iaCompetences, setIaCompetences] = useState<LigneCompetenceIA[]>(() => {
    if (brancheInitiale?.competences && brancheInitiale.competences.length > 0) {
      return brancheInitiale.competences.map((c) => ({
        intitule: c.intitule,
        palier: normaliserPalier(c.palier),
        importance: c.importance || "0.5",
      }));
    }
    return [];
  });
  const [iaGarde, setIaGarde] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (brancheInitiale?.competences) {
      brancheInitiale.competences.forEach((_, idx) => {
        initial[idx] = true;
      });
    }
    return initial;
  });

  // ÉTAT MODE MANUEL
  const [manuelDomaine, setManuelDomaine] = useState(domaineInitial ?? "");
  const [manuelPrefixe, setManuelPrefixe] = useState(domaineConnu?.prefixe ?? "");
  const manuelPrefixeManuelRef = useRef(Boolean(domaineConnu?.prefixe));
  const [manuelDescription, setManuelDescription] = useState(descriptionInitiale ?? "");
  const [manuelLignes, setManuelLignes] = useState<LigneCompetenceManuelle[]>([
    { intitule: "", palier: "fondamentaux", importance: "0.5" },
  ]);

  const abandonRef = useRef<AbortController | null>(null);
  const suggestionLanceeRef = useRef(false);
  // Le sujet/intention est du texte pédagogique libre : palette (friction 1).
  const intentionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  function gererChangementManuelDomaine(valeur: string) {
    setManuelDomaine(valeur);
    if (!manuelPrefixeManuelRef.current) {
      setManuelPrefixe(prefixeParDefaut(valeur));
    }
  }

  function gererChangementDomaineCible(valeur: string) {
    setDomaineCible(valeur);
    setManuelDomaine(valeur);
    setIaDomaine(valeur);
  }

  function gererChangementIaDomaine(valeur: string) {
    setIaDomaine(valeur);
    if (!iaPrefixeManuelRef.current) {
      setIaPrefixe(prefixeParDefaut(valeur));
    }
  }

  const suggerer = useCallback(async () => {
    if (intention.trim().length === 0) return;
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setEtat({ phase: "resolution", progression: null });
    setErreurAction(null);
    setDejaAuReferentiel([]);

    try {
      const reponse = await fetch("/api/referentiel/suggerer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sujet: intention.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "erreur",
          message:
            donnees?.message ??
            "La suggestion n'a pas pu démarrer. Vérifiez la configuration du tuteur dans les réglages.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      let recu = false;

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const blocs = tampon.split("\n\n");
        tampon = blocs.pop() ?? "";

        for (const bloc of blocs) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!donnees) continue;

          if (type === "proposition") {
            const parsed = JSON.parse(donnees) as { branche: PropositionReferentiel };
            recu = true;
            const b = parsed.branche;
            setIaDomaine(domaineInitial || b.domaine);
            setIaPrefixe(domaineConnu?.prefixe || b.prefixe);
            iaPrefixeManuelRef.current = Boolean(domaineConnu?.prefixe || b.prefixe);
            setIaDescription(b.description || "");

            const compLignes = (b.competences || []).map((c) => ({
              intitule: c.intitule,
              palier: normaliserPalier(c.palier),
              importance: c.importance || "0.5",
            }));
            setIaCompetences(compLignes);

            const initialGarde: Record<number, boolean> = {};
            compLignes.forEach((_, idx) => {
              initialGarde[idx] = true;
            });
            setIaGarde(initialGarde);

            setEtat({ phase: "relecture", proposition: b });
          } else if (type === "erreur") {
            recu = true;
            setEtat({
              phase: "erreur",
              message: (JSON.parse(donnees) as { message: string }).message,
            });
          } else if (type === "proposition-en-cours") {
            setEtat({
              phase: "resolution",
              progression: "Le tuteur compose une branche de compétences…",
            });
          }
        }
      }

      if (!recu && !abandon.signal.aborted) {
        setEtat({
          phase: "erreur",
          message: "Le flux s'est interrompu avant que le tuteur n'ait répondu.",
        });
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "erreur", message: "Suggestion interrompue." });
      }
    }
  }, [intention, compteId, domaineInitial, domaineConnu]);

  useEffect(() => {
    if (!suggestionAutomatique || suggestionLanceeRef.current || intention.trim().length === 0)
      return;
    suggestionLanceeRef.current = true;
    void suggerer();
  }, [suggestionAutomatique, intention, suggerer]);

  // Mode IA : comptage des compétences sélectionnées
  const nbIaGardees = useMemo(() => {
    return iaCompetences.filter((_, idx) => iaGarde[idx]).length;
  }, [iaCompetences, iaGarde]);

  const tousIaCoches = nbIaGardees === iaCompetences.length && iaCompetences.length > 0;

  function toutBasculerIa() {
    const cible = !tousIaCoches;
    const maj: Record<number, boolean> = {};
    iaCompetences.forEach((_, idx) => {
      maj[idx] = cible;
    });
    setIaGarde(maj);
  }

  function enregistrerIa() {
    const retenues = iaCompetences.filter((_, idx) => iaGarde[idx]);
    const nomFinal = (competenceSeule ? domaineCible : estDomaineExistant ? domaineInitial : iaDomaine) ?? "";
    const prefixeFinal = competenceSeule
      ? domaineConnu?.prefixe ?? ""
      : (domaineConnu ? domaineConnu.prefixe : iaPrefixe) ?? "";

    if (retenues.length === 0 || nomFinal.trim().length === 0) return;
    setErreurAction(null);
    setDejaAuReferentiel([]);

    demarrer(async () => {
      try {
        const r = await creerBranche({
          domaine: nomFinal.trim(),
          prefixe: prefixeFinal.trim(),
          description: competenceSeule ? "" : iaDescription.trim(),
          competences: retenues.map((c) => ({
            intitule: c.intitule.trim(),
            palier: c.palier,
            importance: c.importance,
          })),
          origine: "tuteur",
          signalerCroissanceReferentiel: true,
        });

        if (r.dejaAuReferentiel && r.dejaAuReferentiel.length > 0) {
          setDejaAuReferentiel(r.dejaAuReferentiel);
        } else {
          surEnregistre?.();
          onFermer();
          router.refresh();
        }
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  function majManuelLigne(i: number, maj: Partial<LigneCompetenceManuelle>) {
    setManuelLignes((ls) => ls.map((x, k) => (k === i ? { ...x, ...maj } : x)));
  }

  function ajouterManuelLigne() {
    const dernierPalier = manuelLignes[manuelLignes.length - 1]?.palier ?? "fondamentaux";
    setManuelLignes((ls) => [
      ...ls,
      { intitule: "", palier: dernierPalier, importance: "0.5" },
    ]);
  }

  const retenuesManuelles = manuelLignes.filter((l) => l.intitule.trim().length > 0);
  const domaineManuelFinal = (competenceSeule ? domaineCible : estDomaineExistant ? domaineInitial : manuelDomaine) ?? "";
  const pretManuel = domaineManuelFinal.trim().length > 2 && retenuesManuelles.length > 0;

  function enregistrerManuel() {
    if (!pretManuel) return;
    const prefixeFinal = competenceSeule
      ? domaineConnu?.prefixe ?? ""
      : (domaineConnu ? domaineConnu.prefixe : manuelPrefixe) ?? "";
    setErreurAction(null);
    setDejaAuReferentiel([]);

    demarrer(async () => {
      try {
        const r = await creerBranche({
          domaine: domaineManuelFinal.trim(),
          prefixe: prefixeFinal.trim(),
          description: competenceSeule ? "" : manuelDescription.trim(),
          competences: retenuesManuelles.map((l) => ({
            intitule: l.intitule.trim(),
            palier: l.palier,
            importance: l.importance,
          })),
          origine: "manuel",
          signalerCroissanceReferentiel: true,
        });

        if (r.dejaAuReferentiel && r.dejaAuReferentiel.length > 0) {
          setDejaAuReferentiel(r.dejaAuReferentiel);
        } else {
          surEnregistre?.();
          onFermer();
          router.refresh();
        }
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  const titreModale = estDomaineExistant || competenceSeule
    ? "Ajouter une compétence"
    : "Nouveau domaine d’apprentissage";
  const sousTitreModale = estDomaineExistant || competenceSeule
    ? `Ajoute une compétence observable et mesurable au domaine.`
    : "Définis une nouvelle branche du référentiel et ses compétences.";

  return (
    <Modale
      titre={titreModale}
      sousTitre={sousTitreModale}
      largeur="xl"
      onFermer={onFermer}
    >
      <div className="space-y-4">
        {/* Onglets Mode IA / Mode Manuel */}
        {etat.phase === "saisie" && (
          <div className="flex rounded-lg border border-bordure bg-surface-2 p-1 text-xs">
            <button
              type="button"
              onClick={() => setMode("ia")}
              className={cx(
                "flex-1 rounded-md py-1.5 font-medium transition-colors cursor-pointer",
                mode === "ia"
                  ? "bg-surface text-primaire shadow-sm"
                  : "text-texte-discret hover:text-texte",
              )}
            >
              Assisté par IA
            </button>
            <button
              type="button"
              onClick={() => setMode("manuel")}
              className={cx(
                "flex-1 rounded-md py-1.5 font-medium transition-colors cursor-pointer",
                mode === "manuel"
                  ? "bg-surface text-primaire shadow-sm"
                  : "text-texte-discret hover:text-texte",
              )}
            >
              Choisir moi-même
            </button>
          </div>
        )}

        {erreurAction && (
          <BandeauInfo ton="danger" taille="compacte">
            <p className="text-danger">{erreurAction}</p>
          </BandeauInfo>
        )}

        {/* MODE IA : Saisie */}
        {mode === "ia" && (etat.phase === "saisie" || etat.phase === "erreur") && (
          <div className="space-y-3">
            {etat.phase === "erreur" && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{etat.message}</p>
              </BandeauInfo>
            )}

            {(estDomaineExistant || competenceSeule) && (
              <BlocDomaineCible
                competenceSeule={competenceSeule}
                estDomaineExistant={estDomaineExistant}
                idListe="domaines-existants-competence"
                domaineCible={domaineCible}
                onChangerDomaine={gererChangementDomaineCible}
                domainesExistants={domainesExistants}
                prefixeConnu={domaineConnu?.prefixe}
              />
            )}

            <label className="block">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                {estDomaineExistant || competenceSeule
                  ? "Sujet ou intention pour ce domaine"
                  : "Objectif ou sujet du domaine"}
              </span>
              <div className="mt-1 flex justify-end">
                <PaletteFormulesTexte
                  champ={intentionRef}
                  valeur={intention}
                  onChange={setIntention}
                />
              </div>
              <textarea
                ref={intentionRef}
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                rows={3}
                placeholder={
                  estDomaineExistant || competenceSeule
                    ? "ex : Manipulation d'arbres binaires, analyse de complexité et optimisation..."
                    : "ex : Cryptographie moderne, architectures distribuées, protocoles décentralisés..."
                }
                className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
              />
            </label>

            <Bouton
              onClick={() => void suggerer()}
              disabled={intention.trim().length === 0}
              variante="principal"
              className="w-full justify-center"
            >
              {estDomaineExistant
                ? "Suggérer des compétences pour ce domaine"
                : "Suggérer le domaine et ses compétences"}
            </Bouton>
          </div>
        )}

        {/* MODE IA : Résolution en cours */}
        {mode === "ia" && etat.phase === "resolution" && (
          <div className="py-6">
            <ChargementGeneration
              progressionServeur={etat.progression}
              etapes={[
                "Analyse du domaine et de l'axe d'apprentissage…",
                "Formulation des compétences associées…",
                "Définition des critères d'évaluation…",
                "Finalisation de la branche…",
              ]}
              dureeAsymptoteSec={7}
              onArreter={() => {
                abandonRef.current?.abort();
                setEtat({ phase: "saisie" });
              }}
            />
          </div>
        )}

        {/* MODE IA : Relecture de la proposition */}
        {mode === "ia" && etat.phase === "relecture" && (
          <div className="space-y-4">
              {(estDomaineExistant || competenceSeule) && (
              <BlocDomaineCible
                competenceSeule={competenceSeule}
                estDomaineExistant={estDomaineExistant}
                idListe="domaines-existants-competence-relecture"
                domaineCible={domaineCible}
                onChangerDomaine={gererChangementDomaineCible}
                domainesExistants={domainesExistants}
                prefixeConnu={domaineConnu?.prefixe}
                detaille
              />
            )}
            {!(estDomaineExistant || competenceSeule) && (
              <div className="space-y-3 rounded-xl border border-bordure bg-surface-2/30 p-3.5">
                <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                  <label className="block">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                      Nom du domaine *
                    </span>
                    <input
                      type="text"
                      value={iaDomaine}
                      onChange={(e) => gererChangementIaDomaine(e.target.value)}
                      className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-sm font-medium focus:border-primaire focus:outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                      Préfixe (3-4 l.)
                    </span>
                    <input
                      type="text"
                      value={iaPrefixe}
                      onChange={(e) => {
                        iaPrefixeManuelRef.current = true;
                        setIaPrefixe(e.target.value.toUpperCase());
                      }}
                      maxLength={5}
                      className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 font-mono text-sm uppercase font-medium focus:border-primaire focus:outline-none"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                    Description (facultative)
                  </span>
                  <input
                    type="text"
                    value={iaDescription}
                    onChange={(e) => setIaDescription(e.target.value)}
                    placeholder="Périmètre et objectifs pédagogiques du domaine…"
                    className="mt-1 w-full rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none"
                  />
                </label>
              </div>
            )}

            {etat.proposition.justification && (
              <p className="text-xs italic text-texte-attenue">
                « {etat.proposition.justification} »
              </p>
            )}

            <div className="flex items-baseline justify-between gap-2 border-b border-bordure pb-1">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Compétences proposées ({nbIaGardees}/{iaCompetences.length})
              </p>
              <button
                type="button"
                onClick={toutBasculerIa}
                className="text-[0.6875rem] text-primaire hover:underline cursor-pointer"
              >
                {tousIaCoches ? "Tout décocher" : "Tout cocher"}
              </button>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {iaCompetences.map((comp, idx) => {
                const coche = iaGarde[idx] ?? true;
                const palierInfo = PALIERS.find((p) => p.id === comp.palier);
                const impInfo = IMPORTANCES.find((imp) => imp.valeur === comp.importance);

                return (
                  <label
                    key={idx}
                    className={cx(
                      "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs transition-colors",
                      coche
                        ? "border-primaire/40 bg-primaire-faible"
                        : "border-bordure bg-surface opacity-60 hover:opacity-100",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={coche}
                      onChange={(e) =>
                        setIaGarde((prev) => ({ ...prev, [idx]: e.target.checked }))
                      }
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-medium text-texte leading-snug">{comp.intitule}</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[0.625rem]">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-texte-discret">
                          {palierInfo?.libelle ?? comp.palier}
                        </span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 font-medium text-texte-discret">
                          {impInfo?.libelle ?? comp.importance}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}

              {iaCompetences.length === 0 && (
                <p className="py-4 text-center text-xs text-texte-discret">
                  Aucune compétence générée.
                </p>
              )}
            </div>

            <AvisDejaAuReferentiel competences={dejaAuReferentiel} />

            <div className="flex items-center gap-2 pt-2">
              <Bouton
                onClick={enregistrerIa}
                disabled={
                  enCours ||
                  nbIaGardees === 0 ||
                  (competenceSeule ? domaineCible.trim().length === 0 : !estDomaineExistant && iaDomaine.trim().length === 0)
                }
                variante="principal"
                className="flex-1 justify-center"
              >
                {enCours
                  ? "Enregistrement…"
                  : !estDomaineExistant && !competenceSeule
                  ? `Créer le domaine (${nbIaGardees} compétence${nbIaGardees > 1 ? "s" : ""})`
                  : `Ajouter les compétences (${nbIaGardees})`}
              </Bouton>
              <button
                type="button"
                onClick={() => setEtat({ phase: "saisie" })}
                disabled={enCours}
                className="px-3 py-2 text-xs text-texte-attenue hover:text-texte cursor-pointer"
              >
                Retour
              </button>
            </div>
          </div>
        )}

        {/* MODE MANUEL : Formulaire direct */}
        {mode === "manuel" && (
          <div className="space-y-4">
            {(estDomaineExistant || competenceSeule) && (
              <BlocDomaineCible
                competenceSeule={competenceSeule}
                estDomaineExistant={estDomaineExistant}
                idListe="domaines-existants-competence-manuel"
                domaineCible={domaineCible}
                onChangerDomaine={gererChangementDomaineCible}
                domainesExistants={domainesExistants}
                prefixeConnu={domaineConnu?.prefixe}
                detaille
              />
            )}
            {!(estDomaineExistant || competenceSeule) && (
              <div className="space-y-3 rounded-xl border border-bordure bg-surface-2/30 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                    Nouveau Domaine
                  </span>
                  <span className="text-[0.6875rem] text-texte-discret">
                    Branche d’apprentissage
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                  <div>
                    <label className="block text-xs font-medium text-texte-attenue mb-1">
                      Nom du domaine *
                    </label>
                    <input
                      value={manuelDomaine}
                      onChange={(e) => gererChangementManuelDomaine(e.target.value)}
                      placeholder="Ex : Cryptographie & Sécurité"
                      className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-texte-attenue mb-1">
                      Préfixe (3-4 l.)
                    </label>
                    <input
                      value={manuelPrefixe}
                      onChange={(e) => {
                        manuelPrefixeManuelRef.current = true;
                        setManuelPrefixe(e.target.value.toUpperCase());
                      }}
                      placeholder="Ex : CRYP"
                      maxLength={5}
                      className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 font-mono text-sm uppercase text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-texte-attenue mb-1">
                    Description (facultative)
                  </label>
                  <input
                    value={manuelDescription}
                    onChange={(e) => setManuelDescription(e.target.value)}
                    placeholder="Périmètre et objectifs pédagogiques du domaine…"
                    className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-xs text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
                  />
                </div>
              </div>
            )}

            {/* Liste des compétences manuelles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
                  {manuelLignes.length > 1
                    ? `Compétences à ajouter (${manuelLignes.length})`
                    : "Compétence"}
                </label>
                <span className="text-[0.6875rem] text-texte-discret">
                  Le code est attribué automatiquement
                </span>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {manuelLignes.map((l, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-texte">
                          Intitulé de la compétence *
                        </label>
                        {manuelLignes.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setManuelLignes((ls) => ls.filter((_, k) => k !== i))
                            }
                            className="text-[0.6875rem] text-texte-discret hover:text-danger cursor-pointer transition-colors"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                      <input
                        value={l.intitule}
                        onChange={(e) => majManuelLigne(i, { intitule: e.target.value })}
                        placeholder="Ex : Analyser les structures logiques d'un argument et ses présupposés"
                        className="w-full rounded-lg border border-bordure bg-surface-2/40 px-3 py-2 text-sm font-medium text-texte placeholder:text-texte-discret focus:border-primaire focus:bg-surface outline-none transition-all shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-1">
                        Palier d&apos;apprentissage
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {PALIERS.map((p) => {
                          const actif = l.palier === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => majManuelLigne(i, { palier: p.id })}
                              className={cx(
                                "flex flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all cursor-pointer",
                                actif
                                  ? "border-primaire bg-primaire-faible text-primaire shadow-xs"
                                  : "border-bordure bg-surface hover:border-primaire/40 hover:bg-surface-2 text-texte-attenue",
                              )}
                            >
                              <span className="text-xs font-semibold">{p.libelle}</span>
                              <span className="mt-0.5 text-[0.625rem] opacity-75 hidden sm:inline">
                                {p.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-1">
                        Niveau d&apos;importance
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {IMPORTANCES.map((imp) => {
                          const actif = l.importance === imp.valeur;
                          return (
                            <button
                              key={imp.valeur}
                              type="button"
                              onClick={() => majManuelLigne(i, { importance: imp.valeur })}
                              className={cx(
                                "flex items-center justify-center rounded-lg border py-1 px-2 text-xs transition-all cursor-pointer",
                                actif
                                  ? "border-primaire bg-primaire/10 text-primaire font-semibold"
                                  : "border-bordure bg-surface hover:bg-surface-2 text-texte-discret",
                              )}
                            >
                              <span>{imp.libelle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={ajouterManuelLigne}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primaire hover:underline cursor-pointer"
              >
                <span>+ Ajouter une autre compétence</span>
              </button>
            </div>

            <AvisDejaAuReferentiel competences={dejaAuReferentiel} />

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-bordure">
              <Bouton
                type="button"
                variante="secondaire"
                disabled={enCours}
                onClick={onFermer}
              >
                Annuler
              </Bouton>
              <Bouton
                type="button"
                onClick={enregistrerManuel}
                disabled={!pretManuel || enCours}
                enChargement={enCours}
                variante="principal"
              >
                {enCours
                  ? "Enregistrement…"
                  : !estDomaineExistant && !competenceSeule
                  ? retenuesManuelles.length > 1
                    ? `Créer le domaine et ses ${retenuesManuelles.length} compétences`
                    : "Créer le domaine"
                  : retenuesManuelles.length > 1
                  ? `Ajouter les ${retenuesManuelles.length} compétences`
                  : "Ajouter la compétence"}
              </Bouton>
            </div>
          </div>
        )}
      </div>
    </Modale>
  );
}
