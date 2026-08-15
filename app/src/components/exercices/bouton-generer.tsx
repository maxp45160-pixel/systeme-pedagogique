/**
 * Entrée « Générer » — ouvre désormais le compositeur de séance.
 *
 * La génération n'est plus un geste unitaire isolé : elle se fait depuis une
 * séance, avec une durée, un nombre d'exercices et une composition visibles.
 * Le composant garde son nom et ses props pour ne pas multiplier les migrations
 * d'appelants, mais ne monte plus l'ancienne modale de génération.
 *
 * Les codes multiples sont conservés dans l'URL : le compositeur de séance
 * peut ainsi traiter les manquants en lot, au lieu de recréer une génération
 * par compétence.
 */

import Link from "next/link";
import { classesLienBouton, cx } from "@/components/ui/primitives";
import { EXERCICES_PAR_LOT_MAX } from "@/lib/domain/exercice";
import type { CalibrageModale, CompetenceModale } from "./proprietes-generation";

export function BoutonGenerer({
  competences,
  competenceInitiale,
  themeInitial,
  calibrages,
  compteId,
  libelle = "Générer un exercice",
  variante = "principal",
  className,
  pleineLargeur = false,
  surEnregistre,
  competencesCibles,
  ouvrirDansCahierApresAcceptation = false,
}: {
  competences: CompetenceModale[];
  competenceInitiale: string;
  /** Thème pré-rempli — voir `ModaleExercice`. */
  themeInitial?: string;
  /** Calibrages de toutes les compétences actives, indexés par code. */
  calibrages: Record<string, CalibrageModale>;
  compteId: string;
  libelle?: string;
  variante?: "principal" | "secondaire";
  className?: string;
  pleineLargeur?: boolean;
  surEnregistre?: (id: string) => void;
  /** Génération groupée — voir `ModaleExercice`. */
  competencesCibles?: string[];
  /** Réservé à la prochaine action : accepter ouvre une séance focus. */
  ouvrirDansCahierApresAcceptation?: boolean;
}) {
  const codes = [
    ...(competencesCibles && competencesCibles.length > 0
      ? competencesCibles
      : [competenceInitiale]),
  ]
    .filter((code): code is string => Boolean(code))
    .filter((code, index, liste) => liste.indexOf(code) === index)
    .slice(0, EXERCICES_PAR_LOT_MAX);
  const parametres = new URLSearchParams({ composer: "1" });
  codes.forEach((code) => parametres.append("code", code));
  if (themeInitial?.trim()) parametres.set("intention", themeInitial.trim());

  return (
    <Link
      href={`/seances?${parametres.toString()}`}
      className={cx(classesLienBouton(variante), pleineLargeur && "w-full", className)}
    >
      {libelle}
    </Link>
  );
}
