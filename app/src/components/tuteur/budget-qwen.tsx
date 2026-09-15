"use client";
import { useEffect, useState } from "react";
import { Bouton } from "@/components/ui/primitives";

export function BudgetQwen() {
  const [message, setMessage] = useState("Lecture du budget…");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controle = new AbortController();
    void fetch("/api/qwen/budget", { signal: controle.signal }).then(async (r) => {
      if (!r.ok) throw new Error("Budget indisponible sur ce compte.");
      const b = await r.json();
      if (!Number.isSafeInteger(b.restant)) throw new Error("Budget invalide.");
      if (!controle.signal.aborted) setMessage(`${(b.restant / 1000000).toFixed(2)} $ disponibles sur les 5 $ d’essai.`);
    }).catch(() => { if (!controle.signal.aborted) setMessage("Le budget Qwen n’a pas pu être lu. Les appels restent bloqués si sa réservation échoue."); });
    return () => controle.abort();
  }, [revision]);
  return <div className="space-y-2 text-xs text-texte-attenue">
    <p role="status">{message}</p>
    <p>Chat et documents partagent cette enveloppe cumulée, sans renouvellement automatique. Les réservations sont majorées et restent comptées même en cas d’échec : ce compteur n’est pas la facture Alibaba. Montants hors taxes ; appels effectués ailleurs exclus.</p>
    <Bouton taille="petite" variante="discret" onClick={() => setRevision((r) => r + 1)}>Actualiser le budget</Bouton>
  </div>;
}
