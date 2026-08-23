"use client";

import { useId, useRef } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/components/ui/primitives";
import { PaletteFormules } from "@/components/ui/palette-formules";
import { insererFormuleDansTexte } from "@/lib/ui/insertion-formule";

type TailleChamp = "normale" | "compacte";

const TAILLES_CHAMP: Record<TailleChamp, string> = {
  normale: "h-9 px-2.5 py-2 text-sm",
  compacte: "h-7 px-1.5 py-1 text-xs",
};

/*
 * Un multiligne n'a pas de hauteur fixe.
 *
 * `h-9` écrasait `rows` : un `<textarea rows={6}>` s'affichait sur une ligne et
 * demie, et le texte long — le brief d'un projet, typiquement — devenait
 * illisible dans une fente. Les appelants qui l'avaient remarqué compensaient
 * un par un avec `className="min-h-32"` ; ceux qui ne l'avaient pas remarqué
 * gardaient la fente. La hauteur revient donc à `rows`, qui est faite pour ça.
 */
const TAILLES_CHAMP_MULTILIGNE: Record<TailleChamp, string> = {
  normale: "px-2.5 py-2 text-sm",
  compacte: "px-1.5 py-1 text-xs",
};

/*
 * Bordure `--bordure-controle`, pas `--bordure` : c'est le jeton posé en
 * phase 1 précisément pour le contour d'un contrôle (WCAG 1.4.11, 3:1).
 * Aucune classe `focus:` — la règle globale `:focus-visible` de globals.css
 * s'en charge, comme pour `Bouton`. Un contour visible en permanence
 * remplace ce que le changement de couleur au focus tentait de faire seul.
 *
 * Exportée pour les rares champs à la mise en page composée (ex. une clé API
 * suivie d'un bouton « afficher/masquer » dans la même ligne) que `Champ` ne
 * représente pas : mêmes classes, chrome de label/erreur retapé à la main
 * plutôt que dupliqué en chaîne.
 */
export function classesChamp(
  taille: TailleChamp,
  enErreur: boolean,
  multiligne = false,
): string {
  return cx(
    "w-full rounded-md border bg-surface text-texte placeholder:text-texte-discret transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    enErreur ? "border-danger" : "border-bordure-controle",
    (multiligne ? TAILLES_CHAMP_MULTILIGNE : TAILLES_CHAMP)[taille],
  );
}

function Etiquette({
  id,
  label,
  requis,
}: {
  id: string;
  label: string;
  requis?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret"
    >
      {label}
      {requis && (
        <span className="text-danger" aria-hidden>
          {" "}
          *
        </span>
      )}
    </label>
  );
}

function Pied({
  aideId,
  erreurId,
  aide,
  erreur,
}: {
  aideId: string;
  erreurId: string;
  aide?: string;
  erreur?: string;
}) {
  return (
    <>
      {aide && !erreur && (
        <p id={aideId} className="mt-1 text-[0.6875rem] text-texte-discret">
          {aide}
        </p>
      )}
      {erreur && (
        <p id={erreurId} role="alert" className="mt-1 text-[0.6875rem] text-danger">
          {erreur}
        </p>
      )}
    </>
  );
}

interface ProprietesChampBase {
  /** Requis — jamais un `<span>` visuel : chaque champ doit avoir un vrai libellé accessible. */
  label: string;
  id?: string;
  aide?: string;
  /** Présence => état erreur (bordure, `aria-invalid`, message `role="alert"`). */
  erreur?: string;
  requis?: boolean;
  taille?: TailleChamp;
  className?: string;
}

type ProprietesChampInput = ProprietesChampBase &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "required"> & {
    multiligne?: false;
    rows?: never;
  };

type ProprietesChampTextarea = ProprietesChampBase &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className" | "required"> & {
    /** Rend un `<textarea>` au lieu d'un `<input>` — même chrome, même câblage. */
    multiligne: true;
    rows?: number;
    /**
     * Pose la palette de symboles mathématiques à côté du libellé.
     *
     * Opt-in, jamais par défaut : on écrit des mathématiques dans un énoncé ou
     * une section de fiche, pas dans une consigne au tuteur ni dans une note
     * d'administration. Une palette partout serait du bruit partout.
     */
    formules?: boolean;
  };

/**
 * Champ de formulaire — texte ou multiligne selon `multiligne`.
 *
 * `id` est généré via `useId()` si omis : le câblage `htmlFor`/
 * `aria-describedby` tient toujours, même si l'appelant ne passe rien.
 */
