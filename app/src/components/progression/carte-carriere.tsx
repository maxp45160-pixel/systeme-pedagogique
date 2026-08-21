import type { Carriere } from "@/lib/engine/carriere";
import type { EtatGlobal } from "@/lib/engine/progression";
import { qualificatifScore } from "@/lib/engine/evolution";
import type { User } from "@/lib/domain/types";
import type { IdentiteUtilisateur } from "@/lib/domain/identite";
import { profilDeclare } from "@/lib/domain/profil";
import { formatDateCourte } from "@/lib/engine/dates";
import { RepartitionNiveaux } from "@/components/charts";
import { cx, Etiquette, TagConfiance } from "@/components/ui/primitives";

/**
 * Le héros du profil : qui, depuis quand, et le grand nombre qui résume.
 *
 * ## La ligne que ce dessin ne franchit pas
 *
 * L'ampleur visuelle est gratuite ; la mécanique ne l'est pas. Ce que
 * l'écran montre reste borné à des faits comptés et à des lectures dérivées
 * d'eux : le score global existe déjà, la confiance aussi, et le
 * qualificatif (« En construction »…) est une relecture du score, pas une
 * seconde mesure. Aucun XP, aucun rang calculé sur les minutes, aucun titre
 * qui monterait en laissant l'application ouverte (ADR-017).
 */
export function CarteCarriere({
  user,
  identite,
  carriere,
  global,
  variation7j,
  repartition,
}: {
  user: User;
  identite?: IdentiteUtilisateur;
  carriere: Carriere;
  global: EtatGlobal;
  /** Variation du score sur 7 jours, déjà dérivée par `evolutionScore`. */
  variation7j?: number | null;
  /** Compétences par niveau (0-5) — la seule lecture analytique qui reste en bannière. */
  repartition?: Record<number, number>;
}) {
  const profil = profilDeclare(user);
  const nom = identite?.nom ?? (user.prenom.trim() || "Mon profil");
  const avatarUrl = identite?.avatarUrl ?? user.avatarUrl;
  const initiale = identite?.initiale ?? (nom.charAt(0).toUpperCase() || "P");

  const score = global.scoreGlobal;

  return (
    <section className="overflow-hidden rounded-carte border border-bordure bg-surface shadow-[var(--ombre-carte)]">
      {/* ── Bannière ─────────────────────────────────────────────── */}
      <div className="relative border-b border-bordure bg-gradient-to-br from-primaire-faible via-surface to-surface-2 px-5 py-6 sm:px-8">
        {/* Géométrie décorative — anneaux, même teinte que la marque, jamais porteuse d'information. */}
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-28 select-none">
          <div className="size-80 rounded-full border-[26px] border-primaire/5" />
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-8 bottom-[-4.5rem] select-none">
          <div className="size-44 rounded-full border-[18px] border-primaire/5" />
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            {avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrl}
                alt={nom}
                referrerPolicy="no-referrer"
                className="size-16 shrink-0 rounded-2xl border border-bordure object-cover shadow-[var(--ombre-levee)] sm:size-20"
              />
            ) : (
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primaire text-2xl font-semibold text-primaire-contraste shadow-[var(--ombre-levee)] sm:size-20 sm:text-3xl">
                {initiale}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-serif text-2xl font-medium tracking-tight sm:text-3xl">{nom}</h2>
              {/*
                La formation est affichée si elle est déclarée, et
                tus sinon — `profilDeclare` distingue déjà une valeur d'un libellé
                par défaut. Un profil vide ne doit pas se lire comme un profil
                rempli de tirets.
              */}
              <p className="mt-0.5 truncate text-xs text-texte-attenue sm:text-sm">
                {profil.formation || "Formation non déclarée"}
              </p>
              {carriere.debut !== null && carriere.joursDepuisDebut !== null && (
                <p className="mt-1.5 text-[0.6875rem] text-texte-discret">
                  Pratique depuis le {formatDateCourte(carriere.debut)} ·{" "}
                  {carriere.joursDepuisDebut} jour{carriere.joursDepuisDebut > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-5">
            <AnneauScore score={score} />
            <div className="flex flex-col items-start gap-2">
              <span
                className={cx(
                  "text-sm font-medium",
                  score === null ? "text-texte-discret" : "text-primaire",
                )}
              >
                {score === null ? "Pas encore de mesure" : qualificatifScore(score)}
              </span>
              <TagConfiance confiance={global.confiance} />
              {variation7j !== null && variation7j !== undefined && (
                <Etiquette ton={variation7j > 0 ? "succes" : variation7j < 0 ? "alerte" : "neutre"} mono>
                  {variation7j > 0 ? "+" : ""}
                  {variation7j} en 7 jours
                </Etiquette>
              )}
            </div>
          </div>
        </div>
      </div>

      {/*
        La répartition des niveaux, en pied de bannière : la seule lecture
        analytique qui reste ici, parce qu'elle est d'abord un dessin — une
        collection qui se remplit. `RepartitionNiveaux` répète chaque valeur
        écrite à côté de sa couleur ; il ne rend rien sans mesure. La bande est
        centrée : c'est un ornement du héros, pas un tableau.
      */}
      {repartition && Object.keys(repartition).length > 0 && (
        <div className="bg-surface-2/40 px-5 py-3 sm:px-8">
          <div className="mx-auto w-full max-w-3xl">
            <RepartitionNiveaux compte={repartition} />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * L'anneau du score — la conversion parlante du nombre /100.
 *
 * Un seul trait, une seule teinte (`--primaire`) : l'anneau dit la même chose
 * que le chiffre qu'il entoure, jamais autre chose. Sans mesure, il reste
 * vide plutôt que de feindre un départ à zéro (P2).
 */
function AnneauScore({ score }: { score: number | null }) {
  const rayon = 42;
  const circonference = 2 * Math.PI * rayon;
  const rempli = score === null ? 0 : (score / 100) * circonference;

  return (
    <svg
      viewBox="0 0 100 100"
      className="size-24 shrink-0 sm:size-28"
      role="img"
      aria-label={
        score === null
          ? "Score global : pas encore de mesure"
          : `Score global : ${score} sur 100`
      }
    >
      <circle cx="50" cy="50" r={rayon} fill="none" stroke="var(--bordure)" strokeWidth="7" opacity="0.6" />
      {rempli > 0 && (
        <circle
          cx="50"
          cy="50"
          r={rayon}
          fill="none"
          stroke="var(--primaire)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${rempli} ${circonference}`}
          transform="rotate(-90 50 50)"
        />
      )}
      <text
        x="50"
        y="49"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="26"
        fontWeight="600"
        fill={score === null ? "var(--texte-discret)" : "var(--texte)"}
        className="chiffres"
      >
        {score === null ? "—" : score}
      </text>
      <text x="50" y="70" textAnchor="middle" fontSize="9" fill="var(--texte-discret)">
        / 100
      </text>
    </svg>
  );
}
