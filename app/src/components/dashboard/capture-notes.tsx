"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IconeDocuments, IconeExercices, IconeFleche } from "@/components/ui/icones";
import { Modale } from "@/components/ui/modale";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { creerNoteAction } from "@/lib/store/document-actions";
import { FORMATS_PAR_ROLE, type RoleNote } from "@/lib/documents/roles-note";

export interface DomaineNote {
  id: string;
  nom: string;
}

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "note";
}

export function CaptureNotes({ domaines }: { domaines: DomaineNote[] }) {
  const router = useRouter();
  const [role, setRole] = useState<RoleNote | null>(null);
  const [titre, setTitre] = useState("");
  const [format, setFormat] = useState("note");
  const [contexte, setContexte] = useState("");
  const [domaine, setDomaine] = useState("transversal");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  function ouvrir(suivant: RoleNote) {
    setRole(suivant);
    setFormat(FORMATS_PAR_ROLE[suivant][0].valeur);
    setTitre("");
    setContexte("");
    setDomaine("transversal");
    setErreur(null);
  }

  function creer() {
    if (!role || !titre.trim() || !contexte.trim() || !domaine) return;
    setErreur(null);
    demarrer(async () => {
      try {
        const id = `${format}-${slugifier(titre)}`;
        await creerNoteAction(role, format, id, titre.trim(), { contexte, domaine });
        setRole(null);
        /*
         * Capturer une note opérationnelle, c'est demander à travailler — pas à
         * ouvrir un éditeur. On atterrit donc directement dans son espace de
         * travail. Une note de support, elle, se lit et s'annote : l'Atelier
         * suffit.
         */
        const parametre = role === "operationnel" ? "note" : "document";
        router.push(`/atelier?${parametre}=${encodeURIComponent(id)}`);
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
          <p className="text-sm font-medium">Capturer une note</p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Choisis d’abord son rôle. Le format vient ensuite.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              type="button"
              onClick={() => ouvrir("support")}
              className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <IconeDocuments className="size-5 text-primaire" />
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
              </span>
              <span className="mt-3 block text-sm font-semibold">Support</span>
              <span className="mt-1 block text-xs leading-relaxed text-texte-discret">
                Comprendre, préparer ou personnaliser un contenu.
              </span>
            </button>
            <button
              type="button"
              onClick={() => ouvrir("operationnel")}
              className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-alerte/35 hover:bg-alerte-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <IconeExercices className="size-5 text-alerte" />
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-alerte" />
              </span>
              <span className="mt-3 block text-sm font-semibold">Opérationnelle</span>
              <span className="mt-1 block text-xs leading-relaxed text-texte-discret">
                Cadrer un travail qui pourra ensuite être évalué.
              </span>
            </button>
          </div>
        </div>
      </Carte>

      {role && (
        <Modale
          titre={role === "support" ? "Nouvelle note de support" : "Nouvelle note opérationnelle"}
          sousTitre={
            role === "support"
              ? "Cette fiche enrichit le contexte documentaire ; elle ne mesure aucune compétence."
              : "Cette fiche cadre une production. Elle ne deviendra une preuve qu’après une évaluation validée."
          }
          largeur="md"
          onFermer={() => setRole(null)}
          pied={
            <>
              <Bouton variante="secondaire" onClick={() => setRole(null)}>Annuler</Bouton>
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
                placeholder={role === "support" ? "Ex. Notes sur la théorie des files" : "Ex. Audit du flux de préparation"}
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
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Domaine</span>
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
              <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Format</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm"
              >
                {FORMATS_PAR_ROLE[role].map((option) => (
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
