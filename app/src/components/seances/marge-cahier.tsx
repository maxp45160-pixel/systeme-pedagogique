import { Bouton, Carte, EnTeteCarte, cx } from "@/components/ui/primitives";
import { IconePlus } from "@/components/ui/icones";
import { TraiterLigneMarge } from "@/components/seances/traiter-ligne-marge";
import { LIGNE_MARGE_MAX, type LigneMarge } from "@/lib/documents/marge";
import {
  basculerLigneMargeAction,
  noterDansLaMarge,
  retirerLigneMargeAction,
} from "@/lib/store/marge-actions";

/**
 * La marge du cahier : écrire une phrase, en faire une séance.
 *
 * C'est le geste qu'on vient faire le plus souvent — noter ce sur quoi on bute
 * — et il doit donc être le plus proche de la main. Depuis ADR-101 le Bureau
 * en fait une **barre de capture fixe** en pied de colonne (`ChampMarge`) et
 * range les lignes déjà écrites dans un bloc au-dessus (`ListeMarge`) : le
 * champ reste atteignable sans faire défiler, la liste ne réclame rien.
 *
 * Les trois morceaux sont exportés séparément parce que le Bureau les pose à
 * deux endroits différents de l'écran ; `MargeCahier` les recompose pour les
 * surfaces qui veulent encore le bloc entier (les outils de la séance).
 *
 * ⚠️ **Rien de ce qui est écrit ici n'entre dans le moteur.** Une ligne de marge
 * n'est ni une observation, ni une mesure, ni un niveau : c'est une phrase qu'on
 * s'adresse. « Traiter » la remet au point d'entrée unique (`CaptureIntention`,
 * ADR-073), qui décide de la forme — séance, ressource, projet, référentiel — et
 * demande confirmation. Aucune écriture ne part d'ici.
 */

/**
 * Le champ de saisie seul.
 *
 * `variante="barre"` est la forme fixe du Bureau : arrondie, ombrée, posée
 * au-dessus du contenu. `variante="bloc"` est la forme en ligne, dans une
 * carte.
 */
export function ChampMarge({
  variante = "bloc",
  autoFocus = false,
}: {
  variante?: "bloc" | "barre";
  autoFocus?: boolean;
}) {
  if (variante === "barre") {
    return (
      <form
        action={noterDansLaMarge}
        className="flex w-full items-center gap-2.5 rounded-full border border-bordure bg-surface py-1.5 pl-4 pr-1.5 shadow-[var(--ombre-surcouche)] transition-colors focus-within:border-primaire/50"
      >
        <label className="sr-only" htmlFor="ligne-marge">
          Noter dans la marge
        </label>
        <IconePlus className="size-4 shrink-0 text-texte-discret" />
        <input
          id="ligne-marge"
          name="ligne"
          type="text"
          required
          autoFocus={autoFocus}
          maxLength={LIGNE_MARGE_MAX}
          placeholder="Ce sur quoi je bute, ce que je veux revoir…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-texte-discret"
        />
        {/*
          L'indication remplace un bouton « Noter » : la touche Entrée soumet
          déjà le formulaire, et un bouton permanent dans une barre fixe est
          un objet de plus dans le champ de vision. Le bouton reste rendu pour
          le clavier et la souris, mais hors écran visuellement.
        */}
        <span aria-hidden className="hidden shrink-0 pr-2 text-[0.6875rem] text-texte-discret sm:block">
          Entrée pour noter
        </span>
        <button type="submit" className="sr-only">
          Noter
        </button>
      </form>
    );
  }

  return (
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
  );
}

/**
 * Les lignes déjà notées.
 *
 * `nu` retire le cadre et le filet supérieur : la forme du Bureau, où les
 * lignes sont posées sur la page plutôt que dans une carte.
 */
export function ListeMarge({
  lignes,
  nu = false,
}: {
  lignes: LigneMarge[];
  nu?: boolean;
}) {
  if (lignes.length === 0) {
    return (
      <p className="text-xs text-texte-discret">
        Rien en marge. Une phrase suffit — elle pourra devenir une séance.
      </p>
    );
  }

  return (
    <ul className={cx("divide-y", nu ? "divide-bordure/40" : "divide-bordure")}>
      {lignes.map((ligne, index) => (
        <li
          key={`${index}-${ligne.texte}`}
          className="group flex flex-wrap items-center gap-2 py-2"
        >
          {/*
            Cocher est une déclaration, pas une mesure (P5) : « je considère
            que c'est traité ». Aucune observation, aucun niveau n'en découle.
          */}
          <form action={basculerLigneMargeAction.bind(null, index)}>
            <button
              type="submit"
              aria-label={
                ligne.faite
                  ? `Rouvrir « ${ligne.texte} »`
                  : `Marquer « ${ligne.texte} » comme traité`
              }
              className="flex size-4 items-center justify-center rounded border border-bordure-controle text-[0.625rem] leading-none text-primaire transition-colors hover:border-primaire"
            >
              {ligne.faite ? "✓" : ""}
            </button>
          </form>

          <span
            className={cx(
              "min-w-0 flex-1 text-sm",
              ligne.faite && "text-texte-discret line-through",
            )}
          >
            {ligne.texte}
          </span>

          {/*
            Les actions n'apparaissent qu'au survol ou au focus clavier. Une
            ligne de marge se lit bien plus souvent qu'elle ne se traite ;
            deux boutons permanents par ligne faisaient de la liste un
            formulaire.
          */}
          <span
            className={cx(
              "flex items-center gap-2 transition-opacity",
              nu && "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            )}
          >
            {!ligne.faite && <TraiterLigneMarge texte={ligne.texte} />}
            <form action={retirerLigneMargeAction.bind(null, index)}>
              <button
                type="submit"
                aria-label={`Retirer « ${ligne.texte} » de la marge`}
                className="text-xs text-texte-discret transition-colors hover:text-danger"
              >
                Retirer
              </button>
            </form>
          </span>
        </li>
      ))}
    </ul>
  );
}

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
      <ChampMarge />
      <ListeMarge lignes={lignes} />
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
