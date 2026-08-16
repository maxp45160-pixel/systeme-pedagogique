"use client";

/**
 * Création d'un thème transversal (chantier « thèmes », ADR-053).
 *
 * Permet de créer un thème reliant des compétences de plusieurs domaines,
 * soit avec l'aide de l'IA (résolution sémantique d'intention),
 * soit manuellement par sélection directe dans le référentiel.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionTheme } from "@/lib/tutor/outils";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { creerTheme } from "@/lib/store/theme-actions";
import type { Theme } from "@/lib/domain/theme";

type ModeCreation = "ia" | "manuel";

type Etat =
  | { phase: "saisie" }
  | { phase: "resolution"; progression: string | null }
  | { phase: "relecture"; proposition: PropositionTheme }
  | { phase: "aucune-correspondance"; proposition: PropositionTheme }
  | { phase: "erreur"; message: string };

export function ModaleTheme({
  competencesParCode,
  compteId,
  domainesExistants,
  intentionInitiale = "",
  onFermer,
  onCree,
  presentation = "modale",
}: {
  /** Intitulé et domaine, pour afficher chaque code désigné lisiblement. */
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  compteId: string;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  intentionInitiale?: string;
  onFermer: () => void;
  onCree: (theme: Theme) => void;
  presentation?: "modale" | "inline";
}) {
  const [mode, setMode] = useState<ModeCreation>("ia");
  const [intention, setIntention] = useState(intentionInitiale);
  const [etat, setEtat] = useState<Etat>({ phase: "saisie" });
  const [garde, setGarde] = useState<Record<string, boolean>>({});
  const [libelle, setLibelle] = useState("");
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const abandonRef = useRef<AbortController | null>(null);
  const [creationCompetenceOuverte, setCreationCompetenceOuverte] = useState(false);

  // Pour le mode manuel
  const [rechercheManuelle, setRechercheManuelle] = useState("");
  const [codesManuels, setCodesManuels] = useState<Record<string, boolean>>({});
  const [libelleManuel, setLibelleManuel] = useState("");
  const [domainesReplies, setDomainesReplies] = useState<Record<string, boolean>>({});

  function basculerRepliDomaine(domaineNom: string) {
    setDomainesReplies((prev) => ({ ...prev, [domaineNom]: !prev[domaineNom] }));
  }

  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  async function resoudre() {
    if (intention.trim().length === 0) return;
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setEtat({ phase: "resolution", progression: null });
    setErreurAction(null);

    try {
      const reponse = await fetch("/api/themes/resoudre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          texte: intention.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "erreur",
          message: donnees?.message ?? "La résolution n'a pas pu démarrer.",
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
            const p = (JSON.parse(donnees) as { theme: PropositionTheme | null }).theme;
            recu = true;
            if (!p) {
              setEtat({
                phase: "erreur",
                message: "Le tuteur n'a rendu aucune résolution exploitable.",
              });
            } else if (p.codes.length === 0) {
              setEtat({ phase: "aucune-correspondance", proposition: p });
            } else {
              const initial: Record<string, boolean> = {};
              p.codes.forEach((c) => (initial[c] = true));
              setGarde(initial);
              setLibelle(p.libelle);
              setEtat({ phase: "relecture", proposition: p });
            }
          } else if (type === "erreur") {
            recu = true;
            setEtat({
              phase: "erreur",
              message: (JSON.parse(donnees) as { message: string }).message,
            });
          } else if (type === "proposition-en-cours") {
            setEtat({ phase: "resolution", progression: "Le tuteur cherche dans tes compétences…" });
          }
        }
      }

      if (!recu && !abandon.signal.aborted) {
        setEtat({
          phase: "erreur",
          message:
            "Le flux s'est interrompu avant que le tuteur n'ait répondu. Rien n'a été créé — relance la résolution.",
        });
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "erreur", message: "Résolution interrompue." });
      }
    }
  }

  function enregistrer(p: PropositionTheme) {
    const codes = p.codes.filter((c) => garde[c]);
    if (codes.length === 0 || libelle.trim().length === 0) return;
    setErreurAction(null);
    demarrer(async () => {
      try {
        const theme = await creerTheme({
          libelle: libelle.trim(),
          intention: intention.trim(),
          codes,
          origine: "tuteur",
        });
        onCree(theme);
        onFermer();
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "Le thème n'a pas pu être enregistré.");
      }
    });
  }

  function enregistrerManuel() {
    const codes = Object.keys(codesManuels).filter((c) => codesManuels[c]);
    if (codes.length === 0 || libelleManuel.trim().length === 0) return;
    setErreurAction(null);
    demarrer(async () => {
      try {
        const theme = await creerTheme({
          libelle: libelleManuel.trim(),
          codes,
          origine: "utilisateur",
        });
        onCree(theme);
        onFermer();
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "Le thème n'a pas pu être enregistré.");
      }
    });
  }

  const p = etat.phase === "relecture" ? etat.proposition : null;
  const codesGardes = p ? p.codes.filter((c) => garde[c]) : [];
  const tousCoches = p ? codesGardes.length === p.codes.length : false;

  function toutBasculer() {
    if (!p) return;
    const cible = !tousCoches;
    const maj: Record<string, boolean> = {};
    p.codes.forEach((c) => (maj[c] = cible));
    setGarde(maj);
  }

  // Liste ordonnée et filtrée pour le mode manuel
  // Regroupement par domaine pour la relecture IA et pour le mode manuel
  const propositionParDomaine = useMemo(() => {
    if (etat.phase !== "relecture") return [];
    const map = new Map<string, string[]>();
    for (const code of etat.proposition.codes) {
      const info = competencesParCode.get(code);
      const dom = info?.domaine || "Autres compétences";
      const liste = map.get(dom) ?? [];
      liste.push(code);
      map.set(dom, liste);
    }
    return Array.from(map.entries()).map(([domaineNom, codes]) => ({
      domaineNom,
      codes,
    }));
  }, [etat, competencesParCode]);

  const domainesAvecCompetences = useMemo(() => {
    const q = rechercheManuelle.trim().toLowerCase();
    const map = new Map<string, { code: string; intitule: string }[]>();

    competencesParCode.forEach((info, code) => {
      const correspond =
        !q ||
        code.toLowerCase().includes(q) ||
        info.intitule.toLowerCase().includes(q) ||
        info.domaine.toLowerCase().includes(q);

      if (correspond) {
        const dom = info.domaine || "Général";
        const liste = map.get(dom) ?? [];
        liste.push({ code, intitule: info.intitule });
        map.set(dom, liste);
      }
    });

    return Array.from(map.entries()).map(([domaineNom, competences]) => ({
      domaineNom,
      competences: competences.sort((a, b) => a.code.localeCompare(b.code)),
    }));
  }, [competencesParCode, rechercheManuelle]);

  const nbCodesManuelsSelectionnes = useMemo(
    () => Object.values(codesManuels).filter(Boolean).length,
    [codesManuels],
  );

  function basculerDomaineManuel(codesDomaine: string[]) {
    const tousSelectionnes = codesDomaine.every((c) => codesManuels[c]);
    setCodesManuels((prev) => {
      const maj = { ...prev };
      for (const c of codesDomaine) {
        maj[c] = !tousSelectionnes;
      }
      return maj;
    });
  }

  function basculerDomaineIA(codesDomaine: string[]) {
    const tousSelectionnes = codesDomaine.every((c) => garde[c]);
    setGarde((prev) => {
      const maj = { ...prev };
      for (const c of codesDomaine) {
        maj[c] = !tousSelectionnes;
      }
      return maj;
    });
  }

  if (creationCompetenceOuverte) {
    const justification =
      etat.phase === "aucune-correspondance" ? etat.proposition.justification ?? "" : "";
    return (
      <ModaleCompetence
        onFermer={() => setCreationCompetenceOuverte(false)}
        domainesExistants={domainesExistants}
        compteId={compteId}
        sujetInitial={intention.trim()}
        descriptionInitiale={intention.trim()}
        justificationInitiale={justification}
        surEnregistre={() => {
          setCreationCompetenceOuverte(false);
          setEtat({ phase: "saisie" });
        }}
      />
    );
  }

  const contenu = (
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
            🪄 Assisté par IA
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
            ✍️ Sélection par domaine
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
          <label className="block">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Objectif ou sujet transversal
            </span>
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              rows={3}
              placeholder="ex : IA, modèles de langage, vision et diffusion pour construire des applications multimodales."
              className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
            />
          </label>
          <Bouton
            onClick={() => void resoudre()}
            disabled={intention.trim().length === 0}
            variante="principal"
            className="w-full justify-center"
          >
            Chercher les compétences correspondantes
          </Bouton>
        </div>
      )}

      {/* MODE IA : Résolution en cours */}
      {mode === "ia" && etat.phase === "resolution" && (
        <div className="py-6">
          <ChargementGeneration
            progressionServeur={etat.progression}
            etapes={[
              "Analyse de ton sujet transversal…",
              "Rapprochement avec tes domaines et compétences…",
              "Sélection des compétences clés…",
              "Finalisation du thème…",
            ]}
            dureeAsymptoteSec={6}
            onArreter={() => {
              abandonRef.current?.abort();
              setEtat({ phase: "saisie" });
            }}
          />
        </div>
      )}

      {/* MODE IA : Aucune correspondance */}
      {mode === "ia" && etat.phase === "aucune-correspondance" && (
        <div className="space-y-3">
          <BandeauInfo ton="info" taille="compacte">
            <p>
              Aucune compétence active ne correspond à <em>« {intention.trim()} »</em>.
            </p>
            {etat.proposition.justification && (
              <p className="mt-1 text-texte-attenue">{etat.proposition.justification}</p>
            )}
          </BandeauInfo>
          <div className="flex flex-wrap items-center gap-2">
            <Bouton
              onClick={() => setCreationCompetenceOuverte(true)}
              variante="principal"
            >
              Ajouter des compétences sur ce sujet
            </Bouton>
            <button
              type="button"
              onClick={() => setEtat({ phase: "saisie" })}
              className="text-xs text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
            >
              Reformuler
            </button>
          </div>
        </div>
      )}

      {/* MODE IA : Relecture de la proposition groupée par domaine */}
      {mode === "ia" && etat.phase === "relecture" && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Nom du thème
            </span>
            <input
              type="text"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-sm font-medium"
            />
          </label>

          {etat.proposition.justification && (
            <p className="text-xs italic text-texte-attenue">
              « {etat.proposition.justification} »
            </p>
          )}

          <div className="flex items-baseline justify-between gap-2 border-b border-bordure pb-1">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Compétences sélectionnées ({codesGardes.length}/{etat.proposition.codes.length})
            </p>
            <button
              type="button"
              onClick={toutBasculer}
              className="text-[0.6875rem] text-primaire hover:underline cursor-pointer"
            >
              {tousCoches ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {propositionParDomaine.map((groupe) => {
              const nbCoches = groupe.codes.filter((c) => garde[c]).length;
              const tousGroupe = nbCoches === groupe.codes.length;
              const estReplie = Boolean(domainesReplies[`ia-${groupe.domaineNom}`]);
              return (
                <div
                  key={groupe.domaineNom}
                  className="rounded-xl border border-bordure bg-surface/70 p-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-bordure/60 pb-1.5">
                    <button
                      type="button"
                      onClick={() => basculerRepliDomaine(`ia-${groupe.domaineNom}`)}
                      className="flex items-center gap-1.5 text-left cursor-pointer group select-none min-w-0"
                    >
                      <span className="text-[10px] text-texte-discret group-hover:text-texte transition-transform">
                        {estReplie ? "▶" : "▼"}
                      </span>
                      <span className="text-xs font-semibold text-texte group-hover:text-primaire transition-colors truncate">
                        {groupe.domaineNom}
                      </span>
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret font-medium shrink-0">
                        {nbCoches}/{groupe.codes.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => basculerDomaineIA(groupe.codes)}
                      className="text-[0.6875rem] text-primaire hover:underline cursor-pointer shrink-0"
                    >
                      {tousGroupe ? "Décocher domaine" : "Tout cocher"}
                    </button>
                  </div>
                  {!estReplie && (
                    <div className="space-y-1">
                      {groupe.codes.map((code) => {
                        const info = competencesParCode.get(code);
                        const coche = garde[code] ?? true;
                        return (
                          <label
                            key={code}
                            className={cx(
                              "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                              coche
                                ? "border-primaire/40 bg-primaire-faible"
                                : "border-bordure bg-surface opacity-60 hover:opacity-100",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={coche}
                              onChange={(e) =>
                                setGarde((prev) => ({ ...prev, [code]: e.target.checked }))
                              }
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="font-mono text-[0.6875rem] text-texte-discret">
                                {code}
                              </span>{" "}
                              <span className="font-medium text-texte">
                                {info?.intitule ?? code}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Bouton
              onClick={() => enregistrer(etat.proposition)}
              disabled={enCours || codesGardes.length === 0 || libelle.trim().length === 0}
              variante="principal"
              className="flex-1 justify-center"
            >
              {enCours ? "Création…" : `Créer le thème (${codesGardes.length} compétences)`}
            </Bouton>
            <button
              type="button"
              onClick={() => setEtat({ phase: "saisie" })}
              disabled={enCours}
              className="px-3 py-2 text-xs text-texte-attenue hover:text-texte"
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* MODE MANUEL : Groupé par Domaine avec accordéon */}
      {mode === "manuel" && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Titre du thème
            </span>
            <input
              type="text"
              value={libelleManuel}
              onChange={(e) => setLibelleManuel(e.target.value)}
              placeholder="ex : IA multimodale & Deep Learning"
              className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-sm font-medium focus:border-primaire focus:outline-none"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Compétences sélectionnées : {nbCodesManuelsSelectionnes}
              </span>
              <div className="flex items-center gap-2 text-[0.6875rem]">
                {domainesAvecCompetences.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const tousDejaReplies =
                          domainesAvecCompetences.every((g) => domainesReplies[g.domaineNom]);
                        const maj: Record<string, boolean> = {};
                        if (!tousDejaReplies) {
                          domainesAvecCompetences.forEach((g) => (maj[g.domaineNom] = true));
                        }
                        setDomainesReplies(maj);
                      }}
                      className="text-texte-discret hover:underline cursor-pointer"
                    >
                      {domainesAvecCompetences.every((g) => domainesReplies[g.domaineNom])
                        ? "Tout déplier"
                        : "Tout replier"}
                    </button>
                    <span className="text-texte-discret">·</span>
                  </>
                )}
                {nbCodesManuelsSelectionnes > 0 && (
                  <button
                    type="button"
                    onClick={() => setCodesManuels({})}
                    className="text-texte-discret hover:underline cursor-pointer"
                  >
                    Tout décocher
                  </button>
                )}
              </div>
            </div>

            <input
              type="search"
              value={rechercheManuelle}
              onChange={(e) => setRechercheManuelle(e.target.value)}
              placeholder="Filtrer par intitulé, code ou domaine…"
              className="w-full rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs placeholder:text-texte-discret mb-2.5"
            />

            <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
              {domainesAvecCompetences.map((groupe) => {
                const codesDuGroupe = groupe.competences.map((c) => c.code);
                const nbCoches = codesDuGroupe.filter((c) => codesManuels[c]).length;
                const tousCoches = nbCoches === codesDuGroupe.length && codesDuGroupe.length > 0;
                const estReplie = Boolean(domainesReplies[groupe.domaineNom]);

                return (
                  <div
                    key={groupe.domaineNom}
                    className="rounded-xl border border-bordure bg-surface/70 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-bordure/60 pb-1.5">
                      <button
                        type="button"
                        onClick={() => basculerRepliDomaine(groupe.domaineNom)}
                        className="flex items-center gap-1.5 text-left cursor-pointer group select-none min-w-0"
                      >
                        <span className="text-[10px] text-texte-discret group-hover:text-texte transition-transform">
                          {estReplie ? "▶" : "▼"}
                        </span>
                        <span className="text-xs font-semibold text-texte group-hover:text-primaire transition-colors truncate">
                          {groupe.domaineNom}
                        </span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.625rem] text-texte-discret font-medium shrink-0">
                          {nbCoches}/{groupe.competences.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => basculerDomaineManuel(codesDuGroupe)}
                        className="text-[0.6875rem] text-primaire hover:underline cursor-pointer font-medium shrink-0"
                      >
                        {tousCoches ? "Tout décocher" : "Tout cocher"}
                      </button>
                    </div>

                    {!estReplie && (
                      <div className="space-y-1">
                        {groupe.competences.map((comp) => {
                          const coche = Boolean(codesManuels[comp.code]);
                          return (
                            <label
                              key={comp.code}
                              className={cx(
                                "flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                                coche
                                  ? "border-primaire/40 bg-primaire-faible"
                                  : "border-bordure bg-surface hover:bg-surface-2",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={coche}
                                onChange={(e) =>
                                  setCodesManuels((prev) => ({
                                    ...prev,
                                    [comp.code]: e.target.checked,
                                  }))
                                }
                                className="mt-0.5"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-mono text-[0.6875rem] text-texte-discret mr-1.5">
                                  {comp.code}
                                </span>
                                <span className="font-medium text-texte">{comp.intitule}</span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {domainesAvecCompetences.length === 0 && (
                <p className="py-4 text-center text-xs text-texte-discret">
                  Aucune compétence trouvée.
                </p>
              )}
            </div>
          </div>

          <Bouton
            onClick={enregistrerManuel}
            disabled={
              enCours || nbCodesManuelsSelectionnes === 0 || libelleManuel.trim().length === 0
            }
            variante="principal"
            className="w-full justify-center"
          >
            {enCours
              ? "Création…"
              : `Créer le thème (${nbCodesManuelsSelectionnes} compétences)`}
          </Bouton>
        </div>
      )}
    </div>
  );

  if (presentation === "inline") {
    return (
      <div className="space-y-3 rounded-lg border border-primaire/30 bg-surface-2 p-4">
        <div className="flex items-center justify-between border-b border-bordure pb-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primaire">
              Nouveau thème transversal
            </h3>
            <p className="text-[0.6875rem] text-texte-discret">
              Regroupe des compétences complémentaires à travers plusieurs domaines.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="p-1 text-xs text-texte-attenue hover:text-texte cursor-pointer"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        {contenu}
      </div>
    );
  }

  return (
    <Modale
      titre="Nouveau thème transversal"
      sousTitre="Regroupe des compétences complémentaires issues de différents domaines."
      onFermer={onFermer}
    >
      {contenu}
    </Modale>
  );
}
