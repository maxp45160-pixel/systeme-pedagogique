"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import { seDeconnecter } from "@/lib/supabase/actions";
import { exporterJournal } from "@/lib/store/export";
import { IconeValide } from "@/components/ui/icones";
import { appliquerTheme, lireChoixTheme, type ChoixTheme } from "./theme";

export interface EtatSession {
  /** Les clés Supabase sont présentes sur ce déploiement. */
  configure: boolean;
  connecte: boolean;
  courriel: string | null;
  nom: string | null;
  avatar: string | null;
}

/**
 * Pied du rail : identité du compte et accès aux réglages.
 *
 * L'état vient du serveur (`compteCourant()`) et non d'un `getUser()` côté
 * client : le rail est déjà rendu avec la bonne identité au premier affichage,
 * sans phase « chargement… » ni bascule visible.
 */
export function Compte({ session }: { session: EtatSession }) {
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  const nom = session.connecte
    ? (session.nom ?? session.courriel?.split("@")[0] ?? "Compte")
    : "Profil local";
  const sousTitre = session.connecte
    ? (session.courriel ?? "")
    : session.configure
      ? "Non connecté"
      : "Sans Supabase";

  return (
    <>
      <div className="border-t border-[var(--rail-bordure)] p-3 rail-reduit:p-2">
        <div className="rounded-xl border border-[var(--rail-bordure)] bg-[var(--rail-2)] px-2.5 py-2 rail-reduit:px-1 rail-reduit:py-2">
          <div className="flex items-center justify-between gap-2 rail-reduit:flex-col rail-reduit:gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar session={session} nom={nom} anneau="ring-[var(--rail-2)]" />

              <div className="min-w-0 rail-reduit:hidden">
                <div className="truncate text-xs font-medium text-[var(--rail-texte)]">
                  {nom}
                </div>
                <div className="truncate text-[0.625rem] text-[var(--rail-texte-discret)]">
                  {sousTitre}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setReglagesOuverts(true)}
                title="Compte et synchronisation"
                aria-label="Compte et synchronisation"
                className="rounded-md p-1.5 text-[var(--rail-texte-attenue)] transition-colors hover:bg-white/10 hover:text-[var(--rail-texte)]"
              >
                <IconeEngrenage className="size-4" />
              </button>

              {!session.connecte && session.configure && (
                <Link
                  href="/login"
                  className="rounded-md bg-[var(--rail-actif)] px-2 py-1 text-[0.6875rem] font-medium text-[var(--rail-actif-texte)] transition-opacity hover:opacity-90 rail-reduit:hidden"
                >
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {reglagesOuverts && (
        <PanneauReglages session={session} onFermer={() => setReglagesOuverts(false)} />
      )}
    </>
  );
}

/**
 * Accès au compte depuis la barre supérieure mobile.
 *
 * Le pied du rail est `hidden lg:flex` : en dessous de `lg`, les réglages — donc
 * le compte, l'export du journal, la déconnexion et le choix du thème —
 * n'étaient atteignables par aucun chemin. Ce bouton ouvre exactement le même
 * panneau, sans le dupliquer.
 *
 * Il remplace la bascule de thème qui occupait cette place : l'apparence est
 * désormais un réglage parmi d'autres, au même endroit sur mobile et sur poste
 * fixe.
 */
export function CompteMobile({ session }: { session: EtatSession }) {
  const [reglagesOuverts, setReglagesOuverts] = useState(false);

  const nom = session.connecte
    ? (session.nom ?? session.courriel?.split("@")[0] ?? "Compte")
    : "Profil local";

  return (
    <>
      <button
        type="button"
        onClick={() => setReglagesOuverts(true)}
        aria-label="Compte et réglages"
        title="Compte et réglages"
        className="flex shrink-0 items-center gap-1.5 rounded-md p-1 text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
      >
        <Avatar session={session} nom={nom} anneau="ring-surface" taille="petite" />
        <IconeEngrenage className="size-4" />
      </button>

      {reglagesOuverts && (
        <PanneauReglages session={session} onFermer={() => setReglagesOuverts(false)} />
      )}
    </>
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
          session.connecte ? "bg-[var(--niveau-4)]" : "bg-[#d99a3f]",
        )}
      />
    </div>
  );
}

