"use client";

/**
 * Clore une tentative sans en rien conclure.
 *
 * C'est la sortie de la règle de la réponse écrite : le bilan ne s'ouvre plus
 * sans réponse rédigée, donc une tentative qu'on ne veut pas mener doit avoir
 * un chemin propre. Sans lui, elle resterait `en-cours` indéfiniment et
 * l'exercice s'afficherait « en cours » pour toujours.
 *
 * Confirmation en deux temps, sur le modèle de `gestion-domaine.tsx` (ADR-027) :
 * **le geste s'annonce avant le clic**, jamais après. Ce qui est annoncé ici
 * n'est pas ce qui sera écrit mais ce qui ne le sera PAS — et c'est la partie
 * qu'il faut dire, parce qu'un silence laisserait croire à une mesure
 * enregistrée.
 *
 * Aucune décision ne vit dans ce fichier : il n'y a ni boucle, ni seuil, ni
 * dérivation (ADR-039). Le serveur décide, le composant annonce.
 */

import { useState, useTransition } from "react";
import { abandonnerExercice } from "@/lib/store/actions";
import { Bouton } from "@/components/ui/primitives";

export function BoutonAbandon({
  attemptId,
  exerciceId,
  dureeMin,
  codes,
}: {
  attemptId: string;
  exerciceId: string;
  /** Minutes écoulées depuis le début — le journal enregistre un fait, pas un zéro. */
  dureeMin: number;
  /** Compétences visées, citées dans l'annonce : c'est d'elles qu'il s'agit. */
  codes: string[];
}) {
  const [confirme, setConfirme] = useState(false);
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  function abandonner() {
    setErreur(null);
    demarrer(async () => {
      try {
        await abandonnerExercice(attemptId, exerciceId, dureeMin);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Impossible de clore la tentative.");
      }
    });
  }

  if (!confirme) {
    return (
      <Bouton onClick={() => setConfirme(true)} disabled={enCours} variante="secondaire" taille="petite">
        Abandonner cette tentative
      </Bouton>
    );
  }

  return (
    <div className="space-y-2">
      {/* L'annonce du geste, avant qu'il ne se produise (ADR-027). */}
      <p className="rounded-md border border-info/30 bg-info-faible px-3 py-2 text-xs text-texte-attenue">
        <span className="font-medium text-texte">Aucune preuve ne sera écrite.</span> Un
        abandon n{"'"}est pas un échec : un échec est une mesure, il suppose qu{"'"}on ait
        essayé. Ton niveau sur {codes.join(", ")} restera inchangé.
        <br />
        La tentative passe en abandonnée et reste au journal — elle explique pourquoi
        aucune difficulté n{"'"}est conseillée pour le prochain exercice.
      </p>

      {erreur && (
        <p className="rounded-md border border-danger/30 bg-danger-faible px-3 py-2 text-xs text-danger">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Bouton onClick={abandonner} disabled={enCours} variante="secondaire" taille="petite">
          {enCours ? "Clôture…" : "Confirmer l'abandon"}
        </Bouton>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          disabled={enCours}
          className="text-[0.6875rem] text-texte-attenue hover:text-texte"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
