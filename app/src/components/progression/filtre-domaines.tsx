"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconeChevronDroit, IconeDomaine } from "@/components/ui/icones";
import { cx } from "@/components/ui/primitives";

/**
 * Le filtre de lecture par domaine de la Progression.
 *
 * Deux rendus du même geste — restreindre la page à un domaine — sans
 * mécanique nouvelle : des puces sur écran large, une liste déroulante sous
 * l'en-tête sur mobile. La sélection vit dans l'URL (`?domaine=`) : un filtre
 * partageable, retombant au tout venant si l'identifiant ne désigne plus rien.
 */
export function FiltreDomaines({
  domaines,
  actif,
}: {
  /** Domaines vivants du compte, dans leur ordre déclaré. */
  domaines: Array<{ id: string; nom: string }>;
  /** Identifiant du domaine filtré, `null` pour la lecture globale. */
  actif: string | null;
}) {
  const router = useRouter();

  if (domaines.length === 0) return null;

  return (
    <>
      {/* Écran large : les puces. */}
      <nav
        aria-label="Filtrer la progression par domaine"
        className="hidden flex-wrap items-center gap-1.5 sm:flex"
      >
        <span className="text-xs text-texte-discret">Domaine :</span>
        <Puce href="/progression" active={actif === null}>
          Tous
        </Puce>
        {domaines.map((domaine) => (
          <Puce
            key={domaine.id}
            href={`/progression?domaine=${encodeURIComponent(domaine.id)}`}
            active={actif === domaine.id}
          >
            {domaine.nom}
          </Puce>
        ))}
      </nav>

      {/* Mobile : une liste déroulante sous l'en-tête. */}
      <label className="flex items-center gap-2 text-xs text-texte-attenue sm:hidden">
        <IconeDomaine className="size-4 shrink-0 text-texte-discret" />
        <span className="sr-only">Filtrer la progression par domaine</span>
        <select
          value={actif ?? ""}
          onChange={(event) =>
            router.push(
              event.target.value
                ? `/progression?domaine=${encodeURIComponent(event.target.value)}`
                : "/progression",
            )
          }
          className="min-w-0 flex-1 rounded-lg border border-bordure bg-surface px-2.5 py-1.5 text-xs font-medium text-texte outline-none focus:border-primaire"
        >
          <option value="">Tous les domaines</option>
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
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primaire bg-primaire-faible text-primaire"
          : "border-bordure bg-surface text-texte-attenue hover:border-primaire/40 hover:text-texte",
      )}
    >
      {children}
    </Link>
  );
}
