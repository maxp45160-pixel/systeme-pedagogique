"use client";

/**
 * La zone de saisie du tuteur, isolée.
 *
 * `setSaisie` vit dans ce composant enfant : les frappes clavier ne
 * déclenchent plus le re-render du transcript ni des boucles d'extraction.
 * Le composant parent ne reçoit le texte qu'au submit.
 */

import { memo, useEffect, useRef, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { PaletteFormulesTexte } from "@/components/ui/palette-formules";

/** Les six modes rapides — « Donne-moi un exercice » a disparu (lot 1.4). */
const MODES = [
  { cle: "explique", libelle: "Explique-moi", amorce: "Explique-moi " },
  { cle: "evalue", libelle: "Évalue-moi", amorce: "Évalue mon niveau sur " },
  { cle: "indice", libelle: "Donne-moi un indice", amorce: "Donne-moi un indice sur " },
  { cle: "corrige", libelle: "Corrige mon raisonnement", amorce: "Corrige mon raisonnement :\n\n" },
  { cle: "lacunes", libelle: "Fais le point sur mes lacunes", amorce: "Fais le point sur mes lacunes." },
  { cle: "projet", libelle: "Propose-moi un projet", amorce: "Propose-moi un projet sur " },
] as const;

export const ChatInput = memo(function ChatInput({
  onEnvoyer,
  onCopier,
  onArreter,
  onReinitialiser,
  enCours,
  cleAbsente,
  usage,
  saisieInitiale,
  indicesMasques = false,
}: {
  onEnvoyer: (texte: string) => void;
  onCopier: (texte: string) => void;
  onArreter: () => void;
  /** Absent quand il n'y a rien à effacer : le bouton ne s'affiche pas. */
  onReinitialiser?: () => void;
  enCours: boolean;
  cleAbsente: boolean;
  usage: string | null;
  saisieInitiale: string;
  /**
   * Mode épreuve : l'entrée « Donne-moi un indice » ne s'affiche pas pendant
   * le déroulé de la séance. La saisie libre reste possible — c'est le geste
   * dédié qui disparaît, pas une censure du chat.
   */
  indicesMasques?: boolean;
}) {
  const [saisie, setSaisie] = useState(saisieInitiale);
  const [saisieInitialePrecedente, setSaisieInitialePrecedente] = useState(saisieInitiale);
  const champRef = useRef<HTMLTextAreaElement>(null);

  const modesVisibles = MODES.filter((m) => !(indicesMasques && m.cle === "indice"));

  if (saisieInitiale !== saisieInitialePrecedente) {
    setSaisieInitialePrecedente(saisieInitiale);
    setSaisie(saisieInitiale);
  }

  useEffect(() => {
    if (saisieInitiale) {
      champRef.current?.focus();
    }
  }, [saisieInitiale]);

  return (
    <div className="border-t border-bordure px-3 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {modesVisibles.map((m) => (
          <button
            key={m.cle}
            type="button"
            disabled={enCours}
            onClick={() => {
              setSaisie(m.amorce);
              champRef.current?.focus();
            }}
            className="rounded border border-bordure px-1.5 py-0.5 text-[0.6875rem] font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50"
          >
            {m.libelle}
          </button>
        ))}
        {/* On pose des questions de mathématiques au tuteur : la palette doit
            être là aussi, sinon il faut taper le LaTeX de mémoire. */}
        <div className="ml-auto">
          <PaletteFormulesTexte
            champ={champRef}
            valeur={saisie}
            onChange={setSaisie}
            desactivee={enCours}
          />
        </div>
      </div>

      {/*
        Point d'entrée du focus quand le chat est monté dans une modale.

        `Modale` focalise le premier élément focalisable du panneau : ici les
        boutons de mode, qui ne servent qu'à pré-remplir la saisie. Ouvrir le
        tiroir pour poser une question devait donc commencer par une
        tabulation. L'attribut désigne le champ ; hors modale il est inerte.
      */}
      <textarea
        ref={champRef}
        data-focus-initial
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            /*
             * Le raccourci doit dire exactement ce que dit le bouton.
             *
             * Il ne consultait pas `enCours` : pendant une génération,
             * `envoyer` sortait immédiatement mais `setSaisie("")` s'exécutait
             * quand même. Le message tapé disparaissait sans partir ni laisser
             * de trace — c'est le « le tuteur plante quand on enchaîne » le
             * plus fréquent, et ce n'était pas le tuteur.
             *
             * Le bouton, lui, est remplacé par « Arrêter » dans cet état : le
             * chemin clavier était le seul trou.
             */
            if (enCours) return;
            const texte = saisie.trim();
            if (texte) {
              onEnvoyer(texte);
              setSaisie("");
            }
          }
        }}
        rows={3}
        placeholder="Pose ta question, colle ton raisonnement, demande un exercice…"
        className="w-full resize-y rounded-md border border-bordure-controle bg-surface px-3 py-2 text-sm placeholder:text-texte-discret"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.625rem] text-texte-discret">
          Ctrl+Entrée pour envoyer
          {usage && <> · {usage}</>}
        </span>
        <div className="flex gap-1.5">
          {onReinitialiser && !enCours && (
            <Bouton
              onClick={onReinitialiser}
              title="Efface les messages affichés. Tes observations et tes exercices ne sont pas touchés."
              variante="secondaire"
              taille="petite"
            >
              Réinitialiser
            </Bouton>
          )}
          <Bouton onClick={() => onCopier(saisie)} variante="secondaire" taille="petite">
            Copier le contexte
          </Bouton>
          {/* Pendant la rédaction, le bouton devient la seule action utile.
              « En cours… » désactivé n'offrait aucune sortie. */}
          {enCours ? (
            <Bouton onClick={onArreter} variante="secondaire" taille="petite">
              Arrêter
            </Bouton>
          ) : (
            <Bouton
              onClick={() => {
                const texte = saisie.trim();
                if (texte) {
                  onEnvoyer(texte);
                  setSaisie("");
                }
              }}
              disabled={!saisie.trim() || cleAbsente}
              variante="principal"
              taille="petite"
            >
              Envoyer
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
});
