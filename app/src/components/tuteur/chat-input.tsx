"use client";

/**
 * La zone de saisie du tuteur, isolée.
 *
 * `setSaisie` vit dans ce composant enfant : les frappes clavier ne
 * déclenchent plus le re-render du transcript ni des boucles d'extraction.
 * Le composant parent ne reçoit le texte qu'au submit.
 *
 * ## Ce qui a été retiré (friction du 25/08/2026)
 *
 * Les six amorces rapides et « Réinitialiser » ont quitté la barre : aucun
 * n'était un accès unique à une fonction obligatoire (effacer les messages se
 * fait en fermant le tiroir). Reste l'essentiel : la saisie, Envoyer,
 * Arrêter — et la palette de formules, qui sert la saisie.
 *
 * « Copier le contexte », elle, reste disponible dans son unique rôle
 * légitime : le **secours sans clé** (`copieSecours`) — quand aucun moteur
 * n'est configuré, c'est le seul chemin qui permet quand même d'obtenir une
 * réponse. Hors panne, elle n'encombre plus la barre.
 */

import { memo, useEffect, useRef, useState } from "react";
import { EditeurDirect } from "@/components/atelier/editeur-document";
import { Bouton } from "@/components/ui/primitives";
import { PaletteFormules } from "@/components/ui/palette-formules";
import { insererFormuleDansEditeur } from "@/lib/documents/insertion-formule-editeur";

export const ChatInput = memo(function ChatInput({
  onEnvoyer,
  onArreter,
  onCopier,
  copieSecours = false,
  enCours,
  cleAbsente,
  usage,
  saisieInitiale,
}: {
  onEnvoyer: (texte: string) => void;
  /** Présent seulement en secours sans clé (`copieSecours`). */
  onCopier?: (texte: string) => void;
  /** Vrai quand aucun moteur n'est configuré : la copie de secours s'affiche. */
  copieSecours?: boolean;
  onArreter: () => void;
  enCours: boolean;
  cleAbsente: boolean;
  usage: string | null;
  saisieInitiale: string;
}) {
  const [saisie, setSaisie] = useState(saisieInitiale);
  const [saisieInitialePrecedente, setSaisieInitialePrecedente] = useState(saisieInitiale);
  const champRef = useRef<HTMLDivElement>(null);

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
      {/*
        On pose des questions de mathématiques au tuteur : la palette doit être
        là, sinon il faut taper le LaTeX de mémoire.
      */}
      <div className="mb-2 flex justify-end">
        <PaletteFormules
          onInserer={(latex, recul) => insererFormuleDansEditeur(champRef.current, latex, recul)}
          desactivee={enCours}
        />
      </div>

      {/*
        Point d'entrée du focus quand le chat est monté dans une modale.

        `Modale` focalise le premier élément focalisable du panneau : ici la
        palette. L'attribut désigne le champ ; hors modale il est inerte.
      */}
      <EditeurDirect
        ref={champRef}
        documentId="tuteur-chat"
        contenuInitialMd={saisie}
        contenuCharge
        lectureSeule={enCours}
        onSynchroniser={setSaisie}
        onRaccourci={(e) => {
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
        ariaLabel="Message à envoyer au tuteur"
        placeholder="Posez votre question, collez votre raisonnement, demandez un exercice…"
        focusInitial
        hauteurPleine={false}
        recomposerFormulesSurSaisie
        className="min-h-24 max-h-60 resize-y overflow-y-auto rounded-md border border-bordure-controle bg-surface px-3 py-2 text-sm placeholder:text-texte-discret"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[0.625rem] text-texte-discret">
          Ctrl+Entrée pour envoyer
          {usage && <> · {usage}</>}
        </span>
        <div className="flex gap-1.5">
          {/* Secours sans clé uniquement — voir la docstring du composant. */}
          {copieSecours && onCopier && (
            <Bouton onClick={() => onCopier(saisie)} variante="secondaire" taille="petite">
              Copier le contexte
            </Bouton>
          )}
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
