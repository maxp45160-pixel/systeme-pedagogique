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
import { usePiecesConversation } from "./pieces-conversation";
import { autorisationDepot, eurosDocumentaires, type AutorisationAnalyseDepot } from "@/lib/documents/conversation-ressources";

export const ChatInput = memo(function ChatInput({
  onEnvoyer,
  onArreter,
  onCopier,
  copieSecours = false,
  enCours,
  cleAbsente,
  usage,
  saisieInitiale,
  onDepotConserve,
  onEtatDepot,
  depotBloque = false,
  focusSignal,
  fournisseurDocumentaire = "mistral",
}: {
  onEnvoyer: (texte: string) => void | boolean | Promise<void | boolean>;
  onDepotConserve?: (texte: string, recu: string, ressources: string[], autorisation?: AutorisationAnalyseDepot) => void;
  onEtatDepot?: (occupe: boolean) => void;
  fournisseurDocumentaire?: AutorisationAnalyseDepot["fournisseur"];
  depotBloque?: boolean;
  focusSignal?: string;
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
  const [organiserTexte, setOrganiserTexte] = useState(false);
  const [saisieInitialePrecedente, setSaisieInitialePrecedente] = useState(saisieInitiale);
  const champRef = useRef<HTMLDivElement>(null);
  const accordDepot = useRef<AutorisationAnalyseDepot | undefined>(undefined);
  const pieces = usePiecesConversation(onDepotConserve ? (texte,recu,ressources) => onDepotConserve(texte,recu,ressources,accordDepot.current) : undefined);
  const autorisation = autorisationDepot(fournisseurDocumentaire,pieces.fichiers.length,Boolean(saisie.trim()));
  const verrouEnvoi = useRef(false);
  const bloque = enCours || pieces.occupe;
  useEffect(() => { if (focusSignal) champRef.current?.focus(); }, [focusSignal]);
  async function soumettre() {
    if (bloque || verrouEnvoi.current) return;
    const texte = saisie.trim();
    const avecFichiers = Boolean(onDepotConserve && (pieces.fichiers.length || (organiserTexte && texte)));
    if (avecFichiers && depotBloque) return;
    if (!avecFichiers && (!texte || cleAbsente)) return;
    verrouEnvoi.current = true;
    if (avecFichiers) { accordDepot.current = autorisation; onEtatDepot?.(true); }
    try {
      const accepte = avecFichiers ? await pieces.envoyer(texte) : await onEnvoyer(texte);
      if (accepte !== false) { setSaisie(""); setOrganiserTexte(false); }
    } finally { verrouEnvoi.current = false; if (avecFichiers) onEtatDepot?.(false); }
  }

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
    <div className={`border-t border-bordure px-3 py-3 ${pieces.survol ? "ring-2 ring-inset ring-primaire" : ""}`}
      onDragOver={onDepotConserve ? (e) => { if (Array.from(e.dataTransfer.types).includes("Files")) { e.preventDefault(); if (!bloque && !depotBloque) pieces.setSurvol(true); } } : undefined}
      onDragLeave={() => pieces.setSurvol(false)}
      onDrop={onDepotConserve ? (e) => { if (bloque || depotBloque) { e.preventDefault(); return; } void pieces.deposer(e); } : undefined}>
      {/*
        On pose des questions de mathématiques au tuteur : la palette doit être
        là, sinon il faut taper le LaTeX de mémoire.
      */}
      <div className="mb-2 flex items-center justify-between">
        {onDepotConserve ? pieces.interfacePieces(bloque || depotBloque) : <span/>}
        {onDepotConserve && !pieces.fichiers.length && !depotBloque && <Bouton taille="petite" variante="discret" disabled={bloque} aria-pressed={organiserTexte} onClick={() => setOrganiserTexte((v) => !v)}>{organiserTexte ? "Revenir au message" : "Organiser ce texte"}</Bouton>}
        <PaletteFormules
          onInserer={(latex, recul) => insererFormuleDansEditeur(champRef.current, latex, recul)}
          desactivee={bloque}
        />
      </div>
      {onDepotConserve && pieces.liste}
      {onDepotConserve && pieces.fichiers.length > 0 && <p className="mb-3 text-xs leading-relaxed text-texte-attenue">Après lecture, Twiny peut rattacher chaque nouveau document à un domaine adapté, créé si nécessaire sans compétence obligatoire. Les cas à préciser et les compétences restent à votre choix ; le rangement effectué reste corrigeable.</p>}
      {onDepotConserve && (pieces.fichiers.length > 0 || organiserTexte) && <p className="mb-3 text-xs leading-relaxed text-texte-attenue">En préparant votre proposition, vous conservez votre texte et vos fichiers comme ressources. Leur lecture (jusqu’aux 20 premières pages par fichier, ou 20 sections textuelles par EPUB) est transmise à {fournisseurDocumentaire === "qwen" ? "Qwen (Alibaba Cloud)" : "Mistral"}. Les illustrations et formules non textuelles des EPUB restent à relire dans l’original. Coût maximal : {fournisseurDocumentaire === "qwen" ? (autorisation.coutMaximum/1_000_000).toLocaleString("fr-FR",{style:"currency",currency:"USD",maximumFractionDigits:3}) : eurosDocumentaires(autorisation.coutMaximum)}.</p>}

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
        lectureSeule={bloque}
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
            void soumettre();
          }
        }}
        ariaLabel="Message à envoyer au tuteur"
        placeholder={onDepotConserve ? "Écrivez votre message ou glissez vos cours, notes et exercices ici…" : "Posez votre question, collez votre raisonnement, demandez un exercice…"}
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
          {pieces.occupe ? <Bouton disabled taille="petite">Préparation de vos documents…</Bouton> : enCours ? (
            <Bouton onClick={onArreter} variante="secondaire" taille="petite">
              Arrêter
            </Bouton>
          ) : (
            <Bouton
              onClick={() => void soumettre()}
              disabled={pieces.fichiers.length || organiserTexte ? depotBloque || (!pieces.fichiers.length && !saisie.trim()) : !saisie.trim() || cleAbsente}
              variante="principal"
              taille="petite"
            >
              {pieces.fichiers.length || organiserTexte ? "Préparer ma proposition" : "Envoyer"}
            </Bouton>
          )}
        </div>
      </div>
    </div>
  );
});
