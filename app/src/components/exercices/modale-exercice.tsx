"use client";

/**
 * Modale de génération d'exercice — créer là où on est.
 *
 * Un composant partagé par les points de génération contextuels : tableau de
 * bord, fiche compétence, tiroir du tuteur et évolution du référentiel.
 *
 * La compétence est pré-remplie par `recommander()`, changeable. La difficulté
 * et l'angle sont dérivés par `calibrer()` et **affichés avec leur source**,
 * jamais saisis (ADR-028). Le thème est un indice de rédaction, pas un
 * sélecteur d'objet.
 *
 * Génération → prévisualisation dans la modale → « Enregistrer » → la liste se
 * met à jour sans rechargement. Fermer la modale abandonne la génération
 * (`request.signal`, câblé côté route).
 *
 * ⚠️ Deux règles portées ici, et chacune a déjà coûté :
 *
 *  1. **Le calibrage suit le sélecteur.** Les calibrages arrivent indexés par
 *     code (`calibragesPourModale`) et sont relus à chaque changement de
 *     compétence. Une prop unique laissait afficher la difficulté d'une autre
 *     compétence que celle visée — P3 rompu.
 *  2. **Rien n'est fabriqué à l'enregistrement.** `convertirProposition`
 *     refuse une difficulté ou une durée illisibles au lieu d'y substituer un
 *     défaut (ADR-034, P2). La modale affiche alors ce qui cloche.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  BandeauInfo,
  Bouton,
  cx,
  Etiquette,
} from "@/components/ui/primitives";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { Modale, type LargeurModale } from "@/components/ui/modale";
import { Markdown } from "@/components/ui/markdown";
import { creerExercice } from "@/lib/store/actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { convertirProposition } from "@/lib/tutor/conversion-exercice";
import type { PropositionExercice } from "@/lib/tutor/proposition";
import { DIFFICULTES, LIBELLES_DIMENSIONS, type Dimension } from "@/lib/domain/types";
import { EXERCICES_PAR_LOT_MAX } from "@/lib/domain/exercice";
import type {
  CalibrageModale,
  CompetenceModale,
} from "./proprietes-generation";

export type { CalibrageModale, CompetenceModale };

export function ModaleExercice({
  onFermer,
  competences,
  competenceInitiale,
  themeInitial = "",
  calibrages,
  compteId,
  surEnregistre,
  propositionInitiale,
  competencesCibles,
  ouvrirDansCahierApresAcceptation = false,
  presentation = "modale",
}: {
  onFermer: () => void;
  competences: CompetenceModale[];
  competenceInitiale: string;
  /**
   * Génération groupée : un lot de codes à générer d'un coup, en un seul
   * appel modèle (`genererExercices` accepte déjà plusieurs demandes). Quand
   * ce tableau porte plus d'un code, la modale saute le formulaire — le
   * geste est déjà déclaré par le bouton qui l'a ouverte (« Générer les N
   * exercices manquants ») — et lance la génération directement à l'ouverture.
   * Bornée à `EXERCICES_PAR_LOT_MAX`, la même borne que côté route.
   */
  competencesCibles?: string[];
  /**
   * Thème pré-rempli, modifiable.
   *
   * Sert à l'élargissement d'une compétence maîtrisée (ADR-042) : le contexte
   * proposé par le tuteur devient le thème de l'exercice. Un contexte n'est pas
   * un objet de base — `SkillEvidence.contexte` est le titre de l'exercice —
   * donc il n'a pas d'autre endroit où vivre que là.
   */
  themeInitial?: string;
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
  /** Appelé après l'enregistrement d'un exercice — pour rafraîchir la liste. */
  surEnregistre?: (id: string) => void;
  /**
   * Proposition déjà reçue (issue du chat, audit §2.3) : la modale démarre
   * directement en prévisualisation sur cette proposition, sans repasser par le
   * fournisseur. La compétence visée est la première code proposé, sinon la
   * compétence initiale passée.
   */
  propositionInitiale?: PropositionExercice;
  /** Depuis la prochaine action, accepter enchaîne directement sur le workspace focus. */
  ouvrirDansCahierApresAcceptation?: boolean;
  /**
   * Où le contenu se pose. `modale` par défaut — la coquille flottante.
   *
   * `inline` sert au tiroir du tuteur, qui est **lui-même** une `Modale` :
   * empiler une seconde surface `aria-modal` par-dessus la première imbrique
   * deux pièges de focus et rend `Échap` ambigu — la touche ferme celle qui a
   * posé son écouteur en dernier, jamais celle que la personne regarde. Le
   * contenu est identique ; seule la coquille disparaît.
   */
  presentation?: "modale" | "inline";
}) {
  const router = useRouter();
  /**
   * Le lot borné — `null` en mode compétence unique. Bornage ici, à la
   * frontière du composant : la route et `genererExercices` acceptent déjà
   * jusqu'à `EXERCICES_PAR_LOT_MAX` demandes, mais rien n'empêchait un
   * appelant d'en envoyer plus.
   */
  const codesLot = useMemo(
    () =>
      competencesCibles && competencesCibles.length > 0
        ? competencesCibles.slice(0, EXERCICES_PAR_LOT_MAX)
        : null,
    [competencesCibles],
  );
  const [code, setCode] = useState(
    propositionInitiale?.competences[0] ?? competenceInitiale,
  );
  const [theme, setTheme] = useState(themeInitial);
  const [phase, setPhase] = useState<"formulaire" | "generation" | "previsualisation">(
    propositionInitiale ? "previsualisation" : codesLot ? "generation" : "formulaire",
  );
  const [propositions, setPropositions] = useState<PropositionExercice[]>(
    propositionInitiale ? [propositionInitiale] : [],
  );
  const [indexActif, setIndexActif] = useState(0);
  /** Index des propositions déjà enregistrées — pas un drapeau global. */
  const [enregistrees, setEnregistrees] = useState<Set<number>>(new Set());
  /**
   * Index de la proposition en cours d'écriture, `null` si aucune.
   *
   * `enregistrees` n'était posé qu'APRÈS la résolution de `creerExercice` :
   * pendant l'aller-retour, le bouton restait actif et deux clics créaient deux
   * exercices identiques (audit §2.6). Un index plutôt qu'un booléen parce que
   * la modale rend plusieurs propositions : seule celle qu'on écrit se
   * verrouille, les autres restent enregistrables.
   */
  const [enEcriture, setEnEcriture] = useState<number | null>(null);
  const [enEcritureTout, setEnEcritureTout] = useState(false);
  const [pourquoi, setPourquoi] = useState(false);
  const [modificationIndex, setModificationIndex] = useState<number | null>(null);
  const [consigneModification, setConsigneModification] = useState("");
  const [progression, setProgression] = useState<string | null>(null);
  const [exercicesRecus, setExercicesRecus] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const abandonRef = useRef<AbortController | null>(null);

  const totalExercicesCibles = modificationIndex !== null ? 1 : (codesLot?.length ?? 1);

  const dureeAsymptoteSec = useMemo(() => {
    if (totalExercicesCibles <= 1) return 8;
    return Math.max(10, Math.min(60, 5 + totalExercicesCibles * 6));
  }, [totalExercicesCibles]);

  const etapesGeneration = useMemo(() => {
    if (totalExercicesCibles <= 1) return ETAPES_GENERATION;
    return [
      `Analyse des ${totalExercicesCibles} compétences ciblées…`,
      "Calibration des niveaux et des difficultés…",
      `Rédaction des ${totalExercicesCibles} exercices par le tuteur IA…`,
      "Vérification des critères et correction…",
      "Finalisation du lot d'exercices…",
    ];
  }, [totalExercicesCibles]);

  const pourcentageMinimum = useMemo(() => {
    if (totalExercicesCibles <= 1 || exercicesRecus === 0) return 0;
    return Math.min(90, Math.round((exercicesRecus / totalExercicesCibles) * 90));
  }, [totalExercicesCibles, exercicesRecus]);

  /*
   * La modale est montée à l'ouverture et démontée à la fermeture
   * (`BoutonGenerer`), donc l'état repart neuf à chaque fois. Il reste à
   * abandonner la génération en cours au démontage : sans quoi le fournisseur
   * continue de rédiger, facturé, pour un texte que plus personne ne lit.
   */
  const competence = competences.find((c) => c.code === code);
  // Relu à chaque rendu : c'est ce qui fait suivre le calibrage au sélecteur.
  const cal = calibrages[code] ?? null;

  const generer = useCallback(async (
    modification?: {
      proposition: PropositionExercice;
      index: number;
      consigne: string;
    },
    controleurExplicite?: AbortController,
  ) => {
    const codesAEnvoyer = modification
      ? modification.proposition.competences.slice(0, 1)
      : codesLot ?? (competence ? [competence.code] : []);
    if (codesAEnvoyer.length === 0) return;
    setPhase("generation");
    setProgression(null);
    setExercicesRecus(0);
    setErreur(null);
    if (!modification) {
      setPropositions([]);
      setEnregistrees(new Set());
    }

    const configClient = lireConfigTuteur(compteId) ?? undefined;
    const abandon = controleurExplicite ?? new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/exercices/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          competences: codesAEnvoyer,
          theme: theme.trim() || undefined,
          config: configClient,
          ...(modification
            ? {
                modification: {
                  proposition: modification.proposition,
                  consigne: modification.consigne,
                },
              }
            : {}),
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La génération n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
        );
        setPhase(modification ? "previsualisation" : "formulaire");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      let recue = false;

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const evenements = tampon.split("\n\n");
        tampon = evenements.pop() ?? "";

        for (const bloc of evenements) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();

          if (type === "propositions" && donnees) {
            const parsed = JSON.parse(donnees) as { exercices: PropositionExercice[] };
            recue = true;
            if (modification && parsed.exercices[0]) {
              setPropositions((liste) => liste.map((proposition, index) =>
                index === modification.index ? parsed.exercices[0] : proposition,
              ));
              setModificationIndex(null);
              setConsigneModification("");
            } else {
              setPropositions(parsed.exercices);
              setIndexActif(0);
            }
            setPhase("previsualisation");
          } else if (type === "proposition" && donnees) {
            try {
              const parsed = JSON.parse(donnees) as { genre?: string; exercice?: PropositionExercice };
              if (parsed.genre === "exercice" && parsed.exercice) {
                setExercicesRecus((prev) => {
                  const suivant = prev + 1;
                  const total = codesAEnvoyer.length;
                  if (total > 1) {
                    setProgression(
                      suivant < total
                        ? `Exercice ${suivant}/${total} rédigé · En cours pour le suivant…`
                        : `Les ${total} exercices sont rédigés · Finalisation…`,
                    );
                  }
                  return suivant;
                });
              }
            } catch {
              /* ignorer erreur json */
            }
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            recue = true;
            setErreur(parsed.message);
            setPhase(modification ? "previsualisation" : "formulaire");
          } else if (type === "proposition-en-cours") {
            if (codesAEnvoyer.length > 1) {
              setProgression(`Rédaction des ${codesAEnvoyer.length} exercices par le tuteur IA…`);
            } else {
              setProgression("Le tuteur rédige l'exercice — énoncé, indices, correction, critères…");
            }
          }
        }
      }

      if (!recue && !abandon.signal.aborted) {
        setErreur(
          "Le flux s'est interrompu avant que le tuteur n'ait rendu son exercice. Rien n'a été enregistré — relance la génération.",
        );
        setPhase(modification ? "previsualisation" : "formulaire");
      }
    } catch {
      if (!abandon.signal.aborted) {
        setErreur("Génération interrompue.");
        setPhase(modification ? "previsualisation" : "formulaire");
      }
    }
  }, [codesLot, competence, theme, compteId]);

  /*
   * Mode lot : la génération part à l'ouverture pour la clé de lot courante.
   */
  const cleLot = codesLot && codesLot.length > 0 ? codesLot.join(",") : "";
  const genererRef = useRef(generer);
  useEffect(() => {
    genererRef.current = generer;
  });

  useEffect(() => {
    if (!cleLot) return;
    const abandon = new AbortController();
    abandonRef.current = abandon;
    void genererRef.current(undefined, abandon);
    return () => {
      abandon.abort();
    };
  }, [cleLot]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      abandonRef.current?.abort();
    };
  }, []);

  const enregistrerUneProposition = useCallback(
    async (p: PropositionExercice, index: number): Promise<string> => {
      const codeCible = p.competences[0];
      const competenceCible = competences.find((c) => c.code === codeCible);
      if (!competenceCible) {
        throw new Error(
          `Compétence ${codeCible ?? "inconnue"} introuvable dans le référentiel — enregistrement refusé.`,
        );
      }

      const conversion = convertirProposition(p);
      if (!conversion.ok) {
        throw new Error(
          `Proposition #${index + 1} invalide — ${conversion.erreurs.join(" ")}`,
        );
      }

      return creerExercice({
        ...conversion.valeur,
        domaine: competenceCible.domaine,
        origine: "tuteur",
      });
    },
    [competences],
  );

  const enregistrer = useCallback(
    async (p: PropositionExercice, index: number) => {
      if (enEcriture !== null || enEcritureTout || enregistrees.has(index)) return;
      setErreur(null);
      setEnEcriture(index);

      try {
        const id = await enregistrerUneProposition(p, index);
        const nouvellesEnregistrees = new Set(enregistrees).add(index);
        setEnregistrees(nouvellesEnregistrees);
        surEnregistre?.(id);

        if (ouvrirDansCahierApresAcceptation) {
          onFermer();
          router.push(`/seances?composer=1&code=${encodeURIComponent(p.competences[0] ?? "")}`);
        } else {
          router.refresh();
          if (nouvellesEnregistrees.size >= propositions.length) {
            onFermer();
          } else {
            const suivant = propositions.findIndex((_, idx) => !nouvellesEnregistrees.has(idx));
            if (suivant !== -1) {
              setIndexActif(suivant);
            }
          }
        }
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      } finally {
        setEnEcriture(null);
      }
    },
    [
      enEcriture,
      enEcritureTout,
      enregistrees,
      enregistrerUneProposition,
      surEnregistre,
      ouvrirDansCahierApresAcceptation,
      onFermer,
      router,
      propositions,
    ],
  );

  const accepterToutes = useCallback(async () => {
    if (enEcriture !== null || enEcritureTout) return;
    setErreur(null);
    setEnEcritureTout(true);

    const ensemble = new Set(enregistrees);
    const erreurs: string[] = [];

    try {
      for (let i = 0; i < propositions.length; i++) {
        if (ensemble.has(i)) continue;
        try {
          const id = await enregistrerUneProposition(propositions[i], i);
          ensemble.add(i);
          setEnregistrees(new Set(ensemble));
          if (id) surEnregistre?.(id);
        } catch (err) {
          erreurs.push(
            err instanceof Error ? err.message : `Échec sur la proposition #${i + 1}`,
          );
        }
      }

      router.refresh();

      if (erreurs.length > 0) {
        setErreur(erreurs.join(" · "));
      } else if (ensemble.size >= propositions.length) {
        onFermer();
      }
    } finally {
      setEnEcritureTout(false);
    }
  }, [
    enEcriture,
    enEcritureTout,
    enregistrees,
    propositions,
    enregistrerUneProposition,
    surEnregistre,
    router,
    onFermer,
  ]);

  const toutesEnregistrees = propositions.length > 0 && propositions.every((_, i) => enregistrees.has(i));
  const manquantesAEnregistrer = propositions.filter((_, i) => !enregistrees.has(i)).length;

  return (
    <EnveloppeGeneration
      presentation={presentation}
      onFermer={onFermer}
      largeur={phase === "previsualisation" ? "5xl" : "2xl"}
      pied={
        phase === "formulaire" && codesLot ? (
          <>
            <Bouton onClick={onFermer} variante="secondaire">
              Annuler
            </Bouton>
            <Bouton onClick={() => void generer()} variante="principal">
              Réessayer le lot
            </Bouton>
          </>
        ) : phase === "formulaire" ? (
          <>
            <Bouton onClick={onFermer} variante="secondaire">
              Annuler
            </Bouton>
            <Bouton onClick={() => void generer()} disabled={!competence} variante="principal">
              Générer
            </Bouton>
          </>
        ) : phase === "previsualisation" ? (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            {/* Stepper de navigation quand il y a plusieurs propositions */}
            {propositions.length > 1 ? (
              <div className="flex items-center gap-1.5">
                <Bouton
                  type="button"
                  onClick={() => {
                    setIndexActif((i) => Math.max(0, i - 1));
                    setModificationIndex(null);
                  }}
                  disabled={indexActif === 0}
                  variante="secondaire"
                  taille="compacte"
                >
                  <span>← Précédent</span>
                </Bouton>
                <span className="px-1 font-mono text-xs font-semibold text-texte-attenue">
                  {indexActif + 1} / {propositions.length}
                </span>
                <Bouton
                  type="button"
                  onClick={() => {
                    setIndexActif((i) => Math.min(propositions.length - 1, i + 1));
                    setModificationIndex(null);
                  }}
                  disabled={indexActif === propositions.length - 1}
                  variante="secondaire"
                  taille="compacte"
                >
                  <span>Suivant →</span>
                </Bouton>
              </div>
            ) : (
              <div />
            )}

            {/* Actions droite */}
            <div className="flex flex-wrap items-center gap-2">
              {propositions.length > 1 && manquantesAEnregistrer > 0 && (
                <Bouton
                  onClick={() => void accepterToutes()}
                  variante="principal"
                  disabled={enEcriture !== null}
                  enChargement={enEcriture !== null}
                >
                  <span>Tout accepter ({manquantesAEnregistrer})</span>
                </Bouton>
              )}
              {propositions.length === 1 && !enregistrees.has(0) && (
                <>
                  <Bouton
                    onClick={() => {
                      setModificationIndex(0);
                      setConsigneModification("");
                    }}
                    variante="secondaire"
                    disabled={enEcriture !== null || modificationIndex === 0}
                    aria-label="Modifier la proposition"
                  >
                    Modifier avec l&apos;IA
                  </Bouton>
                  <Bouton
                    onClick={() => void enregistrer(propositions[0], 0)}
                    variante="principal"
                    disabled={enEcriture !== null}
                    enChargement={enEcriture === 0}
                    aria-label="Accepter la proposition"
                  >
                    Accepter
                  </Bouton>
                </>
              )}
              <Bouton onClick={onFermer} variante="secondaire">
                {toutesEnregistrees ? "Terminer" : "Fermer"}
              </Bouton>
            </div>
          </div>
        ) : undefined
      }
    >
      <>
        {phase === "formulaire" && codesLot && (
          <div className={presentation === "inline" ? "mt-4 space-y-4" : "space-y-4"}>
            <p className="text-xs text-texte-attenue">
              Génération du lot interrompue avant qu&apos;un exercice n&apos;ait été rendu — rien
              n&apos;a été enregistré.
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {codesLot.map((c) => (
                <Etiquette key={c} mono>
                  {c}
                </Etiquette>
              ))}
            </ul>

            {erreur && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}

          </div>
        )}

        {phase === "formulaire" && !codesLot && (
          <div className={presentation === "inline" ? "mt-4 space-y-4" : "space-y-4"}>
            <ChampSelect
              id="modale-competence"
              label="Compétence ciblée"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPourquoi(false);
              }}
              options={competences.map((c) => ({ valeur: c.code, libelle: `${c.code} — ${c.intitule}` }))}
            />

            {/*
              Le bloc de calibrage est indexé sur `code` : il suit le sélecteur.
              Sans calibrage du tout, on ne montre rien plutôt qu'un zéro (P2).
            */}
            {cal ? (
              <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {cal.difficulteConseillee
                      ? `Difficulté ${cal.difficulteConseillee}/5`
                      : "Difficulté non dérivable"}
                  </span>
                  {cal.difficulteConseillee && (
                    <span className="text-texte-attenue">
                      {DIFFICULTES[cal.difficulteConseillee]}
                    </span>
                  )}
                  <button
                    type="button"
                    className="text-primaire hover:underline"
                    aria-expanded={pourquoi}
                    onClick={() => setPourquoi((p) => !p)}
                  >
                    {pourquoi ? "▾ Pourquoi ?" : "▸ Pourquoi ?"}
                  </button>
                </div>

                {cal.dimensionFaible && (
                  <p className="mt-1 text-texte-attenue">
                    Angle à travailler :{" "}
                    <span className="font-medium">
                      {LIBELLES_DIMENSIONS[cal.dimensionFaible.dimension]}
                    </span>{" "}
                    ({cal.dimensionFaible.moyenne} sur {cal.dimensionFaible.observations}{" "}
                    tentative{cal.dimensionFaible.observations > 1 ? "s" : ""})
                  </p>
                )}

                {cal.difficulteConseillee === null && (
                  <p className="mt-1 text-texte-discret">
                    Aucune tentative exploitable — la difficulté sera déduite du niveau.
                  </p>
                )}

                {pourquoi && (
                  <div className="mt-2 border-t border-bordure pt-2">
                    {cal.facteurs.length > 0 ? (
                      <ul className="space-y-0.5 text-texte-attenue">
                        {cal.facteurs.map((f, i) => (
                          <li key={i}>
                            · <span className="font-medium">{f.libelle}</span> — {f.valeur}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-texte-discret">
                        Aucune tentative terminée sur cette compétence.
                      </p>
                    )}
                    {cal.reserves.map((r, i) => (
                      <p key={i} className="mt-1 text-texte-discret">
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-discret">
                Aucune mesure sur cette compétence — la difficulté sera déduite du niveau.
              </p>
            )}

            <Champ
              id="modale-theme"
              label="Sur… (facultatif)"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Un thème, un contexte, une situation…"
              aide="Un indice de rédaction, pas un sélecteur d'objet."
            />

            {erreur && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}

          </div>
        )}

        {phase === "generation" && (
          <div className={presentation === "inline" ? "mt-4" : undefined}>
            <ChargementGeneration
              progressionServeur={progression}
              etapes={etapesGeneration}
              dureeAsymptoteSec={dureeAsymptoteSec}
              pourcentageMinimum={pourcentageMinimum}
              onArreter={() => {
                abandonRef.current?.abort();
                setPhase(modificationIndex !== null ? "previsualisation" : "formulaire");
              }}
            />
          </div>
        )}

        {phase === "previsualisation" && (
          <div className={presentation === "inline" ? "mt-4 space-y-4" : "space-y-4"}>
            {propositions.length === 0 ? (
              <BandeauInfo ton="alerte" taille="compacte">
                <p className="text-alerte">
                  Aucun exercice exploitable n&apos;a été produit. Réessaie, ou change de thème.
                </p>
              </BandeauInfo>
            ) : (
              (() => {
                const i = Math.min(indexActif, propositions.length - 1);
                const p = propositions[i];
                if (!p) return null;

                return (
                  <div className="space-y-4">
                    {/* Sélecteur d'onglets quand plusieurs exercices sont générés */}
                    {propositions.length > 1 && (
                      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-bordure bg-surface-2/60 p-2 shadow-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {propositions.map((prop, idx) => {
                            const actif = i === idx;
                            const estEnregistre = enregistrees.has(idx);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setIndexActif(idx);
                                  setModificationIndex(null);
                                }}
                                className={cx(
                                  "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition-all cursor-pointer border",
                                  actif
                                    ? "border-primaire bg-primaire-faible text-primaire font-semibold shadow-xs"
                                    : "border-transparent bg-transparent hover:bg-surface text-texte-attenue hover:text-texte",
                                )}
                              >
                                <span
                                  className={cx(
                                    "flex size-5 items-center justify-center rounded-full text-[0.625rem] font-bold",
                                    actif
                                      ? "bg-primaire text-primaire-contraste"
                                      : "bg-surface-3 text-texte-discret",
                                  )}
                                >
                                  {idx + 1}
                                </span>
                                <span className="font-mono font-medium">
                                  {prop.competences[0] ?? `Exo ${idx + 1}`}
                                </span>
                                {estEnregistre ? (
                                  <span className="rounded bg-succes-faible px-1.5 py-0.5 text-[0.625rem] font-bold text-succes">
                                    ✓ Enregistré
                                  </span>
                                ) : (
                                  <span className="size-1.5 rounded-full bg-primaire/60" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 text-[0.6875rem] font-medium text-texte-discret">
                            {enregistrees.size} / {propositions.length} enregistré{enregistrees.size > 1 ? "s" : ""}
                          </span>
                          {manquantesAEnregistrer > 0 && (
                            <Bouton
                              onClick={() => void accepterToutes()}
                              variante="principal"
                              taille="compacte"
                              disabled={enEcriture !== null || enEcritureTout}
                              enChargement={enEcritureTout}
                            >
                              <span>Tout accepter ({manquantesAEnregistrer})</span>
                            </Bouton>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Fiche complète de la proposition active */}
                    <div className="overflow-hidden rounded-xl border border-bordure bg-surface-2 shadow-xs">
                      {/* En-tête de la proposition */}
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-bordure bg-surface p-4">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Etiquette ton="primaire">
                              Proposition {i + 1}
                              {propositions.length > 1 ? ` sur ${propositions.length}` : ""}
                            </Etiquette>
                            {p.competences.map((c) => (
                              <Etiquette key={c} mono>
                                {c}
                              </Etiquette>
                            ))}
                            {p.difficulte && (
                              <span className="rounded-md border border-bordure bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-texte-attenue">
                                difficulté {p.difficulte}/5
                              </span>
                            )}
                            {p.dureeEstimeeMin && (
                              <span className="rounded-md border border-bordure bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-texte-attenue">
                                ≈ {p.dureeEstimeeMin} min
                              </span>
                            )}
                            {enregistrees.has(i) && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-succes-faible px-2 py-0.5 text-[0.6875rem] font-bold text-succes">
                                ✓ Enregistré
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold leading-snug tracking-tight text-texte sm:text-lg">
                            {p.titre}
                          </h3>
                        </div>

                        {propositions.length > 1 && !enregistrees.has(i) && (
                          <div className="flex shrink-0 items-center gap-2">
                            <Bouton
                              onClick={() => {
                                setModificationIndex(modificationIndex === i ? null : i);
                                setConsigneModification("");
                              }}
                              variante="secondaire"
                              taille="compacte"
                              disabled={enEcriture !== null}
                              aria-label={`Modifier la proposition ${i + 1}`}
                            >
                              Modifier avec l&apos;IA
                            </Bouton>
                            <Bouton
                              onClick={() => void enregistrer(p, i)}
                              variante="principal"
                              taille="compacte"
                              disabled={enEcriture !== null}
                              enChargement={enEcriture === i}
                              aria-label={`Accepter la proposition ${i + 1}`}
                            >
                              Accepter cet exercice
                            </Bouton>
                          </div>
                        )}
                      </div>

                      {/* Zone d'édition IA dépliable */}
                      {modificationIndex === i && !enregistrees.has(i) && (
                        <div className="border-b border-primaire/30 bg-primaire-faible/40 p-4">
                          <Champ
                            label="Que souhaites-tu modifier sur cet exercice ?"
                            multiligne
                            rows={2}
                            value={consigneModification}
                            onChange={(e) => setConsigneModification(e.target.value)}
                            placeholder="Ex. : Rends l'énoncé plus concret, simplifie le 2e indice, adapte le barème..."
                            aide="Le tuteur IA révise cette proposition en conservant les compétences ciblées."
                            autoFocus
                          />
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[0.6875rem] font-medium text-texte-discret">Suggestions :</span>
                              {[
                                "Rends l'énoncé plus concret",
                                "Raccourcis l'énoncé",
                                "Détaille la correction",
                                "Indices plus progressifs",
                              ].map((sug) => (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => setConsigneModification(sug)}
                                  className="cursor-pointer rounded border border-bordure bg-surface px-2 py-0.5 text-[0.625rem] text-texte-attenue transition-colors hover:text-texte"
                                >
                                  + {sug}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <Bouton
                                onClick={() => {
                                  setModificationIndex(null);
                                  setConsigneModification("");
                                }}
                                variante="secondaire"
                                taille="petite"
                              >
                                Annuler
                              </Bouton>
                              <Bouton
                                onClick={() =>
                                  void generer({
                                    proposition: p,
                                    index: i,
                                    consigne: consigneModification.trim(),
                                  })
                                }
                                variante="principal"
                                taille="petite"
                                disabled={!consigneModification.trim()}
                              >
                                Appliquer la révision
                              </Bouton>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Grille : Énoncé (gauche) + Détails pédagogiques (droite) */}
                      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
                        {/* Colonne gauche : Énoncé */}
                        <section
                          aria-labelledby={`enonce-${i}`}
                          className="min-w-0 rounded-xl border border-bordure bg-surface p-4 shadow-xs"
                        >
                          <div className="flex items-center justify-between border-b border-bordure/60 pb-2">
                            <p
                              id={`enonce-${i}`}
                              className="text-[0.6875rem] font-bold uppercase tracking-wider text-primaire"
                            >
                              Énoncé & Consigne
                            </p>
                          </div>
                          <div className="prose-exo mt-3 text-xs leading-relaxed text-texte">
                            <Markdown contenu={p.enonce} />
                          </div>
                        </section>

                        {/* Colonne droite : Indices, Correction & Critères */}
                        <aside className="min-w-0 space-y-3">
                          {p.indices.length > 0 && (
                            <section
                              aria-labelledby={`indices-${i}`}
                              className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs"
                            >
                              <div className="flex items-center justify-between border-b border-bordure/60 pb-1.5">
                                <p
                                  id={`indices-${i}`}
                                  className="text-[0.6875rem] font-bold uppercase tracking-wider text-texte-discret"
                                >
                                  Indices progressifs ({p.indices.length})
                                </p>
                              </div>
                              <ul className="mt-2 space-y-2 text-xs text-texte-attenue">
                                {p.indices.map((ind, j) => (
                                  <li key={j} className="flex items-start gap-2">
                                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[0.625rem] font-bold text-texte-discret">
                                      {j + 1}
                                    </span>
                                    <span className="leading-relaxed">{ind}</span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}

                          {p.correction && (
                            <section
                              aria-labelledby={`correction-${i}`}
                              className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs"
                            >
                              <div className="flex items-center justify-between border-b border-bordure/60 pb-1.5">
                                <p
                                  id={`correction-${i}`}
                                  className="text-[0.6875rem] font-bold uppercase tracking-wider text-texte-discret"
                                >
                                  Guide de correction & Solution
                                </p>
                              </div>
                              <div className="prose-exo mt-2 max-h-48 overflow-y-auto pr-1 text-xs leading-relaxed text-texte-attenue">
                                <Markdown contenu={p.correction} />
                              </div>
                            </section>
                          )}

                          {p.criteres.length > 0 && (
                            <section
                              aria-labelledby={`criteres-${i}`}
                              className="rounded-xl border border-bordure bg-surface p-3.5 shadow-xs"
                            >
                              <div className="flex items-center justify-between border-b border-bordure/60 pb-1.5">
                                <p
                                  id={`criteres-${i}`}
                                  className="text-[0.6875rem] font-bold uppercase tracking-wider text-texte-discret"
                                >
                                  Critères d&apos;évaluation ({p.criteres.length})
                                </p>
                              </div>
                              <ul className="mt-2 space-y-1.5 text-xs text-texte-attenue">
                                {p.criteres.map((c, j) => (
                                  <li key={j} className="flex items-start gap-2">
                                    <span
                                      className={cx(
                                        "mt-1 size-2 shrink-0 rounded-full",
                                        enregistrees.has(i) ? "bg-succes" : "bg-primaire/60",
                                      )}
                                      aria-hidden
                                    />
                                    <div className="leading-relaxed">
                                      <span className="font-semibold text-texte">
                                        {LIBELLES_DIMENSIONS[c.dimension as Dimension] ?? c.dimension}
                                      </span>{" "}
                                      — {c.libelle}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          )}
                        </aside>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            {erreur && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}
          </div>
        )}
      </>
    </EnveloppeGeneration>
  );
}

const TITRE_GENERATION = "Générer un exercice";
const SOUS_TITRE_GENERATION =
  "Relis la proposition : accepte-la ou indique au tuteur ce qu’il doit modifier.";

/**
 * La coquille, et elle seule.
 *
 * Le contenu de la génération est identique dans les deux présentations : on
 * n'en duplique pas une ligne. Ce composant ne décide que de ce qui l'entoure.
 *
 * En `inline`, pas de `role="dialog"`, pas d'`aria-modal`, pas de portail :
 * l'hôte (le tiroir du tuteur) porte déjà tout cela. Un `<section>` avec son
 * `aria-labelledby` suffit à nommer la région, et la fermeture reste offerte —
 * elle abandonne la proposition sans quitter la conversation.
 */
function EnveloppeGeneration({
  presentation,
  onFermer,
  largeur = "2xl",
  pied,
  children,
}: {
  presentation: "modale" | "inline";
  onFermer: () => void;
  largeur?: LargeurModale;
  pied?: ReactNode;
  children: ReactNode;
}) {
  const idTitre = useId();

  if (presentation === "modale") {
    return (
      <Modale titre={TITRE_GENERATION} sousTitre={SOUS_TITRE_GENERATION} onFermer={onFermer} largeur={largeur} pied={pied}>
        {children}
      </Modale>
    );
  }

  return (
    <section
      aria-labelledby={idTitre}
      className="mt-4 rounded-lg border border-bordure bg-surface-2 p-4"
    >
      <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
        <div className="min-w-0">
          <h3 id={idTitre} className="font-serif text-sm font-medium">
            {TITRE_GENERATION}
          </h3>
          <p className="mt-0.5 text-xs text-texte-discret">{SOUS_TITRE_GENERATION}</p>
        </div>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Abandonner la proposition"
          className="shrink-0 rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface hover:text-texte"
        >
          ✕
        </button>
      </div>
      {children}
      {pied && (
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-bordure pt-3">
          {pied}
        </div>
      )}
    </section>
  );
}

const ETAPES_GENERATION = [
  "Analyse du référentiel et des mesures passées…",
  "Calibration du niveau et de la difficulté…",
  "Rédaction de l'énoncé et de la mise en situation…",
  "Conception des indices et du guide de correction…",
  "Finalisation de la proposition par le tuteur…",
];