export function Champ(props: ProprietesChampInput | ProprietesChampTextarea) {
  const {
    label,
    id,
    aide,
    erreur,
    requis,
    taille = "normale",
    className,
    multiligne,
    ...reste
  } = props;

  /* `formules` est une propriété à nous : elle ne doit pas atterrir sur le
     `<textarea>`, où React la signalerait comme attribut DOM inconnu. */
  const { formules, ...resteChamp } = reste as { formules?: boolean } & Record<string, unknown>;
  const champRef = useRef<HTMLTextAreaElement | null>(null);

  const idGenere = useId();
  const idFinal = id ?? idGenere;
  const aideId = `${idFinal}-aide`;
  const erreurId = `${idFinal}-erreur`;
  const decrivantPar = cx(aide && !erreur && aideId, erreur && erreurId) || undefined;

  const classes = cx(classesChamp(taille, Boolean(erreur), Boolean(multiligne)), className);

  return (
    <div>
      {multiligne && formules ? (
        <div className="flex items-end justify-between gap-2">
          <Etiquette id={idFinal} label={label} requis={requis} />
          <PaletteFormules
            onInserer={(latex, recul) => ecrireFormule(champRef.current, latex, recul)}
          />
        </div>
      ) : (
        <Etiquette id={idFinal} label={label} requis={requis} />
      )}
      {multiligne ? (
        <textarea
          ref={champRef}
          id={idFinal}
          required={requis}
          aria-required={requis || undefined}
          aria-invalid={Boolean(erreur) || undefined}
          aria-describedby={decrivantPar}
          rows={(resteChamp as TextareaHTMLAttributes<HTMLTextAreaElement>).rows ?? 3}
          className={classes}
          {...(resteChamp as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">)}
        />
      ) : (
        <input
          id={idFinal}
          required={requis}
          aria-required={requis || undefined}
          aria-invalid={Boolean(erreur) || undefined}
          aria-describedby={decrivantPar}
          className={classes}
          {...(resteChamp as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      <Pied aideId={aideId} erreurId={erreurId} aide={aide} erreur={erreur} />
    </div>
  );
}

/**
 * Écrit une formule dans un `<textarea>` contrôlé par React, sans connaître
 * l'état de l'appelant.
 *
 * ## Pourquoi ce détour
 *
 * `Champ` reçoit `value` et `onChange` et ne sait rien du `useState` qui est
 * derrière. Affecter `element.value` directement ne déclencherait aucun
 * `onChange` : React garde sa propre trace de la valeur et considérerait
 * qu'elle n'a pas bougé, si bien que la formule disparaîtrait au rendu
 * suivant.
 *
 * On passe donc par le *setter* natif du prototype — celui que React a masqué
 * sur l'instance — puis on émet un `input` qui remonte. React le lit comme une
 * frappe ordinaire et appelle `onChange` de l'appelant. C'est le prix à payer
 * pour que n'importe quel champ multiligne gagne la palette d'un seul mot,
 * sans que chaque site de la page ait à recâbler son état.
 */
function ecrireFormule(element: HTMLTextAreaElement | null, latex: string, recul: number) {
  if (!element) return;
  const { texte, curseur } = insererFormuleDansTexte(
    element.value,
    element.selectionStart ?? element.value.length,
    element.selectionEnd ?? element.value.length,
    latex,
    recul,
  );

  const setterNatif = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  if (setterNatif) setterNatif.call(element, texte);
  else element.value = texte;
  element.dispatchEvent(new Event("input", { bubbles: true }));

  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(curseur, curseur);
  });
}

interface ProprietesChampSelect
  extends ProprietesChampBase,
    Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className" | "required"> {
  options: { valeur: string; libelle: string }[];
}

/** Sélecteur natif — même chrome que `Champ`, comportement clavier natif inchangé. */
export function ChampSelect({
  label,
  id,
  aide,
  erreur,
  requis,
  taille = "normale",
  className,
  options,
  ...reste
}: ProprietesChampSelect) {
  const idGenere = useId();
  const idFinal = id ?? idGenere;
  const aideId = `${idFinal}-aide`;
  const erreurId = `${idFinal}-erreur`;
  const decrivantPar = cx(aide && !erreur && aideId, erreur && erreurId) || undefined;

  return (
    <div>
      <Etiquette id={idFinal} label={label} requis={requis} />
      <select
        id={idFinal}
        required={requis}
        aria-required={requis || undefined}
        aria-invalid={Boolean(erreur) || undefined}
        aria-describedby={decrivantPar}
        className={cx(classesChamp(taille, Boolean(erreur)), className)}
        {...reste}
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      <Pied aideId={aideId} erreurId={erreurId} aide={aide} erreur={erreur} />
    </div>
  );
}
