"use client";

import { useFormStatus } from "react-dom";
import { Bouton } from "@/components/ui/primitives";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Bouton de soumission d'une Server Function, avec état d'attente.
 *
 * `useFormStatus` ne lit que le `<form>` le plus proche dans l'arbre — ce
 * composant doit être un ENFANT du formulaire, jamais le formulaire
 * lui-même : un `<form action={...}>` dans une page serveur ne peut pas
 * appeler ce hook directement sans devenir lui-même client, ce qui
 * transformerait toute la page. Un enfant mince suffit.
 *
 * Trois boutons de `exercices/[id]/page.tsx` déclenchaient une écriture
 * serveur sans aucun état d'attente — `disabled` jamais posé, libellé jamais
 * changé — et étaient donc double-soumettables par un double-clic. Ce
 * composant existe pour que ça ne se reproduise pas ailleurs.
 */
export function BoutonSoumission({
  children,
  variante,
  taille,
  className,
  ...reste
}: {
  children: ReactNode;
  variante?: "principal" | "secondaire" | "discret" | "danger";
  taille?: "normale" | "compacte" | "petite";
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();
  return (
    <Bouton
      type="submit"
      enChargement={pending}
      variante={variante}
      taille={taille}
      className={className}
      {...reste}
    >
      {children}
    </Bouton>
  );
}
