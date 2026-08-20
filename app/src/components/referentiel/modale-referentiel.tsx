"use client";

/**
 * « Voici une proposition de référentiel pour le stoïcisme, en 5 thèmes. »
 *
 * Le manque était double dans l'ancien écran du référentiel : aucun point d'entrée pour ajouter
 * une branche neuve — `+ Compétence` n'existe que sur une carte de domaine
 * existant — et la suggestion ne produisait qu'**une** branche, là où un sujet
 * un peu large en demande plusieurs.
 *
 * ## L'enregistrement est séquentiel, et c'est nécessaire
 *
 * `creerBranche` relit le référentiel à chaque appel. Les lancer en parallèle
 * ferait lire à chacun un référentiel d'avant les autres : deux branches
 * pourraient se voir attribuer le même préfixe, et `attribuerCodes` partirait
 * du même point. La boucle est donc séquentielle, avec une progression visible
 * — et un résultat par branche, parce qu'un échec au milieu ne doit pas laisser
 * croire que rien n'a été écrit.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { IconeAmpoule } from "@/components/ui/icones";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";
import { creerBranche } from "@/lib/store/referentiel-actions";
import type { CompetenceDejaAuReferentiel } from "@/lib/domain/gouvernance-referentiel";
import { AvisDejaAuReferentiel } from "./avis-deja-au-referentiel";
import { creerTheme } from "@/lib/store/theme-actions";
import { ReglagesTuteur } from "@/components/tuteur/reglages-tuteur";
import { ChargementGeneration } from "@/components/ui/chargement-generation";
import { analyserDemandeReferentiel } from "@/lib/domain/intention";

const ETAPES_REFERENTIEL = [
  "Analyse du sujet et identification des axes majeurs…",
  "Structuration des domaines de compétences…",
  "Découpage en compétences observables et mesurables…",
  "Attribution des critères et finalisation du référentiel…",
];

type Etat =
  | { phase: "saisie"; message: string | null }
  | { phase: "proposition"; progression: string | null }
  | {
      phase: "relecture";
      resume: string;
      ecartees: number;
      branches: PropositionReferentiel[];
    };

/**
 * La modale seule, sans son déclencheur.
 *
 * Elle a été extraite de `BoutonCreerReferentiel` pour que le point d'entrée
 * unique (`components/intention`) puisse l'ouvrir avec un sujet **déjà connu** :
 * quelqu'un qui vient d'écrire « je veux apprendre le stoïcisme » n'a pas à le
 * retaper dans un second champ. Le bouton d'origine reste, monté au-dessus
 * d'elle — un seul chemin d'extension du référentiel, deux façons d'y entrer.
 */
