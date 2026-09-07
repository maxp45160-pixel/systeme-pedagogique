"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bouton } from "@/components/ui/primitives";
import { supprimerDepotAction } from "@/lib/store/depot-actions";

export function SupprimerDepot({ id, titre }: { id: string; titre: string }) {
  const router = useRouter();
  const verrou = useRef(false);
  const [confirmation, setConfirmation] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState("");
  async function supprimer() {
    if (verrou.current) return;
    verrou.current = true; setOccupe(true); setErreur("");
    try {
      await supprimerDepotAction(id);
      router.replace("/app"); router.refresh();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le dépôt n’a pas pu être supprimé.");
    } finally { verrou.current = false; setOccupe(false); }
  }
  if (!confirmation) return <Bouton variante="discret" taille="petite" onClick={() => setConfirmation(true)} aria-label={`Supprimer ${titre}`}>Supprimer</Bouton>;
  return <div className="my-2 rounded-xl border border-bordure bg-surface p-4 text-sm">
    <p className="font-medium">Supprimer « {titre} » ?</p>
    <p className="mt-2 text-texte-attenue">La note, les fichiers et les retours seront supprimés définitivement. Vos séances et leur écriture restent conservées, mais leurs liens vers ces fichiers ne fonctionneront plus.</p>
    <div className="mt-3 flex gap-2"><Bouton variante="danger" taille="petite" disabled={occupe} onClick={() => void supprimer()}>{occupe ? "Suppression…" : "Supprimer ce dépôt"}</Bouton><Bouton variante="discret" taille="petite" disabled={occupe} onClick={() => setConfirmation(false)}>Annuler</Bouton></div>
    {erreur && <p role="alert" className="mt-2">{erreur}</p>}
  </div>;
}
