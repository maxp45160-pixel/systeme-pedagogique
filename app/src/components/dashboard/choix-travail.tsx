"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import { IconeFleche } from "@/components/ui/icones";
import { Modale } from "@/components/ui/modale";
import { Bouton, Carte, cx } from "@/components/ui/primitives";
import { creerNoteAction } from "@/lib/store/document-actions";
import {
  FORMATS_OPERATIONNELS_A_VENIR,
  FORMATS_OPERATIONNELS_DISPONIBLES,
} from "@/lib/documents/roles-note";

type FormatTravail = (typeof FORMATS_OPERATIONNELS_DISPONIBLES)[number];

const LIBELLE_FORMAT: Record<FormatTravail, string> = {
  seance: "Séance de travail",
  projet: "Projet",
};

export interface RecommandationTravail {
  code: string;
  intitule: string;
  domaineId: string;
  domaineNom: string;
  raison: string;
}

/** Entrée dédiée au travail : les notes support restent dans `CaptureNotes`. */
export function ChoixTravail({
  recommandations,
  compteId,
}: {
  recommandations: RecommandationTravail[];
  compteId: string;
}) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [cible, setCible] = useState<string | null>(null);
  const [autreSujet, setAutreSujet] = useState("");
  const [format, setFormat] = useState<FormatTravail>("seance");
  const [projetOuvert, setProjetOuvert] = useState(false);
  const [intentionProjet, setIntentionProjet] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const recommandationSelectionnee = cible
    ? recommandations.find((recommandation) => recommandation.code === cible)
    : undefined;
  const sujetLibre = autreSujet.trim();
  const libelleCible = recommandationSelectionnee?.intitule ?? (cible === "autre" ? sujetLibre : "");
  const domaineCible = recommandationSelectionnee?.domaineId ?? "transversal";

  function ouvrir(cibleInitiale: string) {
    setOuverte(true);
    setCible(cibleInitiale);
    setAutreSujet("");
    setFormat("seance");
    setErreur(null);
  }

  function commencer() {
    if (!libelleCible) return;
    setErreur(null);

    /*
      Le projet passe par son propre parcours : le tuteur désigne les
      compétences, la personne confirme, puis il rédige le sujet. La séance
      n'a besoin de rien de tout cela — elle se compose à l'ouverture.
    */
    if (format === "projet") {
      setIntentionProjet(libelleCible);
      setOuverte(false);
      setProjetOuvert(true);
      return;
    }

    demarrer(async () => {
      try {
        // Le libellé sert de repère technique au document produit par le
        // parcours ; l'utilisateur ne choisit plus un titre ni un contexte.
        const fiche = await creerNoteAction(
          "operationnel",
          "seance",
          `Séance de travail — ${libelleCible}`,
          { contexte: libelleCible, domaine: domaineCible },
        );
        setOuverte(false);
        router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Le travail n'a pas pu démarrer.");
      }
    });
  }

  return (
    <>
      <Carte className="overflow-hidden">
        <div className="px-5 py-4 sm:px-6">
          <p className="text-sm font-medium">Choisir un travail</p>
          <p className="mt-1 text-xs leading-relaxed text-texte-attenue">
            Deux priorités recommandées, ou un autre sujet si tu préfères.
          </p>
          <div className="mt-4 grid gap-2">
            {recommandations.slice(0, 2).map((recommandation, index) => (
              <button
                key={recommandation.code}
                type="button"
                onClick={() => ouvrir(recommandation.code)}
                className="group rounded-xl border border-bordure bg-surface-2 p-3 text-left transition-colors hover:border-alerte/35 hover:bg-alerte-faible/35"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-alerte">
                    Priorité {index + 1}
                  </span>
                  <IconeFleche className="size-3.5 text-texte-discret group-hover:text-alerte" />
                </span>
                <span className="mt-2 block text-sm font-semibold">{recommandation.intitule}</span>
                <span className="mt-1 block text-xs text-texte-discret">
                  {recommandation.domaineNom} · {recommandation.raison}
                </span>
              </button>
            ))}
            {recommandations.length === 0 && (
              <p className="rounded-lg border border-bordure px-3 py-2 text-xs text-texte-discret">
                Aucune priorité disponible pour le moment.
              </p>
            )}
            <button
              type="button"
              onClick={() => ouvrir("autre")}
              className="group rounded-xl border border-dashed border-bordure-contraste bg-surface p-3 text-left transition-colors hover:border-primaire/35 hover:bg-primaire-faible/35"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Autre sujet</span>
                <IconeFleche className="size-3.5 text-texte-discret group-hover:text-primaire" />
              </span>
              <span className="mt-1 block text-xs text-texte-discret">Décris ce que tu veux travailler.</span>
            </button>
          </div>
        </div>
      </Carte>

      {projetOuvert && (
        <ParcoursNouveauProjet
          accountId={compteId}
          intentionInitiale={intentionProjet}
          onFermer={() => setProjetOuvert(false)}
        />
      )}

      {ouverte && !projetOuvert && (
        <Modale
          titre="Nouveau travail"
          sousTitre="Décris le sujet : il devient directement le travail à ouvrir."
          largeur="md"
          onFermer={() => setOuverte(false)}
          pied={
            <>
              <Bouton variante="secondaire" onClick={() => setOuverte(false)}>Annuler</Bouton>
              <Bouton
                variante="principal"
                onClick={commencer}
                disabled={!libelleCible}
                enChargement={enCours}
                className={cx(enCours && "pointer-events-none")}
              >
                Commencer
              </Bouton>
            </>
          }
        >
          <div className="space-y-5">
            {cible === "autre" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Autre sujet</span>
                <input
                  value={autreSujet}
                  onChange={(event) => setAutreSujet(event.target.value)}
                  placeholder="Ex. Préparer mon entretien de demain"
                  maxLength={200}
                  autoFocus
                  className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2.5 text-sm outline-none focus:border-primaire"
                />
              </label>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Sujet de la séance</p>
              <p className="mt-1 rounded-lg border border-primaire/35 bg-primaire-faible/35 px-3 py-2.5 text-sm font-medium">
                {cible === "autre" ? sujetLibre || "Décris ton sujet ci-dessus" : libelleCible}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Type de travail</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATS_OPERATIONNELS_DISPONIBLES.map((valeur) => (
                  <button
                    key={valeur}
                    type="button"
                    onClick={() => setFormat(valeur)}
                    aria-pressed={format === valeur}
                    className={cx(
                      "rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors",
                      format === valeur
                        ? "border-primaire bg-primaire-faible text-primaire"
                        : "border-bordure bg-surface-2 hover:border-primaire/35",
                    )}
                  >
                    {LIBELLE_FORMAT[valeur]}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 border-t border-bordure pt-3">
                <p className="text-xs text-texte-discret">Coming soon</p>
                {FORMATS_OPERATIONNELS_A_VENIR.map((option) => (
                  <div key={option.valeur} className="flex items-center justify-between rounded-lg border border-bordure/70 px-3 py-2 text-sm text-texte-discret">
                    <span>{option.libelle}</span>
                    <span className="text-[0.6875rem] uppercase tracking-wide">Coming soon</span>
                  </div>
                ))}
              </div>
            </div>
            {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
          </div>
        </Modale>
      )}
    </>
  );
}
