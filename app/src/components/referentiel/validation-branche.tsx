"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerBranche } from "@/lib/store/referentiel-actions";
import {
  cleReferentielPropose,
  type PropositionReferentiel,
} from "@/lib/tutor/proposition";
import { normaliserPalier, prefixeParDefaut } from "@/lib/domain/referentiel-compte";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import { effacerSession, lireSession } from "@/lib/ui/stockage-session";
import type { Palier } from "@/lib/domain/types";

/**
 * Validation d'une branche proposée par le tuteur.
 *
 * Même contrat que le formulaire d'exercice : le tuteur remplit, l'utilisateur
 * relit et corrige, et c'est sa validation qui écrit (P5). Chaque intitulé
 * reste modifiable, chaque compétence peut être décochée.
 *
 * Ce que le formulaire n'affiche PAS, et c'est volontaire : les codes. Ils sont
 * attribués par le serveur à partir du préfixe du domaine, après validation.
 * Les montrer ici laisserait croire qu'ils sont négociables, alors qu'ils sont
 * la clé étrangère des preuves et ne changeront plus jamais.
 */
const champ =
  "w-full rounded-md border border-bordure bg-surface px-2 py-1.5 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none";

const PALIERS: Palier[] = ["fondamentaux", "intermediaire", "avance"];

interface Ligne {
  intitule: string;
  palier: Palier;
  importance: string;
  retenue: boolean;
}

export function ValidationBranche({
  domainesExistants,
  compteId,
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  /** Isole la proposition en attente (voir `stockage-session`). */
  compteId: string;
}) {
  const router = useRouter();
  const cleProposition = cleReferentielPropose(compteId);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargee, setChargee] = useState(false);
  const [perdue, setPerdue] = useState(false);

  const [domaine, setDomaine] = useState("");
  const [prefixe, setPrefixe] = useState("");
  const [description, setDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [lignes, setLignes] = useState<Ligne[]>([]);

  // Rattachement par nom : c'est ce que le tuteur écrit et ce que l'utilisateur
  // lit. Le préfixe du domaine existant fera foi côté serveur.
  const existant = domainesExistants.find(
    (d) => d.nom.toLowerCase() === domaine.trim().toLowerCase(),
  );

  /**
   * La proposition n'est pas consommée à la lecture.
   *
   * Elle l'était, et le retour sur cet écran — ne serait-ce que pour vérifier
   * un intitulé existant ailleurs — remontait alors un formulaire vide et une
   * branche à redemander au tuteur. Elle est retirée à la création de la
   * branche, seul moment où elle n'a plus d'objet.
   */
  function charger() {
    const p = lireSession<PropositionReferentiel>(cleProposition);
    if (!p) {
      setPerdue(true);
      setChargee(true);
      return;
    }

    setDomaine(p.domaine);
    setPrefixe(p.prefixe || prefixeParDefaut(p.domaine));
    setDescription(p.description);
    setJustification(p.justification);
    setLignes(
      p.competences.map((c) => ({
        intitule: c.intitule,
        palier: normaliserPalier(c.palier),
        // Conservée en chaîne : `normaliserImportance` tranche côté serveur,
        // et une virgule décimale doit rester lisible en attendant.
        importance: c.importance || "0.5",
        retenue: true,
      })),
    );
    setPerdue(false);
    setChargee(true);
  }

  function majLigne(i: number, maj: Partial<Ligne>) {
    setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...maj } : x)));
  }

  const retenues = lignes.filter((l) => l.retenue && l.intitule.trim().length > 0);
  const pret = domaine.trim().length > 2 && retenues.length > 0;

  function soumettre() {
    setErreur(null);
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
          origine: "tuteur",
        });
        // La branche existe : la proposition n'a plus d'objet, et la relire
        // rejouerait une validation déjà faite.
        effacerSession(cleProposition);
        // `creerBranche` a déjà invalidé le cache (`revalidatePath`) : le
        // `router.refresh()` qui suivait payait un second rendu complet.
        router.push(`/competences?ajoutees=${r.codes.length}`);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  if (!chargee) {
    return (
      <div>
        <p className="text-sm font-medium">Une branche t&apos;attend</p>
        <p className="mt-1 max-w-2xl text-xs text-texte-attenue">
          Le tuteur a proposé des compétences. Charge-les pour les relire, les corriger, et
          décider lesquelles rejoignent ton référentiel.
        </p>
        <button type="button" onClick={charger} className={cx(classesBouton("principal"), "mt-3")}>
          Charger la proposition
        </button>
      </div>
    );
  }

  if (perdue) {
    return (
      <div>
        <p className="text-sm font-medium">Proposition introuvable</p>
        <p className="mt-1 max-w-2xl text-xs text-texte-attenue">
          Elle n&apos;a pas survécu à la navigation — elle transite par la session du navigateur,
          jamais par la base. Redemande-la au tuteur : rien n&apos;a été écrit.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Etiquette ton="primaire">Proposé par le tuteur</Etiquette>
        {existant ? (
          <span className="text-xs text-texte-attenue">
            rattaché au domaine existant « {existant.nom} » ({existant.prefixe})
          </span>
        ) : (
          <span className="text-xs text-texte-attenue">nouvelle branche</span>
        )}
      </div>

      {justification && (
        <p className="rounded-md border border-bordure bg-surface-2 px-3 py-2 text-xs text-texte-attenue">
          <span className="font-medium">Sur quoi le tuteur s&apos;appuie :</span> {justification}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium">Domaine</span>
          <input
            value={domaine}
            onChange={(e) => setDomaine(e.target.value)}
            className={cx(champ, "mt-1")}
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
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium">Description</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={cx(champ, "mt-1")}
        />
      </label>

      <div>
        <p className="text-xs font-medium">Compétences ({retenues.length} retenue(s))</p>
        <p className="mt-0.5 text-[0.6875rem] text-texte-discret">
          Chacune doit décrire un savoir-faire observable, prouvable par un exercice. Les codes
          seront attribués à l&apos;enregistrement.
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
                  aria-label={`Retenir « ${l.intitule} »`}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={l.intitule}
                    onChange={(e) => majLigne(i, { intitule: e.target.value })}
                    className={champ}
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
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {erreur && (
        <p className="rounded-md border border-alerte/30 bg-alerte-faible px-3 py-2 text-xs text-alerte">
          {erreur}
        </p>
      )}

      <button
        type="button"
        onClick={soumettre}
        disabled={!pret || enCours}
        className={classesBouton("principal")}
      >
        {enCours
          ? "Enregistrement…"
          : `Ajouter ${retenues.length} compétence${retenues.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
