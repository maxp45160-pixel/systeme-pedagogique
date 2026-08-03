"use client";

/**
 * Modale de création de branche — le référentiel dans une modale (lot 2).
 *
 * `ValidationBranche` était déjà un éditeur complet et modifiable : il devient
 * le corps de cette modale. Ce qui change :
 *
 *  - on part d'un état vide ou pré-rempli, sans l'écran « Charger la
 *    proposition » ;
 *  - un bouton `+ Ajouter une compétence` permet d'ajouter des lignes ;
 *  - `origine` est une prop, pas un littéral ;
 *  - « Suggérer avec le tuteur » remplit les lignes via la route
 *    `/api/referentiel/generer`, chacune décochable et modifiable.
 *
 * Aucun champ `code` : il est attribué à l'enregistrement par `attribuerCodes`,
 * et la modale le dit. Le tuteur n'écrit aucune mesure (P5 reformulé) — il
 * propose du contenu, l'utilisateur valide.
 */

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerBranche } from "@/lib/store/referentiel-actions";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { normaliserPalier, prefixeParDefaut } from "@/lib/domain/referentiel-compte";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import type { OrigineReferentiel, Palier } from "@/lib/domain/types";
import type { PropositionReferentiel } from "@/lib/tutor/proposition";

const champ =
  "w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none";

const PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

interface Ligne {
  intitule: string;
  palier: Palier;
  importance: string;
  retenue: boolean;
}

function ligneVide(): Ligne {
  return { intitule: "", palier: "fondamentaux", importance: "0.5", retenue: true };
}

