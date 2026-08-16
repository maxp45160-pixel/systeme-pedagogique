"use client";

import Link from "next/link";
import { cx } from "@/components/ui/primitives";

export interface EtatSession {
  courriel: string | null;
  nom: string | null;
  avatar: string | null;
  /** Identifiant du compte — isole la clé API saisie côté client. */
  compteId: string;
}

/**
 * Pied du rail : identité du compte et accès aux réglages.
 *
 * L'état vient du serveur (`compteCourant()`) et non d'un `getUser()` côté
 * client : le rail est déjà rendu avec la bonne identité au premier affichage,
 * sans phase « chargement… » ni bascule visible.
 *
 * Ce pied ouvrait une modale à trois onglets, qui en ouvrait deux autres. Il
 * mène maintenant à `/compte` — une page, donc une adresse, un bouton retour et
 * un onglet de navigateur qui fonctionnent.
 */
export function Compte({ session }: { session: EtatSession }) {
  const nom = session.nom ?? session.courriel?.split("@")[0] ?? "Compte";
  const sousTitre = session.courriel ?? "";

  return (
    <div className="border-t border-[var(--rail-bordure)] p-3 rail-reduit:p-2">
      <Link
        href="/compte"
        title="Compte et réglages"
        aria-label="Compte et réglages"
        className="flex items-center justify-between gap-2 rounded-xl border border-[var(--rail-bordure)] bg-[var(--rail-2)] px-2.5 py-2 transition-colors hover:bg-white/5 rail-reduit:flex-col rail-reduit:gap-2 rail-reduit:px-1 rail-reduit:py-2"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar session={session} nom={nom} anneau="ring-[var(--rail-2)]" />

          <span className="min-w-0 rail-reduit:hidden">
            <span className="block truncate text-xs font-medium text-[var(--rail-texte)]">
              {nom}
            </span>
            <span className="block truncate text-[0.625rem] text-[var(--rail-texte-discret)]">
              {sousTitre}
            </span>
          </span>
        </span>

        <IconeEngrenage className="size-4 shrink-0 text-[var(--rail-texte-attenue)]" />
      </Link>
    </div>
  );
}

/**
 * Accès au compte depuis la barre supérieure mobile.
 *
 * Le pied du rail est `hidden lg:flex` : en dessous de `lg`, les réglages — donc
 * le compte, l'export du journal, la déconnexion et le choix du thème —
 * n'étaient atteignables par aucun chemin. Ce lien mène à la même page que le
 * pied du rail, sans la dupliquer.
 */
export function CompteMobile({ session }: { session: EtatSession }) {
  const nom = session.nom ?? session.courriel?.split("@")[0] ?? "Compte";

  return (
    <Link
      href="/compte"
      aria-label="Compte et réglages"
      title="Compte et réglages"
      className="flex shrink-0 items-center gap-1.5 rounded-md p-1 text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
    >
      <Avatar session={session} nom={nom} anneau="ring-surface" taille="petite" />
      <IconeEngrenage className="size-4" />
    </Link>
  );
}

/**
 * Avatar et pastille d'état de session.
 *
 * `anneau` est une classe utilitaire complète, et non une couleur injectée : le
 * liseré derrière la pastille doit reprendre le fond de l'endroit où l'avatar
 * est posé (carte du rail ou barre mobile), et Tailwind ne génère que les
 * classes qu'il lit littéralement dans les sources.
 */
function Avatar({
  session,
  nom,
  anneau,
  taille = "normale",
}: {
  session: EtatSession;
  nom: string;
  anneau: "ring-[var(--rail-2)]" | "ring-surface";
  taille?: "normale" | "petite";
}) {
  const cote = taille === "petite" ? "size-7" : "size-8";
  return (
    <div className="relative shrink-0">
      {session.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.avatar}
          alt=""
          className={cx(cote, "rounded-full object-cover ring-1 ring-[var(--rail-bordure)]")}
        />
      ) : (
        <span
          className={cx(
            cote,
            "flex items-center justify-center rounded-full bg-[var(--rail-actif)] text-xs font-semibold text-[var(--rail-actif-texte)]",
          )}
        >
          {nom.charAt(0).toUpperCase()}
        </span>
      )}
      <span
        aria-hidden
        className={cx(
          "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2",
          anneau,
          "bg-[var(--niveau-4)]",
        )}
      />
    </div>
  );
}

/** Engrenage — même tracé que le reste du jeu d'icônes (grille 24, trait 1,5). */
function IconeEngrenage({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-[18px]"}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}
