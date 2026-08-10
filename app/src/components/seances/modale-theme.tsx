"use client";

/**
 * « Je veux apprendre l'histoire de l'industrie japonaise. » — résoudre une
 * intention libre en compétences existantes (chantier « thèmes », ADR-053).
 *
 * Calquée sur `ModaleRevision` : saisie → appel au tuteur en SSE → relecture
 * avec cases pré-cochées, décochables. La différence de fond tient dans
 * l'issue « aucun code » : ce n'est pas une erreur, c'est le refus demandé
 * (P2 — pas de rapprochement forcé), et l'écran renvoie vers la création
 * d'une branche plutôt que d'inventer une correspondance.
 *
 * Comme les autres modales du tuteur : l'appel réseau part du clic, jamais
 * d'un effet, et `onFermer` coupe le flux en cours (audit §2.4).
 */

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BandeauInfo, Bouton, PointActif } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionTheme } from "@/lib/tutor/outils";
import { creerTheme } from "@/lib/store/theme-actions";
import type { Theme } from "@/lib/domain/theme";

type Etat =
  | { phase: "saisie" }
  | { phase: "resolution"; progression: string | null }
  | { phase: "relecture"; proposition: PropositionTheme }
  | { phase: "aucune-correspondance"; proposition: PropositionTheme }
  | { phase: "erreur"; message: string };

export function ModaleTheme({
  competencesParCode,
  compteId,
  intentionInitiale = "",
  onFermer,
  onCree,
}: {
  /** Intitulé et domaine, pour afficher chaque code désigné lisiblement. */
  competencesParCode: Map<string, { intitule: string; domaine: string }>;
  compteId: string;
  intentionInitiale?: string;
  onFermer: () => void;
  /** Le thème vient d'être créé — le compositeur peut le sélectionner tout de suite. */
  onCree: (theme: Theme) => void;
}) {
  const [intention, setIntention] = useState(intentionInitiale);
  const [etat, setEtat] = useState<Etat>({ phase: "saisie" });
  const [garde, setGarde] = useState<Record<string, boolean>>({});
  const [libelle, setLibelle] = useState("");
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const abandonRef = useRef<AbortController | null>(null);

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
              // Le refus demandé — pas une erreur (P2, pas de rapprochement forcé).
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

  const p = etat.phase === "relecture" ? etat.proposition : null;
  const codesGardes = p ? p.codes.filter((c) => garde[c]) : [];

  return (
    <Modale
      titre="Séance personnalisée"
      sousTitre="Décris ce que tu veux travailler. Le tuteur désigne des compétences existantes ; il n'en écrit aucune."
      onFermer={onFermer}
    >
      <>
        {(etat.phase === "saisie" || etat.phase === "erreur") && (
          <div className="mt-4 space-y-3">
            {etat.phase === "erreur" && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{etat.message}</p>
              </BandeauInfo>
            )}
            <label className="block">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Ce que tu veux travailler
              </span>
              <textarea
                value={intention}
                onChange={(e) => setIntention(e.target.value)}
                rows={3}
                placeholder="Je veux apprendre l'histoire de l'industrie japonaise."
                className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret"
              />
            </label>
            <Bouton
              onClick={() => void resoudre()}
              disabled={intention.trim().length === 0}
              variante="principal"
            >
              Chercher dans mes compétences
            </Bouton>
          </div>
        )}

        {etat.phase === "resolution" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <PointActif />
            <p className="mt-3 text-sm text-texte-attenue">
              {etat.progression ?? "Le tuteur prend connaissance de ton intention…"}
            </p>
            <Bouton
              onClick={() => {
                abandonRef.current?.abort();
                setEtat({ phase: "saisie" });
              }}
              variante="secondaire"
              taille="petite"
              className="mt-4"
            >
              Arrêter
            </Bouton>
          </div>
        )}

        {etat.phase === "aucune-correspondance" && (
          <div className="mt-4 space-y-3">
            <BandeauInfo ton="info" taille="compacte">
              <p>
                Aucune compétence active ne correspond à <em>« {intention.trim()} »</em>.
              </p>
              {etat.proposition.justification && (
                <p className="mt-1 text-texte-attenue">{etat.proposition.justification}</p>
              )}
            </BandeauInfo>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/competences"
                className="text-xs font-medium text-accent underline-offset-2 hover:underline"
              >
                Créer une compétence pour ce sujet
              </Link>
              <button
                type="button"
                onClick={() => setEtat({ phase: "saisie" })}
                className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
              >
                Reformuler
              </button>
            </div>
          </div>
        )}

        {p && (
          <div className="mt-4 space-y-4">
            {erreurAction && (
              <BandeauInfo ton="danger" taille="compacte">
                <p className="text-danger">{erreurAction}</p>
              </BandeauInfo>
            )}

            <label className="block">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Nom du thème
              </span>
              <input
                type="text"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2 py-1.5 text-sm"
              />
            </label>

            {p.justification && (
              <p className="text-[0.6875rem] text-texte-attenue">{p.justification}</p>
            )}

            <ul className="space-y-2">
              {p.codes.map((code) => {
                const info = competencesParCode.get(code);
                return (
                  <li
                    key={code}
                    className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2"
                  >
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={garde[code] ?? false}
                        onChange={(e) => setGarde((g) => ({ ...g, [code]: e.target.checked }))}
                        className="mt-0.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{code}</span>{" "}
                        <span className="text-xs">{info?.intitule ?? code}</span>
                        {info?.domaine && (
                          <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">
                            {info.domaine}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <Bouton
                onClick={() => enregistrer(p)}
                disabled={enCours || codesGardes.length === 0 || libelle.trim().length === 0}
                variante="principal"
              >
                {enCours ? "Enregistrement…" : `Enregistrer ce thème (${codesGardes.length})`}
              </Bouton>
              <button
                type="button"
                onClick={() => setEtat({ phase: "saisie" })}
                disabled={enCours}
                className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
              >
                Reformuler
              </button>
            </div>
          </div>
        )}
      </>
    </Modale>
  );
}