export function ModaleCompetence({
  onFermer,
  domainesExistants,
  compteId,
  domaineInitial = "",
  origine = "utilisateur",
}: {
  onFermer: () => void;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  compteId: string;
  /** Pré-rempli quand on clique `+ Compétence` sur une carte de domaine. */
  domaineInitial?: string;
  /** `"utilisateur"` ou `"tuteur"` — l'action accepte déjà le paramètre. */
  origine?: OrigineReferentiel;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<string | null>(null);

  const [domaine, setDomaine] = useState(domaineInitial);
  const [prefixe, setPrefixe] = useState("");
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([ligneVide()]);

  // Génération tuteur
  const [themeGen, setThemeGen] = useState("");
  const [phaseGen, setPhaseGen] = useState<"repos" | "generation">("repos");
  const [progressionGen, setProgressionGen] = useState<string | null>(null);
  const abandonGenRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controleur = abandonGenRef;
    return () => controleur.current?.abort();
  }, []);

  // Rattachement par nom : c'est ce que l'utilisateur lit. Le préfixe du
  // domaine existant fera foi côté serveur.
  const existant = domainesExistants.find(
    (d) => d.nom.toLowerCase() === domaine.trim().toLowerCase(),
  );

  function majLigne(i: number, maj: Partial<Ligne>) {
    setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...maj } : x)));
  }

  function ajouterLigne() {
    setLignes((l) => [...l, ligneVide()]);
  }

  function retirerLigne(i: number) {
    setLignes((l) => l.filter((_, k) => k !== i));
  }

  const retenues = lignes.filter((l) => l.retenue && l.intitule.trim().length > 0);
  const pret = domaine.trim().length > 2 && retenues.length > 0;

  function soumettre() {
    setErreur(null);
    setAvis(null);
    demarrer(async () => {
      try {
        const r = await creerBranche({
          domaine,
          prefixe,
          description,
          competences: retenues.map((l) => ({
            intitule: l.intitule,
            palier: l.palier,
            importance: l.importance,
          })),
          origine,
        });
        setAvis(
          `${r.codes.length} compétence${r.codes.length > 1 ? "s" : ""} ajoutée${r.codes.length > 1 ? "s" : ""} : ${r.codes.join(", ")}. Les codes ont été attribués par l'application.`,
        );
        // Réinitialiser les lignes pour permettre un second ajout.
        setLignes([ligneVide()]);
        router.refresh();
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  const suggérer = useCallback(async () => {
    const theme = themeGen.trim();
    if (theme.length < 3) return;

    setPhaseGen("generation");
    setProgressionGen(null);
    setErreur(null);

    const abandon = new AbortController();
    abandonGenRef.current = abandon;

    try {
      const reponse = await fetch("/api/referentiel/generer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme,
          config: lireConfigTuteur(compteId) ?? undefined,
        }),
        signal: abandon.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setErreur(
          donnees?.message ??
            "La génération n'a pas pu démarrer. Vérifie la configuration du tuteur dans les réglages.",
        );
        setPhaseGen("repos");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        const evenements = tampon.split("\n\n");
        tampon = evenements.pop() ?? "";

        for (const bloc of evenements) {
          const lignesBloc = bloc.split("\n");
          const type = lignesBloc.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignesBloc.find((l) => l.startsWith("data:"))?.slice(5).trim();

          if (type === "propositions" && donnees) {
            const parsed = JSON.parse(donnees) as { branches: PropositionReferentiel[] };
            if (parsed.branches.length > 0) {
              const b = parsed.branches[0];
              setDomaine(b.domaine);
              setPrefixe(b.prefixe || prefixeParDefaut(b.domaine));
              setDescription(b.description);
              setLignes(
                b.competences.map((c) => ({
                  intitule: c.intitule,
                  palier: normaliserPalier(c.palier),
                  importance: c.importance || "0.5",
                  retenue: true,
                })),
              );
            }
            setPhaseGen("repos");
          } else if (type === "erreur" && donnees) {
            const parsed = JSON.parse(donnees) as { message: string };
            setErreur(parsed.message);
            setPhaseGen("repos");
          } else if (type === "proposition-en-cours") {
            setProgressionGen("Le tuteur compose une branche de compétences…");
          }
        }
      }
    } catch {
      if (!abandon.signal.aborted) {
        setErreur("Génération interrompue.");
        setPhaseGen("repos");
      }
    }
  }, [themeGen, compteId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter une compétence"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">
              {domaineInitial ? "Ajouter une compétence" : "Nouvelle branche"}
            </h2>
            <p className="mt-0.5 text-xs text-texte-discret">
              Les codes sont attribués à l&apos;enregistrement — tu ne les saisis pas.
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

        {/* Suggérer avec le tuteur */}
        <div className="mt-4 rounded-md border border-bordure bg-surface-2 px-3 py-2.5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Suggérer avec le tuteur
          </p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={themeGen}
              onChange={(e) => setThemeGen(e.target.value)}
              placeholder="Un sujet, un domaine…"
              className={cx(champ, "flex-1")}
              disabled={phaseGen === "generation"}
            />
            <button
              type="button"
              onClick={() => void suggérer()}
              disabled={phaseGen === "generation" || themeGen.trim().length < 3}
              className={classesBouton("secondaire", "petite")}
            >
              {phaseGen === "generation" ? "…" : "Suggérer"}
            </button>
          </div>
          {phaseGen === "generation" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-texte-attenue">
              <span className="size-1.5 animate-pulse rounded-full bg-primaire" />
              {progressionGen ?? "Le tuteur prend connaissance du sujet…"}
            </p>
          )}
        </div>

        {/* Formulaire */}
        <div className="mt-4 space-y-4">
          {avis && (
            <div className="flex items-start gap-1.5 rounded-md border border-succes/30 bg-succes-faible px-3 py-2 text-xs text-succes">
              <span className="font-medium">✓</span> {avis}
            </div>
          )}

          {existant && (
            <div className="flex items-center gap-1.5">
              <Etiquette ton="info">Domaine existant</Etiquette>
              <span className="text-xs text-texte-attenue">
                rattaché à « {existant.nom} » ({existant.prefixe})
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="text-xs font-medium">Domaine</span>
              <input
                value={domaine}
                onChange={(e) => setDomaine(e.target.value)}
                className={cx(champ, "mt-1")}
                placeholder="Nom du domaine"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Préfixe</span>
              <input
                value={existant ? existant.prefixe : prefixe}
                onChange={(e) => setPrefixe(e.target.value.toUpperCase())}
                disabled={Boolean(existant)}
                maxLength={5}
                className={cx(champ, "mt-1 w-24 font-mono disabled:opacity-60")}
                placeholder="ABC"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cx(champ, "mt-1")}
              placeholder="Ce que la branche couvre, en une phrase"
            />
          </label>

          <div>
            <p className="text-xs font-medium">
              Compétences ({retenues.length} retenue(s))
            </p>
            <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
              Chacune doit décrire un savoir-faire observable. Les codes seront attribués à
              l&apos;enregistrement.
            </p>

            <ul className="mt-2 space-y-2">
              {lignes.map((l, i) => (
                <li
                  key={i}
                  className={cx(
                    "rounded-md border border-bordure px-3 py-2",
                    !l.retenue && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={l.retenue}
                      onChange={(e) => majLigne(i, { retenue: e.target.checked })}
                      className="mt-2"
                      aria-label={`Retenir « ${l.intitule || "compétence"} »`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={l.intitule}
                        onChange={(e) => majLigne(i, { intitule: e.target.value })}
                        className={champ}
                        placeholder="Savoir-faire observable…"
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1.5">
                          <span className="text-texte-attenue">Palier</span>
                          <select
                            value={l.palier}
                            onChange={(e) => majLigne(i, { palier: e.target.value as Palier })}
                            className="rounded-md border border-bordure bg-surface px-1.5 py-1"
                          >
                            {PALIERS.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex items-center gap-1.5">
                          <span className="text-texte-attenue">Importance</span>
                          <input
                            value={l.importance}
                            onChange={(e) => majLigne(i, { importance: e.target.value })}
                            className="w-16 rounded-md border border-bordure bg-surface px-1.5 py-1"
                          />
                        </label>
                        {lignes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => retirerLigne(i)}
                            className="text-texte-discret hover:text-danger"
                            aria-label="Retirer cette ligne"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={ajouterLigne}
              className={cx(classesBouton("discret", "petite"), "mt-2")}
            >
              + Ajouter une compétence
            </button>
          </div>

          {erreur && (
            <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-bordure pt-3">
            <button type="button" onClick={onFermer} className={classesBouton("secondaire")}>
              Annuler
            </button>
            <button
              type="button"
              onClick={soumettre}
              disabled={!pret || enCours}
              className={classesBouton("principal")}
            >
              {enCours
                ? "Enregistrement…"
                : `Ajouter ${retenues.length || ""} compétence${retenues.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}