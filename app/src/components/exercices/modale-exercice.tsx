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

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, Etiquette } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { Markdown } from "@/components/ui/markdown";
import { creerExercice } from "@/lib/store/actions";
import { creerSeanceFocusExercice } from "@/lib/store/seance-actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
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
  const codesLot =
    competencesCibles && competencesCibles.length > 0
      ? competencesCibles.slice(0, EXERCICES_PAR_LOT_MAX)
      : null;
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
  const [pourquoi, setPourquoi] = useState(false);
  const [modificationIndex, setModificationIndex] = useState<number | null>(null);
  const [consigneModification, setConsigneModification] = useState("");
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const abandonRef = useRef<AbortController | null>(null);

  /*
   * La modale est montée à l'ouverture et démontée à la fermeture
   * (`BoutonGenerer`), donc l'état repart neuf à chaque fois. Il reste à
   * abandonner la génération en cours au démontage : sans quoi le fournisseur
   * continue de rédiger, facturé, pour un texte que plus personne ne lit.
   */
  useEffect(() => {
    const controleur = abandonRef;
    return () => controleur.current?.abort();
  }, []);

  const competence = competences.find((c) => c.code === code);
  // Relu à chaque rendu : c'est ce qui fait suivre le calibrage au sélecteur.
  const cal = calibrages[code] ?? null;

  const generer = useCallback(async (modification?: {
    proposition: PropositionExercice;
    index: number;
    consigne: string;
  }) => {
    const codesAEnvoyer = modification
      ? modification.proposition.competences.slice(0, 1)
      : codesLot ?? (competence ? [competence.code] : []);
    if (codesAEnvoyer.length === 0) return;
    setPhase("generation");
    setProgression(null);
    setErreur(null);
    if (!modification) {
      setPropositions([]);
      setEnregistrees(new Set());
    }

    const abandon = new AbortController();
    abandonRef.current = abandon;

    try {
      const reponse = await fetch("/api/exercices/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          competences: codesAEnvoyer,
          theme: theme.trim() || undefined,
          config: lireConfigTuteur(compteId) ?? undefined,
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
      /*
       * Un flux peut se fermer SANS événement terminal — coupure réseau,
       * réponse tronquée, proxy qui referme. La boucle sortait alors sur `done`
       * sans rien vérifier, et la modale restait en « génération » pour
       * toujours : un chargement infini, qui se lit comme un plantage
       * (audit §2.4). On note donc si un verdict est arrivé, et on le dit quand
       * il n'est pas venu.
       */
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
            }
            setPhase("previsualisation");
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            recue = true;
            setErreur(parsed.message);
            setPhase(modification ? "previsualisation" : "formulaire");
          } else if (type === "proposition-en-cours") {
            setProgression("Le tuteur rédige l'exercice — énoncé, indices, correction, critères…");
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
   * Mode lot : la génération part directement à l'ouverture, sans repasser
   * par le formulaire — le geste est déjà déclaré par le bouton qui l'a
   * ouverte. Une seule fois par montage (la modale est démontée/remontée à
   * chaque ouverture, voir `BoutonGenerer`).
   */
  const lotDemarre = useRef(false);
  useEffect(() => {
    if (codesLot && !lotDemarre.current) {
      lotDemarre.current = true;
      void generer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enregistrer = useCallback(
    async (p: PropositionExercice, index: number) => {
      // Un enregistrement en vol verrouille tout : le double-clic ne doit pas
      // franchir la garde, même si le bouton était déjà rendu.
      if (enEcriture !== null || enregistrees.has(index)) return;
      setErreur(null);

      /*
       * La compétence d'écriture est dérivée de LA proposition, pas de l'état
       * `code` du formulaire — en mode lot, chaque proposition cible une
       * compétence différente, et `code`/`competence` ne suivent plus rien.
       */
      const codeCible = p.competences[0];
      const competenceCible = competences.find((c) => c.code === codeCible);
      if (!competenceCible) {
        setErreur(
          `Compétence ${codeCible ?? "inconnue"} introuvable dans le référentiel — enregistrement refusé.`,
        );
        return;
      }

      /*
       * Conversion explicite AVANT l'écriture. Une difficulté ou une durée
       * illisible arrête l'enregistrement et se dit — elle n'est pas remplacée
       * par un défaut silencieux (ADR-034, P2). La durée en particulier est ce
       * dont `tentativeMenee` se sert pour juger qu'une tentative a eu lieu.
       */
      const conversion = convertirProposition(p);
      if (!conversion.ok) {
        setErreur(
          `Cette proposition n'est pas enregistrable — ${conversion.erreurs.join(" ")}`,
        );
        return;
      }

      setEnEcriture(index);
      try {
        const id = await creerExercice({
          ...conversion.valeur,
          domaine: competenceCible.domaine,
          origine: "tuteur",
        });
        const nouvellesEnregistrees = new Set(enregistrees).add(index);
        setEnregistrees(nouvellesEnregistrees);
        surEnregistre?.(id);
        if (ouvrirDansCahierApresAcceptation) {
          try {
            const seanceId = await creerSeanceFocusExercice(id);
            onFermer();
            router.push(`/seances?session=${encodeURIComponent(seanceId)}`);
          } catch (e) {
            setErreur(
              `Exercice accepté. ${e instanceof Error ? e.message : "Le workspace n'a pas pu s'ouvrir."}`,
            );
          }
        } else {
          router.refresh();
          if (nouvellesEnregistrees.size >= propositions.length) {
            onFermer();
          }
        }
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Échec de l'enregistrement.");
      } finally {
        setEnEcriture(null);
      }
    },
    [
      competences,
      router,
      surEnregistre,
      enEcriture,
      enregistrees,
      ouvrirDansCahierApresAcceptation,
      onFermer,
      propositions.length,
    ],
  );

  return (
    <EnveloppeGeneration presentation={presentation} onFermer={onFermer}>
      <>
        {phase === "formulaire" && codesLot && (
          <div className="mt-4 space-y-4">
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

            <div className="flex justify-end gap-2 border-t border-bordure pt-3">
              <Bouton onClick={onFermer} variante="secondaire">
                Annuler
              </Bouton>
              <Bouton onClick={() => void generer()} variante="principal">
                Réessayer le lot
              </Bouton>
            </div>
          </div>
        )}

        {phase === "formulaire" && !codesLot && (
          <div className="mt-4 space-y-4">
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

            <div className="flex justify-end gap-2 border-t border-bordure pt-3">
              <Bouton onClick={onFermer} variante="secondaire">
                Annuler
              </Bouton>
              <Bouton onClick={() => void generer()} disabled={!competence} variante="principal">
                Générer
              </Bouton>
            </div>
          </div>
        )}

        {phase === "generation" && (
          <ChargementGenerationExercice
            progressionServeur={progression}
            onArrêter={() => {
              abandonRef.current?.abort();
              setPhase(modificationIndex !== null ? "previsualisation" : "formulaire");
            }}
          />
        )}

        {phase === "previsualisation" && (
          <div className="mt-4 space-y-4">
            {propositions.length === 0 ? (
              <BandeauInfo ton="alerte" taille="compacte">
                <p className="text-alerte">
                  Aucun exercice exploitable n&apos;a été produit. Réessaie, ou change de thème.
                </p>
              </BandeauInfo>
            ) : (
              propositions.map((p, i) => (
                <div key={i} className="overflow-hidden rounded-md border border-bordure bg-surface-2">
                  {/* En-tête : titre + métadonnées */}
                  <div className="border-b border-bordure bg-surface px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Etiquette ton="primaire">Proposition {i + 1}</Etiquette>
                      {enregistrees.has(i) && <Etiquette ton="succes">Enregistrée</Etiquette>}
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold leading-snug">{p.titre}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {p.competences.map((c) => (
                        <Etiquette key={c} mono>
                          {c}
                        </Etiquette>
                      ))}
                      {p.difficulte && (
                        <span className="text-[0.6875rem] text-texte-attenue">
                          difficulté {p.difficulte}/5
                        </span>
                      )}
                      {p.dureeEstimeeMin && (
                        <span className="text-[0.6875rem] text-texte-attenue">
                          ≈ {p.dureeEstimeeMin} min
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Corps : énoncé en markdown, indices et correction repliés */}
                  <div className="px-3 py-2.5">
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                      Énoncé
                    </p>
                    <div className="prose-exo mt-1 text-xs">
                      <Markdown contenu={p.enonce} />
                    </div>

                    {p.indices.length > 0 && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret hover:text-texte">
                          Indices ({p.indices.length})
                        </summary>
                        <ul className="mt-1.5 space-y-1 text-xs text-texte-attenue">
                          {p.indices.map((ind, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span className="mt-0.5 text-texte-discret">{j + 1}.</span>
                              <span>{ind}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {p.correction && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret hover:text-texte">
                          Correction
                        </summary>
                        <div className="prose-exo mt-1.5 text-xs">
                          <Markdown contenu={p.correction} />
                        </div>
                      </details>
                    )}

                    {p.criteres.length > 0 && (
                      <div className="mt-2.5">
                        <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                          Critères d&apos;évaluation
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-texte-attenue">
                          {p.criteres.map((c, j) => (
                            <li key={j} className="flex items-start gap-1.5">
                              <span
                                className={`mt-0.5 size-3 shrink-0 rounded-sm border ${
                                  enregistrees.has(i)
                                    ? "border-succes/40 bg-succes-faible"
                                    : "border-bordure"
                                }`}
                                aria-hidden
                              />
                              <span>
                                <span className="font-medium">
                                  {LIBELLES_DIMENSIONS[c.dimension as Dimension] ?? c.dimension}
                                </span>{" "}
                                — {c.libelle}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Pied : deux décisions — accepter ou demander une modification. */}
                  {!enregistrees.has(i) && (
                    <div className="border-t border-bordure bg-surface px-3 py-3">
                      {modificationIndex === i && (
                        <div className="mb-3 rounded-md border border-primaire/20 bg-primaire-faible/50 p-3">
                          <Champ
                            label="Que veux-tu modifier ?"
                            multiligne
                            rows={3}
                            value={consigneModification}
                            onChange={(e) => setConsigneModification(e.target.value)}
                            placeholder="Ex. Rends l’énoncé plus concret, retire l’ambiguïté du deuxième critère…"
                            aide="Le tuteur révise cette proposition. Rien n’est enregistré tant que tu ne l’acceptes pas."
                            autoFocus
                          />
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
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
                              onClick={() => void generer({
                                proposition: p,
                                index: i,
                                consigne: consigneModification.trim(),
                              })}
                              variante="principal"
                              taille="petite"
                              disabled={!consigneModification.trim()}
                            >
                              Appliquer avec l’IA
                            </Bouton>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <Bouton
                          onClick={() => {
                            setModificationIndex(i);
                            setConsigneModification("");
                          }}
                          variante="secondaire"
                          taille="petite"
                          disabled={enEcriture !== null || modificationIndex === i}
                        >
                          Modifier
                        </Bouton>
                        <Bouton
                          onClick={() => void enregistrer(p, i)}
                          variante="principal"
                          taille="petite"
                          disabled={enEcriture !== null}
                          enChargement={enEcriture === i}
                        >
                          Accepter
                        </Bouton>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
            {erreur && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreur}</p>
              </BandeauInfo>
            )}
            <div className="flex justify-end gap-2 border-t border-bordure pt-3">
              <Bouton onClick={onFermer} variante="principal">
                Fermer
              </Bouton>
            </div>
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
  children,
}: {
  presentation: "modale" | "inline";
  onFermer: () => void;
  children: ReactNode;
}) {
  const idTitre = useId();

  if (presentation === "modale") {
    return (
      <Modale titre={TITRE_GENERATION} sousTitre={SOUS_TITRE_GENERATION} onFermer={onFermer}>
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

/**
 * Indication visuelle unique de chargement pour la génération d’exercice.
 *
 *  - Pas d'emojis.
 *  - Une seule indication visuelle épurée (barre de progression + %).
 *  - Progression ultra-continue basée sur le temps écoulé (départ à 0 %, asymptote fluide sans à-coup).
 */
function ChargementGenerationExercice({
  progressionServeur,
  onArrêter,
}: {
  progressionServeur: string | null;
  onArrêter: () => void;
}) {
  const [pourcentage, setPourcentage] = useState(0);
  const [etapeIndex, setEtapeIndex] = useState(0);

  useEffect(() => {
    const tempsDebut = Date.now();

    // Actualisation ultra-continue (toutes les 100 ms) basée sur une asymptote lisse
    const intervalPourcent = setInterval(() => {
      const ecouleSec = (Date.now() - tempsDebut) / 1000;
      // Progression asymptotique naturelle : 94 * (1 - e^(-t / 7))
      const val = Math.min(94, Math.round(94 * (1 - Math.exp(-ecouleSec / 7))));
      setPourcentage((prev) => Math.max(prev, val));
    }, 100);

    const intervalEtape = setInterval(() => {
      setEtapeIndex((prev) => (prev < ETAPES_GENERATION.length - 1 ? prev + 1 : prev));
    }, 2800);

    return () => {
      clearInterval(intervalPourcent);
      clearInterval(intervalEtape);
    };
  }, []);

  const texteCourant = progressionServeur ?? ETAPES_GENERATION[etapeIndex];

  return (
    <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-bordure bg-surface/50 p-6 text-center shadow-[var(--ombre-posee)]">
      {/* Une seule indication visuelle : Barre de progression unique avec % et étape */}
      <div className="w-full max-w-md space-y-2.5">
        <div className="flex items-center justify-between text-xs font-medium text-texte-attenue">
          <span className="truncate">{texteCourant}</span>
          <span className="chiffres font-semibold text-texte shrink-0 ml-3">{pourcentage}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-primaire transition-all duration-300 ease-out"
            style={{ width: `${pourcentage}%` }}
          />
        </div>
      </div>

      <Bouton
        onClick={onArrêter}
        variante="secondaire"
        taille="petite"
        className="mt-6"
      >
        Arrêter
      </Bouton>
    </div>
  );
}