export function ModaleReferentiel({
  compteId,
  sujetInitial = "",
  demarrageAutomatique = false,
  guideEtape,
  onFermer,
  surEnregistre,
}: {
  compteId: string;
  /** Sujet déjà déclaré avant l'ouverture. */
  sujetInitial?: string;
  /** Lance la proposition sans attendre un second clic sur le même sujet. */
  demarrageAutomatique?: boolean;
  /** Message ou badge d'étape guidée lors d'un onboarding. */
  guideEtape?: string;
  onFermer: () => void;
  /** Permet à l'appelant de reprendre son flux après l'écriture. */
  surEnregistre?: () => void;
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ phase: "saisie", message: null });
  const [sujet, setSujet] = useState(sujetInitial);
  const [garde, setGarde] = useState<Record<string, boolean>>({});
  const [prefixes, setPrefixes] = useState<Record<number, string>>({});
  const [progressionEcriture, setProgressionEcriture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dejaAuReferentiel, setDejaAuReferentiel] = useState<CompetenceDejaAuReferentiel[]>([]);
  const [enCours, demarrer] = useTransition();
  const abandonRef = useRef<AbortController | null>(null);

  /**
   * Fermer, c'est aussi abandonner la génération en cours (audit §2.4).
   *
   * Fermer la modale ne faisait que changer de phase : le `fetch` continuait,
   * le fournisseur rédigeait — facturé — pour un texte que plus personne
   * n'attendait. `ModaleExercice` coupait déjà, celle-ci non ; c'est la même
   * correction, propagée.
   */
  function fermer() {
    abandonRef.current?.abort();
    abandonRef.current = null;
    onFermer();
  }

  /**
   * Lancée depuis un clic — ou depuis le démarrage automatique, quand le sujet
   * vient d'être écrit ailleurs et n'a pas à être reconfirmé.
   */
  const proposer = useCallback(async () => {
    if (sujet.trim().length === 0) return;
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setEtat({ phase: "proposition", progression: null });
    setErreur(null);

    try {
      const reponse = await fetch("/api/referentiel/proposer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sujet: sujet.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "saisie",
          message: donnees?.message ?? "La proposition n'a pas pu démarrer.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      /*
       * Un flux fermé sans événement terminal — coupure, troncature, proxy —
       * laissait la modale en « proposition » indéfiniment (audit §2.4). On
       * note ce qui est arrivé, et on le dit quand rien n'est venu.
       */
      let recue = false;

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

          if (type === "propositions") {
            const recu = JSON.parse(donnees) as {
              resume: string;
              ecartees: number;
              branches: PropositionReferentiel[];
            };
            const initial: Record<string, boolean> = {};
            const p: Record<number, string> = {};
            recu.branches.forEach((b, i) => {
              initial[`b${i}`] = true;
              p[i] = b.prefixe;
              b.competences.forEach((_, j) => (initial[`c${i}-${j}`] = true));
            });
            recue = true;
            setGarde(initial);
            setPrefixes(p);
            setEtat({
              phase: "relecture",
              resume: recu.resume,
              ecartees: recu.ecartees,
              branches: recu.branches,
            });
          } else if (type === "erreur") {
            recue = true;
            setEtat({
              phase: "saisie",
              message: (JSON.parse(donnees) as { message: string }).message,
            });
          } else if (type === "proposition-en-cours") {
            setEtat({ phase: "proposition", progression: "Le tuteur compose le référentiel…" });
          }
        }
      }

      if (!recue && !abandon.signal.aborted) {
        setEtat({
          phase: "saisie",
          message:
            "Le flux s'est interrompu avant que le tuteur n'ait rendu sa proposition. Rien n'a été enregistré — relance la proposition.",
        });
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "saisie", message: "Proposition interrompue." });
      }
    }
  }, [compteId, sujet]);

  /*
   * Le démarrage automatique ne se rejoue pas : sans le drapeau, un rendu
   * déclenché par la progression relancerait une seconde proposition — donc un
   * second appel facturé pour un seul sujet.
   */
  const demarrageLanceRef = useRef(false);
  useEffect(() => {
    if (!demarrageAutomatique || demarrageLanceRef.current || sujet.trim().length === 0) return;
    demarrageLanceRef.current = true;
    void proposer();
  }, [demarrageAutomatique, proposer, sujet]);

  function enregistrer(branches: PropositionReferentiel[]) {
    setErreur(null);
    demarrer(async () => {
      const retenues = branches
        .map((b, i) => ({ b, i }))
        .filter(({ i }) => garde[`b${i}`]);

      const tousLesCodes: string[] = [];
      const deja: CompetenceDejaAuReferentiel[] = [];

      try {
        for (const [rang, { b, i }] of retenues.entries()) {
          setProgressionEcriture(`Branche ${rang + 1} sur ${retenues.length} — ${b.domaine}…`);
          // Séquentiel : `creerBranche` relit le référentiel à chaque appel.
          const res = await creerBranche({
            domaine: b.domaine,
            prefixe: prefixes[i] ?? b.prefixe,
            description: b.description,
            competences: b.competences.filter((_, j) => garde[`c${i}-${j}`]),
            origine: "tuteur",
          });
          if (res?.codes) {
            tousLesCodes.push(...res.codes);
          }
          deja.push(...(res?.dejaAuReferentiel ?? []));
        }

        // Création automatique du thème transversal global correspondant au sujet initial
        const codesUniques = [...new Set(tousLesCodes)];
        if (codesUniques.length >= 1 && sujet.trim().length > 0) {
          try {
            setProgressionEcriture("Création du thème transversal…");
            await creerTheme({
              libelle: sujet.trim().slice(0, 100),
              intention: `Thème transversal initial pour « ${sujet.trim()} »`.slice(0, 500),
              codes: codesUniques.slice(0, 500),
              origine: "tuteur",
            });
          } catch {
            // Un échec de création du thème ne bloque pas l'enregistrement des branches
          }
        }

        setProgressionEcriture(null);
        router.refresh();
        surEnregistre?.();
        /*
         * On ne referme pas quand des compétences ont été écartées : la modale
         * est le seul endroit où le dire, et la fermer ferait disparaître
         * l'information au moment même où elle compte.
         */
        if (deja.length > 0) setDejaAuReferentiel(deja);
        else onFermer();
      } catch (e) {
        setProgressionEcriture(null);
        setErreur(
          `${e instanceof Error ? e.message : "L'enregistrement a échoué."} Les branches déjà écrites le restent.`,
        );
      }
    });
  }

  const [afficherReglagesCle, setAfficherReglagesCle] = useState(false);
  const aCleConfiguree = Boolean(lireConfigTuteur(compteId));

  const relecture = etat.phase === "relecture" ? etat : null;
  const retenues = relecture ? relecture.branches.filter((_, i) => garde[`b${i}`]).length : 0;
  const cadrage = analyserDemandeReferentiel(sujet);

  return (
    <>
      <Modale
        titre="Préciser le domaine à apprendre"
        sousTitre="Décris le domaine ou le sujet. Le système propose une organisation de compétences ; tu relis avant de l’ajouter à ton Atelier."
        onFermer={fermer}
      >
        <>
          {guideEtape && (
            <div className="mb-4 rounded-xl border border-primaire/30 bg-primaire/10 px-4 py-3 text-xs text-texte flex items-center gap-2.5">
              <IconeAmpoule className="size-4 shrink-0 text-primaire" aria-hidden />
              <p className="leading-relaxed">{guideEtape}</p>
            </div>
          )}

          {etat.phase === "saisie" && (
            <div className="space-y-4">
              {etat.message && (
                /*
                 * Le bandeau dit la vraie cause. Avant ce correctif, `etat.message`
                 * ne servait QUE de booléen : le texte affiché était fixe (« Clé IA
                 * requise pour la proposition »), et une panne transitoire du
                 * fournisseur (quota 429, timeout, flux SSE coupé) était donc
                 * montrée comme une clé à remplacer — alors qu'elle était présente.
                 * On ne garde l'accusation de clé que lorsqu'aucune clé n'est
                 * effectivement configurée.
                 */
                <BandeauInfo ton={aCleConfiguree ? "danger" : "alerte"} taille="compacte">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-semibold ${aCleConfiguree ? "text-danger" : "text-alerte"}`}
                    >
                      {aCleConfiguree
                        ? "La proposition a échoué"
                        : "Clé IA requise pour la proposition"}
                    </p>
                    <p className="mt-1 text-xs text-texte-attenue">{etat.message}</p>
                    {aCleConfiguree && (
                      <Bouton
                        variante="secondaire"
                        taille="petite"
                        className="mt-2"
                        onClick={() => void proposer()}
                      >
                        Relancer la proposition
                      </Bouton>
                    )}
                  </div>
                </BandeauInfo>
              )}

              {/*
               * Le formulaire de clé ne se déploie pas sur une erreur : il ne
               * s'ouvre que sans clé configurée, ou sur demande explicite
               * (« Modifier la clé »). Une panne transitoire du fournisseur ne
               * doit pas redemander une clé déjà présente — elle dit son
               * message et propose « Relancer la proposition ».
               */}
              {aCleConfiguree && !afficherReglagesCle ? (
                <div className="flex items-center justify-between rounded-lg border border-bordure bg-surface-2/40 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-succes" />
                    <span className="text-texte-attenue">Tuteur IA configuré et prêt</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAfficherReglagesCle(true)}
                    className="text-[0.6875rem] font-medium text-primaire hover:underline"
                  >
                    Modifier la clé
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-primaire/30 bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-texte">
                      Configuration du tuteur IA
                    </p>
                    {aCleConfiguree && (
                      <button
                        type="button"
                        onClick={() => setAfficherReglagesCle(false)}
                        className="text-[0.6875rem] text-texte-discret hover:underline"
                      >
                        Replier
                      </button>
                    )}
                  </div>
                  <ReglagesTuteur
                    compteId={compteId}
                    compact
                    surEnregistre={() => {
                      setErreur(null);
                      setAfficherReglagesCle(false);
                      void proposer();
                    }}
                  />
                </div>
              )}

              <div className="border-t border-bordure/60 pt-3">
                <label className="block mb-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                    Domaine ou sujet
                  </span>
                  <input
                    value={sujet}
                    onChange={(e) => setSujet(e.target.value)}
                    placeholder="le stoïcisme · la thermodynamique · le droit des contrats…"
                    className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret"
                  />
                </label>
                <Bouton
                  onClick={() => void proposer()}
                  disabled={sujet.trim().length === 0}
                  variante="principal"
                >
                  Proposer une organisation
                </Bouton>
              </div>
            </div>
          )}

          {etat.phase === "proposition" && (
            <div className="py-6">
              <ChargementGeneration
                progressionServeur={etat.progression}
                etapes={ETAPES_REFERENTIEL}
                dureeAsymptoteSec={8}
                onArreter={() => {
                  abandonRef.current?.abort();
                  setEtat({ phase: "saisie", message: null });
                }}
              />
            </div>
          )}

          {relecture && (
            <div className="space-y-4">
              <div className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2.5">
                <p className="text-xs text-texte-attenue">
                  Le système propose {relecture.branches.length} domaine
                  {relecture.branches.length > 1 ? "s" : ""} à relire.
                </p>
                {cadrage.nombreDomaines && cadrage.nombreDomaines !== relecture.branches.length && (
                  <p className="mt-1 text-[0.6875rem] text-alerte">
                    Tu demandais {cadrage.nombreDomaines} domaines ; la proposition actuelle n’en
                    contient que {relecture.branches.length}. Reformule si ce découpage ne convient pas.
                  </p>
                )}
                {/* Une liste tronquée en silence se lirait comme complète (ADR-036). */}
                {relecture.ecartees > 0 && (
                  <p className="mt-1 text-[0.6875rem] text-texte-discret">
                    {relecture.ecartees} branche{relecture.ecartees > 1 ? "s" : ""} proposée
                    {relecture.ecartees > 1 ? "s" : ""} {relecture.ecartees > 1 ? "ont" : "a"} été
                    écartée{relecture.ecartees > 1 ? "s" : ""} : incomplète
                    {relecture.ecartees > 1 ? "s" : ""} ou sans compétence exploitable.
                  </p>
                )}
              </div>

              {erreur && (
                <BandeauInfo ton="danger" taille="compacte">
                  <p className="text-danger">{erreur}</p>
                </BandeauInfo>
              )}

              <AvisDejaAuReferentiel competences={dejaAuReferentiel} />

              {relecture.branches.map((b, i) => (
                <section key={i} className="rounded-md border border-bordure px-3 py-2.5">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={garde[`b${i}`] ?? false}
                      onChange={(e) => setGarde((g) => ({ ...g, [`b${i}`]: e.target.checked }))}
                      className="mt-1 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{b.domaine}</span>
                      <span className="mt-0.5 block text-[0.6875rem] text-texte-attenue">
                        {b.description}
                      </span>
                    </span>
                    <input
                      value={prefixes[i] ?? b.prefixe}
                      onChange={(e) =>
                        setPrefixes((p) => ({ ...p, [i]: e.target.value.toUpperCase().slice(0, 5) }))
                      }
                      aria-label={`Préfixe de ${b.domaine}`}
                      className="chiffres w-16 shrink-0 rounded border border-bordure-controle bg-surface px-1.5 py-0.5 text-center text-[0.6875rem]"
                    />
                  </label>

                  {garde[`b${i}`] && (
                    <ul className="mt-2 space-y-1 border-t border-bordure pt-2">
                      {b.competences.map((c, j) => (
                        <li key={j}>
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={garde[`c${i}-${j}`] ?? false}
                              onChange={(e) =>
                                setGarde((g) => ({ ...g, [`c${i}-${j}`]: e.target.checked }))
                              }
                              className="mt-0.5 shrink-0"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="text-xs">{c.intitule}</span>
                              <span className="ml-1.5 text-[0.625rem] text-texte-discret">
                                {c.palier}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              <div className="flex flex-wrap items-center gap-2">
                <Bouton
                  onClick={() => enregistrer(relecture.branches)}
                  disabled={enCours || retenues === 0}
                  variante="principal"
                >
                  {enCours
                    ? (progressionEcriture ?? "Enregistrement…")
                    : `Enregistrer ${retenues} branche${retenues > 1 ? "s" : ""}`}
                </Bouton>
                <button
                  type="button"
                  onClick={() => setEtat({ phase: "saisie", message: null })}
                  disabled={enCours}
                  className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
                >
                  Reformuler le sujet
                </button>
              </div>
            </div>
          )}
        </>
      </Modale>
    </>
  );
}

/**
 * Le déclencheur historique — un bouton, puis la modale.
 *
 * Il ne porte plus aucune logique : tout ce qu'il faisait vit dans
 * `ModaleReferentiel`, que le point d'entrée `+` monte aussi de son côté.
 */
export function BoutonCreerReferentiel({
  compteId,
  libelle = "+ Référentiel",
}: {
  compteId: string;
  libelle?: string;
}) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <>
      <Bouton onClick={() => setOuverte(true)} variante="secondaire" taille="petite" disabled={ouverte}>
        {libelle}
      </Bouton>
      {ouverte && (
        <ModaleReferentiel compteId={compteId} onFermer={() => setOuverte(false)} />
      )}
    </>
  );
}
