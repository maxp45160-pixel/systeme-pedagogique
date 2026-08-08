"use client";

/**
 * « Ce référentiel ne couvre plus mes besoins, change-le. »
 *
 * Le besoin remonté à l'usage n'était pas de créer une branche de plus : la
 * saisie d'un sujet en texte libre existait déjà et « marche pas bien ». Il
 * était de **réviser** l'existant — ajouter, reformuler, retirer — en partant
 * de ce qui est là.
 *
 * ## L'ordre d'affichage est délibéré
 *
 * Les **retraits en premier**, décochés par défaut. C'est le geste le plus
 * destructeur, et le seul que l'on ne peut pas défaire d'un clic : une
 * compétence archivée ne se remet pas au périmètre sans être désarchivée
 * d'abord. Les mettre en tête et décochés, c'est la sécurité qu'on ajoute
 * au-dessus d'ADR-027 — qui exige seulement d'annoncer le geste.
 *
 * Chaque retrait affiche le **nombre de preuves** et le **geste dérivé** qui en
 * découle, jamais un choix. Chaque reformulation l'affiche aussi, pour une
 * raison moins évidente : renommer ne casse rien, mais **réécrit le sens de
 * l'historique**. Une preuve enregistrée sur « Sait reconstruire un argument »
 * se lira désormais comme preuve de « Sait critiquer un sophisme ». ADR-027
 * autorise déjà d'éditer un intitulé — mais à l'unité. En masse, il faut voir
 * combien de preuves chaque ligne emporte.
 *
 * Comme pour l'évolution : l'appel réseau part du **clic**, jamais d'un effet.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import type { PropositionRevision } from "@/lib/tutor/outils";
import { appliquerRevision } from "@/lib/store/referentiel-actions";

export interface CompetenceRevisable {
  code: string;
  intitule: string;
  palier: string;
  preuves: number;
}

type Etat =
  | { phase: "saisie" }
  | { phase: "revision"; progression: string | null }
  | { phase: "relecture"; proposition: PropositionRevision }
  | { phase: "erreur"; message: string };

export function ModaleRevision({
  domaineId,
  domaineNom,
  competences,
  compteId,
  onFermer,
  onSaisieManuelle,
}: {
  domaineId: string;
  domaineNom: string;
  /** Les vivantes, avec leur compte de preuves — pour l'annonce avant clic. */
  competences: CompetenceRevisable[];
  compteId: string;
  onFermer: () => void;
  /** Le chemin manuel n'est pas perdu : la modale y renvoie. */
  onSaisieManuelle: () => void;
}) {
  const router = useRouter();
  const [demande, setDemande] = useState("");
  const [etat, setEtat] = useState<Etat>({ phase: "saisie" });
  const [garde, setGarde] = useState<Record<string, boolean>>({});
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const abandonRef = useRef<AbortController | null>(null);

  const preuvesParCode = new Map(competences.map((c) => [c.code, c.preuves]));
  const intitulesParCode = new Map(competences.map((c) => [c.code, c.intitule]));

  /** Lancée depuis un clic, jamais depuis un effet. */
  async function reviser() {
    if (demande.trim().length === 0) return;
    abandonRef.current?.abort();
    const abandon = new AbortController();
    abandonRef.current = abandon;
    setEtat({ phase: "revision", progression: null });
    setErreurAction(null);

    try {
      const reponse = await fetch("/api/referentiel/reviser", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domaineId,
          demande: demande.trim(),
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = (await reponse.json().catch(() => null)) as { message?: string } | null;
        setEtat({
          phase: "erreur",
          message: donnees?.message ?? "La révision n'a pas pu démarrer.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

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
            const recue = (JSON.parse(donnees) as { revision: PropositionRevision }).revision;
            // Ajouts et reformulations cochés ; retraits DÉCOCHÉS.
            const initial: Record<string, boolean> = {};
            recue.ajouts.forEach((_, i) => (initial[`a${i}`] = true));
            recue.modifications.forEach((m) => (initial[`m${m.code}`] = true));
            recue.retraits.forEach((r) => (initial[`r${r.code}`] = false));
            setGarde(initial);
            setEtat({ phase: "relecture", proposition: recue });
          } else if (type === "erreur") {
            setEtat({
              phase: "erreur",
              message: (JSON.parse(donnees) as { message: string }).message,
            });
          } else if (type === "proposition-en-cours") {
            setEtat({ phase: "revision", progression: "Le tuteur relit ta branche…" });
          }
        }
      }
    } catch {
      if (!abandon.signal.aborted) {
        setEtat({ phase: "erreur", message: "Révision interrompue." });
      }
    }
  }

  function appliquer(p: PropositionRevision) {
    setErreurAction(null);
    demarrer(async () => {
      try {
        await appliquerRevision({
          domaineId,
          domaine: p.domaine.nom || p.domaine.description ? p.domaine : undefined,
          ajouts: p.ajouts
            .filter((_, i) => garde[`a${i}`])
            .map((a) => ({
              intitule: a.intitule,
              palier: a.palier,
              importance: a.importance,
              prerequis: a.prerequis,
            })),
          modifications: p.modifications
            .filter((m) => garde[`m${m.code}`])
            .map((m) => ({
              code: m.code,
              intitule: m.intitule || undefined,
              palier: m.palier || undefined,
              importance: m.importance || undefined,
            })),
          retraits: p.retraits.filter((r) => garde[`r${r.code}`]).map((r) => r.code),
        });
        onFermer();
        router.refresh();
      } catch (e) {
        setErreurAction(e instanceof Error ? e.message : "La révision n'a pas pu être appliquée.");
      }
    });
  }

  const p = etat.phase === "relecture" ? etat.proposition : null;

  // Le pied : ce qui sera écrit, compté sur les cases réellement cochées.
  const compte = p
    ? {
        ajouts: p.ajouts.filter((_, i) => garde[`a${i}`]).length,
        modifs: p.modifications.filter((m) => garde[`m${m.code}`]).length,
        supprimees: p.retraits.filter(
          (r) => garde[`r${r.code}`] && (preuvesParCode.get(r.code) ?? 0) === 0,
        ).length,
        archivees: p.retraits.filter(
          (r) => garde[`r${r.code}`] && (preuvesParCode.get(r.code) ?? 0) > 0,
        ).length,
      }
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Réviser la branche"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">Réviser « {domaineNom} »</h2>
            <p className="mt-0.5 text-xs text-texte-discret">
              Dis ce qui ne va pas. Le tuteur propose, tu coches ce que tu gardes. Les codes
              existants ne changent jamais.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ✕
          </button>
        </div>

        {(etat.phase === "saisie" || etat.phase === "erreur") && (
          <div className="mt-4 space-y-3">
            {etat.phase === "erreur" && (
              <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
                {etat.message}
              </p>
            )}
            <label className="block">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Ce que tu veux changer
              </span>
              <textarea
                value={demande}
                onChange={(e) => setDemande(e.target.value)}
                rows={3}
                placeholder="Ce référentiel ne couvre plus mes besoins : recentre-le sur les flux et retire ce qui relève du stock."
                className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
              />
            </label>
            <p className="text-[0.6875rem] text-texte-discret">
              {competences.length} compétence{competences.length > 1 ? "s" : ""} vivante
              {competences.length > 1 ? "s" : ""} dans cette branche. Les compétences archivées
              ne sont pas touchées.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Bouton
                onClick={() => void reviser()}
                disabled={demande.trim().length === 0}
                variante="principal"
              >
                Demander une révision
              </Bouton>
              <button
                type="button"
                onClick={onSaisieManuelle}
                className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
              >
                Ajouter une compétence à la main
              </button>
            </div>
          </div>
        )}

        {etat.phase === "revision" && (
          <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
            <span className="size-1.5 animate-pulse rounded-full bg-primaire" aria-hidden />
            <p className="mt-3 text-sm text-texte-attenue">
              {etat.progression ?? "Le tuteur prend connaissance de la branche…"}
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

        {p && compte && (
          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2.5">
              <p className="text-[0.625rem] font-semibold uppercase tracking-wide text-texte-discret">
                Ce que le tuteur propose
              </p>
              <p className="mt-1 text-xs text-texte-attenue">{p.resume}</p>
            </div>

            {erreurAction && (
              <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
                {erreurAction}
              </p>
            )}

            {/* 1. Les retraits, en premier et décochés. */}
            {p.retraits.length > 0 && (
              <section>
                <h3 className="text-xs font-medium">
                  Retraits
                  <span className="ml-1.5 font-normal text-texte-discret">
                    — décochés par défaut, c{"'"}est le geste le moins réversible
                  </span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {p.retraits.map((r) => {
                    const preuves = preuvesParCode.get(r.code) ?? 0;
                    return (
                      <li
                        key={r.code}
                        className="rounded-md border border-bordure bg-surface-2 px-3 py-2"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={garde[`r${r.code}`] ?? false}
                            onChange={(e) =>
                              setGarde((g) => ({ ...g, [`r${r.code}`]: e.target.checked }))
                            }
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-medium">{r.code}</span>{" "}
                            <span className="text-xs">{intitulesParCode.get(r.code)}</span>
                            <span className="mt-0.5 block text-[0.6875rem] text-texte-attenue">
                              {r.justification}
                            </span>
                            {/* Le geste DÉRIVÉ, annoncé avant le clic (ADR-027). */}
                            <span className="mt-1 block text-[0.6875rem] text-texte-discret">
                              {preuves === 0 ? (
                                <>Suppression définitive (0 preuve). Le code ne sera pas réattribué.</>
                              ) : (
                                <>
                                  Archivage ({preuves} preuve{preuves > 1 ? "s" : ""}) — elles
                                  restent et gardent leur intitulé au journal. Tu devras la
                                  désarchiver pour la remettre au périmètre.
                                </>
                              )}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 2. Les reformulations, avec le compte de preuves qu'elles emportent. */}
            {p.modifications.length > 0 && (
              <section>
                <h3 className="text-xs font-medium">Reformulations</h3>
                <ul className="mt-2 space-y-2">
                  {p.modifications.map((m) => {
                    const preuves = preuvesParCode.get(m.code) ?? 0;
                    return (
                      <li
                        key={m.code}
                        className="rounded-md border border-bordure bg-surface-2 px-3 py-2"
                      >
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={garde[`m${m.code}`] ?? false}
                            onChange={(e) =>
                              setGarde((g) => ({ ...g, [`m${m.code}`]: e.target.checked }))
                            }
                            className="mt-0.5 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-medium">{m.code}</span>
                            {m.intitule && (
                              <span className="mt-0.5 block text-[0.6875rem]">
                                <span className="text-texte-discret line-through">
                                  {intitulesParCode.get(m.code)}
                                </span>{" "}
                                → <span className="text-texte">{m.intitule}</span>
                              </span>
                            )}
                            {(m.palier || m.importance) && (
                              <span className="mt-0.5 block text-[0.6875rem] text-texte-attenue">
                                {m.palier && <>palier → {m.palier} </>}
                                {m.importance && <>importance → {m.importance}</>}
                              </span>
                            )}
                            {/* Renommer ne casse rien, mais réécrit le sens de l'historique. */}
                            {preuves > 0 && (
                              <span className="mt-1 block text-[0.6875rem] text-texte-discret">
                                {preuves} preuve{preuves > 1 ? "s" : ""} porte
                                {preuves > 1 ? "nt" : ""} déjà cet intitulé au journal.
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* 3. Les ajouts. */}
            {p.ajouts.length > 0 && (
              <section>
                <h3 className="text-xs font-medium">
                  Ajouts
                  <span className="ml-1.5 font-normal text-texte-discret">
                    — les codes seront attribués à l{"'"}enregistrement
                  </span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {p.ajouts.map((a, i) => (
                    <li key={i} className="rounded-md border border-bordure bg-surface-2 px-3 py-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={garde[`a${i}`] ?? false}
                          onChange={(e) => setGarde((g) => ({ ...g, [`a${i}`]: e.target.checked }))}
                          className="mt-0.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-xs">{a.intitule}</span>
                          <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">
                            palier {a.palier || "fondamentaux"} · importance {a.importance || "0.5"}
                            {a.prerequis.length > 0 && <> · s{"'"}appuie sur {a.prerequis.join(", ")}</>}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Le pied : exactement ce qui sera écrit. */}
            <div className="rounded-md border border-bordure bg-surface-2 px-3 py-2.5 text-[0.6875rem] text-texte-attenue">
              <p className="font-medium text-texte">Ce qui sera écrit</p>
              <p className="mt-1">
                {compte.ajouts} ajout{compte.ajouts > 1 ? "s" : ""} · {compte.modifs} reformulation
                {compte.modifs > 1 ? "s" : ""} · <strong>{compte.supprimees} suppression
                {compte.supprimees > 1 ? "s" : ""}</strong> · <strong>{compte.archivees} archivage
                {compte.archivees > 1 ? "s" : ""}</strong>
              </p>
              <p className="mt-1">
                Aucun code existant n{"'"}est modifié : c{"'"}est la clé étrangère des preuves.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Bouton
                onClick={() => appliquer(p)}
                disabled={
                  enCours ||
                  compte.ajouts + compte.modifs + compte.supprimees + compte.archivees === 0
                }
                variante="principal"
              >
                {enCours ? "Application…" : "Appliquer ce qui est coché"}
              </Bouton>
              <button
                type="button"
                onClick={() => setEtat({ phase: "saisie" })}
                disabled={enCours}
                className="text-[0.6875rem] text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
              >
                Reformuler ma demande
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
