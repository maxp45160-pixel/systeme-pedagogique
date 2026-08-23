"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconeChevronDroit, IconeDomaine } from "@/components/ui/icones";
import { cx } from "@/components/ui/primitives";

/**
 * Le sélecteur de domaine de la Progression.
 *
 * Il y avait ici un filtre qui restreignait la page (`?domaine=`) : la lecture
 * par domaine vit maintenant dans l'Atelier (vue domaine, mode « Progression »)
 * et le paramètre redirige vers elle. Ces puces sont donc devenues ce qu'elles
 * faisaient déjà de fait — un lanceur direct vers la surface unique, sans
 * détour par une redirection.
 */
export function FiltreDomaines({
  domaines,
}: {
  /** Domaines vivants du compte, dans leur ordre déclaré. */
  domaines: Array<{ id: string; nom: string }>;
}) {
  const router = useRouter();

  if (domaines.length === 0) return null;

  const cible = (domaineId: string) =>
    `/atelier?document=${encodeURIComponent(`domaine:${domaineId}`)}&vue=progression`;

  return (
    <>
      {/* Écran large : les puces. */}
      <nav
        aria-label="Voir la progression d'un domaine"
        className="hidden flex-wrap items-center gap-1.5 sm:flex"
      >
        <span className="text-xs text-texte-discret">Progression d&apos;un domaine :</span>
        {domaines.map((domaine) => (
          <Puce key={domaine.id} href={cible(domaine.id)}>
            {domaine.nom}
          </Puce>
        ))}
      </nav>

      {/* Mobile : une liste déroulante sous l'en-tête. */}
      <label className="flex items-center gap-2 text-xs text-texte-attenue sm:hidden">
        <IconeDomaine className="size-4 shrink-0 text-texte-discret" />
        <span className="sr-only">Voir la progression d&apos;un domaine</span>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) router.push(cible(event.target.value));
          }}
          className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-texte outline-none focus:border-primaire"
        >
          <option value="">Choisir un domaine…</option>
          {domaines.map((domaine) => (
            <option key={domaine.id} value={domaine.id}>
              {domaine.nom}
            </option>
          ))}
        </select>
        <IconeChevronDroit className="size-3 shrink-0 text-texte-discret" />
      </label>
    </>
  );
}

function Puce({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte",
      )}
    >
      {children}
    </Link>
  );
}
