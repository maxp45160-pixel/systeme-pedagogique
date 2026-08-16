import Link from "next/link";
import { Bouton, Carte, EnTeteCarte } from "@/components/ui/primitives";
import { LIGNE_MARGE_MAX, type LigneMarge } from "@/lib/documents/marge";
import {
  basculerLigneMargeAction,
  noterDansLaMarge,
  retirerLigneMargeAction,
} from "@/lib/store/marge-actions";

/**
 * La marge du cahier : écrire une phrase, en faire une séance.
 *
 * Elle occupe la tête du hub parce que c'est le geste qu'on vient faire le plus
 * souvent — noter ce sur quoi on bute — et parce qu'un cahier s'ouvre là où l'on
 * écrit, pas sur son historique.
 *
 * ⚠️ **Rien de ce qui est écrit ici n'entre dans le moteur.** Une ligne de marge
 * n'est ni une preuve, ni une mesure, ni un niveau : c'est une phrase qu'on
 * s'adresse. « En faire une séance » ne fait que pré-remplir l'intention du
 * compositeur, qui reste le seul chemin d'écriture d'une `LearningSession`.
 */
export function MargeCahier({
  lignes,
  compacte = false,
}: {
  lignes: LigneMarge[];
  compacte?: boolean;
}) {
  const ouvertes = lignes.filter((ligne) => !ligne.faite).length;

  const contenu = (
    <div className="space-y-3">
      <form action={noterDansLaMarge} className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="ligne-marge">
          Noter dans la marge
        </label>
        <input
          id="ligne-marge"
          name="ligne"
          type="text"
          required
          maxLength={LIGNE_MARGE_MAX}
          placeholder="Ce sur quoi je bute, ce que je veux revoir…"
          className="min-w-0 flex-1 rounded-md border border-bordure-controle bg-surface px-3 py-2 text-sm placeholder:text-texte-discret"
        />
        <Bouton type="submit" variante="secondaire" taille="petite">
          Noter
        </Bouton>
      </form>

      {lignes.length === 0 ? (
        <p className="text-xs text-texte-discret">
          Rien en marge. Une phrase suffit — elle pourra devenir une séance.
        </p>
      ) : (
        <ul className="divide-y divide-bordure">
          {lignes.map((ligne, index) => (
            <li key={`${index}-${ligne.texte}`} className="flex flex-wrap items-center gap-2 py-2">
              {/*
                Cocher est une déclaration, pas une mesure (P5) : « je considère
                que c'est traité ». Aucune preuve, aucun niveau n'en découle.
              */}
              <form action={basculerLigneMargeAction.bind(null, index)}>
                <button
                  type="submit"
                  aria-label={ligne.faite ? `Rouvrir « ${ligne.texte} »` : `Marquer « ${ligne.texte} » comme traité`}
                  className="flex size-4 items-center justify-center rounded border border-bordure-controle text-[0.625rem] leading-none text-primaire hover:border-primaire"
                >
                  {ligne.faite ? "✓" : ""}
                </button>
              </form>

              <span
                className={`min-w-0 flex-1 text-sm ${ligne.faite ? "text-texte-discret line-through" : ""}`}
              >
                {ligne.texte}
              </span>

              {!ligne.faite && (
                <Link
                  href={`/seances?composer=1&intention=${encodeURIComponent(ligne.texte)}`}
                  className="text-xs font-medium text-primaire hover:underline"
                >
                  En faire une séance
                </Link>
              )}

              <form action={retirerLigneMargeAction.bind(null, index)}>
                <button
                  type="submit"
                  aria-label={`Retirer « ${ligne.texte} » de la marge`}
                  className="text-xs text-texte-discret hover:text-danger"
                >
                  Retirer
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (compacte) return contenu;

  return (
    <Carte>
      <EnTeteCarte
        titre="La marge"
        legende={
          ouvertes > 0
            ? `${ouvertes} chose${ouvertes > 1 ? "s" : ""} notée${ouvertes > 1 ? "s" : ""} à traiter`
            : "Ce qu'on griffonne à côté du travail"
        }
      />
      <div className="px-5 py-4">{contenu}</div>
    </Carte>
  );
}
