"use client";

/**
 * « Voici une proposition de référentiel pour le stoïcisme, en 5 thèmes. »
 *
 * Le manque était double sur `/competences` : aucun point d'entrée pour ajouter
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

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, PointActif } from "@/components/ui/primitives";
import { Modale } from "@/components/ui/modale";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";
import { creerBranche } from "@/lib/store/referentiel-actions";

type Etat =
  | { phase: "fermee" }
  | { phase: "saisie"; message: string | null }
  | { phase: "proposition"; progression: string | null }
  | {
      phase: "relecture";
      resume: string;
      ecartees: number;
      branches: PropositionReferentiel[];
    };

export function BoutonCreerReferentiel({ compteId }: { compteId: string }) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>({ phase: "fermee" });
  const [sujet, setSujet] = useState("");
  const [garde, setGarde] = useState<Record<string, boolean>>({});
  const [prefixes, setPrefixes] = useState<Record<number, string>>({});
  const [progressionEcriture, setProgressionEcriture] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
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
    setEtat({ phase: "fermee" });
  }

  /** Lancée depuis un clic, jamais depuis un effet. */
  async function proposer() {
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
  }

  function enregistrer(branches: PropositionReferentiel[]) {
    setErreur(null);
    demarrer(async () => {
      const retenues = branches
        .map((b, i) => ({ b, i }))
        .filter(({ i }) => garde[`b${i}`]);

      try {
        for (const [rang, { b, i }] of retenues.entries()) {
          setProgressionEcriture(`Branche ${rang + 1} sur ${retenues.length} — ${b.domaine}…`);
          // Séquentiel : `creerBranche` relit le référentiel à chaque appel.
          await creerBranche({
            domaine: b.domaine,
            prefixe: prefixes[i] ?? b.prefixe,
            description: b.description,
            competences: b.competences.filter((_, j) => garde[`c${i}-${j}`]),
            origine: "tuteur",
          });
        }
        setProgressionEcriture(null);
        setEtat({ phase: "fermee" });
        setSujet("");
        router.refresh();
      } catch (e) {
        setProgressionEcriture(null);
        setErreur(
          `${e instanceof Error ? e.message : "L'enregistrement a échoué."} Les branches déjà écrites le restent.`,
        );
      }
    });
  }

  if (etat.phase === "fermee") {
    return (
      <Bouton onClick={() => setEtat({ phase: "saisie", message: null })} variante="secondaire" taille="petite">
        + Référentiel
      </Bouton>
    );
  }

  const relecture = etat.phase === "relecture" ? etat : null;
  const retenues = relecture ? relecture.branches.filter((_, i) => garde[`b${i}`]).length : 0;

  return (
    <>
      <Bouton variante="secondaire" taille="petite" disabled>
        + Référentiel
      </Bouton>

      <Modale
        titre="Ajouter un référentiel"
        sousTitre="Nomme un sujet ; le tuteur le découpe en branches. Tu relis, tu décoches, tu enregistres. Les codes sont attribués à l'enregistrement."
        onFermer={fermer}
      >
        <>
          {etat.phase === "saisie" && (
            <div className="mt-4 space-y-3">
              {etat.message && (
                <BandeauInfo ton="danger" taille="compacte">
                  <p className="text-danger">{etat.message}</p>
                </BandeauInfo>
              )}
              <label className="block">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                  Sujet
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
                Proposer un référentiel
              </Bouton>
            </div>
          )}

          {etat.phase === "proposition" && (
            <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
              <PointActif />
              <p className="mt-3 text-sm text-texte-attenue">
                {etat.progression ?? "Le tuteur découpe le sujet…"}
              </p>
              <Bouton
                onClick={() => {
                  abandonRef.current?.abort();
                  setEtat({ phase: "saisie", message: null });
                }}
                variante="secondaire"
                taille="petite"
                className="mt-4"
              >
                Arrêter
              </Bouton>
            </div>
          )}

          {relecture && (
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-bordure-controle bg-surface-2 px-3 py-2.5">
                <p className="text-xs text-texte-attenue">{relecture.resume}</p>
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
