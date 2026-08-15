"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconeDocuments, IconeFleche } from "@/components/ui/icones";
import { Modale } from "@/components/ui/modale";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";

export interface DomaineNote {
  id: string;
  nom: string;
  prefixe: string;
}

/**
 * CaptureNotes reste l'entrée des notes de support.
 *
 * Un travail n'est pas une note que l'on saisit avant de commencer : il a son
 * propre parcours et peut produire une fiche ensuite. Garder les deux rôles
 * dans cette modale mélangeait une capture documentaire avec un geste de
 * travail.
 */
export function CaptureNotes({ domaines }: { domaines: DomaineNote[] }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [titre, setTitre] = useState("");
  const [format, setFormat] = useState(FORMATS_PAR_ROLE.support[0].valeur);
  const [contexte, setContexte] = useState("");
  const [domaine, setDomaine] = useState("transversal");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function ouvrir() {
    setOuverte(true);
    setTitre("");
    setFormat(FORMATS_PAR_ROLE.support[0].valeur);
    setContexte("");
    setDomaine("transversal");
    setErreur(null);
  }

  function creer() {
    if (!titre.trim() || !contexte.trim() || !domaine) return;
    setErreur(null);
    demarrer(async () => {
      try {
        const fiche = await creerNoteAction("support", format, titre.trim(), {
          contexte,
          domaine,
        });
        setOuverte(false);
        router.push(`/atelier?document=${encodeURIComponent(fiche.id)}`);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      }
    });
  }

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Renseigner une donnée</p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Ajouter une connaissance, une référence ou un support utile.
          </p>
          <button
            type="button"
            onClick={ouvrir}
            className="group mt-4 flex w-full items-center justify-between rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
          >
            <span className="flex items-center gap-3">
              <IconeDocuments className="size-5 text-primaire" />
              <span className="text-sm font-semibold">Nouvelle note de support</span>
            </span>
            <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
          </button>
        </div>
      </Carte>

      {ouverte && (
        <Modale
          titre="Nouvelle donnée"
          sousTitre="Cette fiche enrichit ton contexte documentaire ; elle ne mesure aucune compétence."
          largeur="md"
          onFermer={() => setOuverte(false)}
          pied={
            <>
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>Annuler</Bouton>
              <Bouton
                variante="principal"
                onClick={creer}
                disabled={!titre.trim() || !contexte.trim() || !domaine}
                enChargement={enCours}
                className={cx(enCours && "pointer-events-none")}
              >
                Créer et ouvrir
              </Bouton>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Titre</span>
              <input
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") creer(); }}
                placeholder="Ex. Notes sur la théorie des files"
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Contexte</span>
              <input
                value={contexte}
                onChange={(event) => setContexte(event.target.value)}
                placeholder="Ex. Cours suivi, projet professionnel, curiosité personnelle…"
                maxLength={200}
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Domaine concerné</span>
              <select
                value={domaine}
                onChange={(event) => setDomaine(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm"
              >
                <option value="transversal">Transversal / plusieurs domaines</option>
                {domaines.map((option) => (
                  <option key={option.id} value={option.id}>{option.nom}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Type de donnée</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm"
              >
                {FORMATS_PAR_ROLE.support.map((option) => (
                  <option key={option.valeur} value={option.valeur}>{option.libelle}</option>
                ))}
              </select>
            </label>
            {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
          </div>
        </Modale>
      )}
    </>
  );
}