function PanneauReglages({
  session,
  onFermer,
}: {
  session: EtatSession;
  onFermer: () => void;
}) {
  const [exportEnCours, setExportEnCours] = useState(false);
  const [messageExport, setMessageExport] = useState<string | null>(null);

  async function telechargerArchive() {
    setExportEnCours(true);
    setMessageExport(null);
    try {
      const archive = await exporterJournal();
      const total = Object.values(archive.effectifs).reduce((s, n) => s + n, 0);

      const lien = document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }),
      );
      lien.href = url;
      lien.download = `journal-${archive.exporteLe.slice(0, 10)}.json`;
      lien.click();
      URL.revokeObjectURL(url);

      setMessageExport(`Archive téléchargée — ${total} enregistrement(s).`);
    } catch (erreur) {
      setMessageExport(
        erreur instanceof Error ? erreur.message : "Échec de l'export.",
      );
    } finally {
      setExportEnCours(false);
    }
  }

  const panneau = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Compte et synchronisation"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-md rounded-xl border border-bordure bg-surface p-5 text-texte shadow-[var(--ombre-surcouche)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-bordure pb-3">
          <div>
            <h2 className="font-serif text-base font-medium">Compte et synchronisation</h2>
            <p className="mt-0.5 text-xs text-texte-discret">
              Où sont stockées vos données de suivi.
            </p>
          </div>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-md px-2 py-1 text-sm text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte"
          >
            ✕
          </button>
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          {/*
            Le profil déclaré (formation, objectifs, préférences) a sa propre
            page : ce sont des phrases, pas des interrupteurs. Le lien vit ici
            parce que c'est là qu'on vient chercher « mes réglages ».
          */}
          <div className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Profil
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-3">
              <Link
                href="/profil"
                onClick={onFermer}
                className="text-xs text-primaire hover:underline"
              >
                Formation, objectifs et préférences
              </Link>
              <Link
                href="/competences/referentiel"
                onClick={onFermer}
                className="text-xs text-primaire hover:underline"
              >
                Référentiel
              </Link>
            </dd>
          </div>

          <div className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Apparence
            </dt>
            <dd className="mt-1.5">
              <ChoixApparence />
            </dd>
          </div>

          <div className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              État
            </dt>
            <dd className="mt-1 flex items-center gap-2">
              <span
                aria-hidden
                className={cx(
                  "size-2 shrink-0 rounded-full",
                  session.connecte ? "bg-succes" : "bg-alerte",
                )}
              />
              <span className="text-texte-attenue">
                {session.connecte
                  ? `Connecté — données synchronisées sur votre compte (${session.courriel}).`
                  : session.configure
                    ? "Non connecté — aucune donnée n'est accessible tant que la session n'est pas ouverte."
                    : "Supabase non configuré — l'application ne peut ni lire ni écrire."}
              </span>
            </dd>
          </div>

          <div className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
              Sauvegarde
            </dt>
            <dd className="mt-1 space-y-2 text-texte-attenue">
              <p className="text-xs leading-relaxed">
                Télécharge l&apos;intégralité de ton journal en JSON — preuves, séances,
                erreurs, projets, profil. C&apos;est ta copie hors ligne : elle ne dépend
                ni de l&apos;hébergeur ni du dépôt git.
              </p>
              <button
                type="button"
                onClick={telechargerArchive}
                disabled={exportEnCours}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-bordure-forte bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
              >
                {exportEnCours ? "Export en cours…" : "Exporter mon journal"}
              </button>
              {messageExport && (
                <p className="flex items-start gap-1.5 text-xs text-texte">
                  <IconeValide className="mt-0.5 size-3.5 shrink-0 text-succes" />
                  <span>{messageExport}</span>
                </p>
              )}
            </dd>
          </div>

          {!session.configure && (
            <div className="rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5">
              <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
                Activer les comptes
              </dt>
              <dd className="mt-1 text-xs leading-relaxed text-texte-attenue">
                Supabase est désormais la seule dorsale : sans ces clés, aucune donnée
                n&apos;est lisible. Renseignez{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> dans{" "}
                <code className="font-mono">app/.env.local</code> (ou les variables
                d&apos;environnement Vercel), puis redémarrez le serveur.
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-bordure pt-3">
          {session.connecte ? (
            <form action={seDeconnecter}>
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md border border-transparent px-3 text-xs font-medium text-danger transition-colors hover:bg-danger-faible"
              >
                Se déconnecter
              </button>
            </form>
          ) : session.configure ? (
            <Link
              href="/login"
              className="inline-flex h-8 items-center rounded-md bg-primaire px-3 text-xs font-medium text-primaire-contraste transition-colors hover:bg-primaire-fort"
            >
              Se connecter
            </Link>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={onFermer}
            className="inline-flex h-8 items-center rounded-md border border-bordure-forte bg-surface px-3 text-xs font-medium transition-colors hover:bg-surface-2"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );

  // Portail vers `body` : le rail est en `position: sticky`, ce qui crée
  // toujours un contexte d'empilement. Rendue à l'intérieur, la modale voit son
  // `z-50` confiné au rail et passe *sous* le contenu principal, qui vient plus
  // loin dans le DOM. Aucune valeur de z-index ne corrige ça — il faut sortir
  // du contexte.
  return typeof document === "undefined"
    ? null
    : createPortal(panneau, document.body);
}

const APPARENCES: { cle: ChoixTheme; libelle: string }[] = [
  { cle: "clair", libelle: "Clair" },
  { cle: "dark", libelle: "Sombre" },
  { cle: null, libelle: "Système" },
];

/**
 * Choix du thème — clair, sombre, ou suivre le système.
 *
 * Lecture du stockage à l'initialisation, pas dans un effet : la modale n'est
 * montée qu'au clic, donc jamais rendue côté serveur, et il n'y a ni écart
 * d'hydratation ni rendu en cascade à craindre. `lireChoixTheme` retombe de
 * toute façon sur `null` si le stockage est indisponible.
 */
function ChoixApparence() {
  const [choix, setChoix] = useState<ChoixTheme>(lireChoixTheme);

  function choisir(c: ChoixTheme) {
    appliquerTheme(c);
    setChoix(c);
  }

  return (
    <div className="flex flex-wrap rounded-md border border-bordure p-0.5">
      {APPARENCES.map((a) => (
        <button
          key={a.libelle}
          type="button"
          onClick={() => choisir(a.cle)}
          aria-pressed={choix === a.cle}
          className={cx(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            choix === a.cle
              ? "bg-primaire-faible text-primaire"
              : "text-texte-attenue hover:text-texte",
          )}
        >
          {a.libelle}
        </button>
      ))}
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
