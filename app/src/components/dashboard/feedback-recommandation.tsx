"use client";

/**
 * Feedback sur la recommandation (Chantier 11).
 *
 * Permet de noter la pertinence d'une recommandation (👍/👎) avec une
 * justification facultative. Le feedback est stocké en localStorage par
 * compte (cleParCompte), pour mesurer un comportement utilisateur et
 * apprendre — sans modifier le moteur de recommandation, qui reste pur.
 *
 * Le feedback est un fait observé : il ne change pas le score de la
 * recommandation, il est conservé pour analyse future.
 */

import { useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { cleParCompte, ecrireSession, lireSession } from "@/lib/ui/stockage-session";

interface FeedbackStocke {
  code: string;
  note: "pertinent" | "non-pertinent";
  justification: string;
  date: string;
}

export function FeedbackRecommandation({
  code,
  compteId,
}: {
  code: string;
  compteId: string;
}) {
  // Relu au montage : un feedback déjà donné doit rester « donné » quand on
  // revient sur la page (Chantier 11, retour utilisateur R2).
  const cle = cleParCompte("feedback-recommandations", compteId);
  const [donne, setDonne] = useState(
    () => (lireSession<FeedbackStocke[]>(cle) ?? []).some((f) => f.code === code),
  );
  const [note, setNote] = useState<"pertinent" | "non-pertinent" | null>(null);
  const [justification, setJustification] = useState("");
  const [afficherJustification, setAfficherJustification] = useState(false);

  function enregistrer(valeur: "pertinent" | "non-pertinent") {
    setNote(valeur);
    setAfficherJustification(true);
  }

  function valider() {
    const existants = lireSession<FeedbackStocke[]>(cle) ?? [];
    const misAJour = [
      {
        code,
        note: note!,
        justification: justification.trim(),
        date: new Date().toISOString(),
      },
      ...existants.filter((f) => f.code !== code),
    ].slice(0, 50);
    ecrireSession(cle, misAJour);
    setDonne(true);
  }

  if (donne) {
    return (
      <span className="text-xs text-texte-discret">
        Merci — ton feedback est enregistré.
      </span>
    );
  }

  if (afficherJustification) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-texte-attenue">
          {note === "pertinent" ? "👍 Pertinent" : "👎 Non pertinent"} — pourquoi ?
        </span>
        <input
          type="text"
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          placeholder="Justification (facultatif)…"
          className="min-w-0 flex-1 rounded-md border border-bordure bg-surface px-2 py-1 text-xs placeholder:text-texte-discret focus:border-primaire focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              valider();
            }
          }}
        />
        <Bouton onClick={valider} variante="secondaire" taille="petite">
          Valider
        </Bouton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-texte-discret">Cette suggestion était-elle pertinente ?</span>
      <button
        type="button"
        onClick={() => enregistrer("pertinent")}
        className="rounded-md border border-bordure px-2 py-0.5 text-xs transition-colors hover:bg-surface-2"
        title="Pertinent"
      >
        👍
      </button>
      <button
        type="button"
        onClick={() => enregistrer("non-pertinent")}
        className="rounded-md border border-bordure px-2 py-0.5 text-xs transition-colors hover:bg-surface-2"
        title="Non pertinent"
      >
        👎
      </button>
    </div>
  );
}