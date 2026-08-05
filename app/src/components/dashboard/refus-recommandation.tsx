"use client";

/**
 * Bouton « Passer cette suggestion » (Chantier 7).
 *
 * Permet de refuser la prochaine action recommandée. Le refus est stocké
 * en localStorage par compte (cleParCompte), avec une expiration de 7 jours.
 * Au prochain chargement, la recommandation refusée est écartée et la
 * suivante prend sa place.
 *
 * Le refus est un fait observé : il ne modifie pas le moteur, il filtre
 * la liste des recommandations côté client. Le moteur reste pur et testé.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { classesBouton } from "@/components/ui/primitives";
import { cleParCompte, ecrireSession, lireSession } from "@/lib/ui/stockage-session";

/** Durée pendant laquelle une compétence refusée est écartée (en jours). */
const EXPIRATION_JOURS = 7;

interface RefusStocke {
  code: string;
  date: string;
}

export function BoutonRefusRecommandation({
  code,
  compteId,
}: {
  code: string;
  compteId: string;
}) {
  const router = useRouter();
  const [refuse, setRefuse] = useState(false);

  function refuser() {
    const cle = cleParCompte("refus-recommandations", compteId);
    const existants = lireSession<RefusStocke[]>(cle) ?? [];
    // Ajoute le refus, sans doublon.
    const misAJour = [
      { code, date: new Date().toISOString() },
      ...existants.filter((r) => r.code !== code),
    ].slice(0, 20); // Plafonné : ne pas faire grossir indéfiniment.
    ecrireSession(cle, misAJour);
    setRefuse(true);
    router.refresh();
  }

  if (refuse) {
    return (
      <span className="text-xs text-texte-discret">
        Suggestion passée — la suivante prend sa place.
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={refuser}
      className={classesBouton("secondaire", "petite")}
      title="Écarte cette suggestion pendant 7 jours"
    >
      Passer
    </button>
  );
}

/**
 * Lit les codes de compétences refusées (non expirés) depuis le localStorage.
 *
 * Côté serveur, cette fonction ne peut pas lire le localStorage — elle
 * renvoie un ensemble vide. Le filtrage se fait donc côté client, au rendu
 * de la carte. Pour un filtrage serveur, il faudrait stocker les refus en
 * base (table dédiée) — c'est une évolution possible.
 */
export function codesRefuses(compteId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  const cle = cleParCompte("refus-recommandations", compteId);
  const refus = lireSession<RefusStocke[]>(cle) ?? [];
  const maintenant = Date.now();
  const expirationMs = EXPIRATION_JOURS * 24 * 60 * 60 * 1000;
  return new Set(
    refus
      .filter((r) => maintenant - new Date(r.date).getTime() < expirationMs)
      .map((r) => r.code),
  );
}