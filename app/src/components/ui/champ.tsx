import { useId } from "react";
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/components/ui/primitives";

type TailleChamp = "normale" | "compacte";

const TAILLES_CHAMP: Record<TailleChamp, string> = {
  normale: "h-9 px-2.5 py-2 text-sm",
  compacte: "h-7 px-1.5 py-1 text-xs",
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
export function classesChamp(taille: TailleChamp, enErreur: boolean): string {
  return cx(
    "w-full rounded-md border bg-surface text-texte placeholder:text-texte-discret transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    enErreur ? "border-danger" : "border-bordure-controle",
    TAILLES_CHAMP[taille],
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

  const idGenere = useId();
  const idFinal = id ?? idGenere;
  const aideId = `${idFinal}-aide`;
  const erreurId = `${idFinal}-erreur`;
  const decrivantPar = cx(aide && !erreur && aideId, erreur && erreurId) || undefined;

  const classes = cx(classesChamp(taille, Boolean(erreur)), className);

  return (
    <div>
      <Etiquette id={idFinal} label={label} requis={requis} />
      {multiligne ? (
        <textarea
          id={idFinal}
          required={requis}
          aria-required={requis || undefined}
          aria-invalid={Boolean(erreur) || undefined}
          aria-describedby={decrivantPar}
          rows={(reste as TextareaHTMLAttributes<HTMLTextAreaElement>).rows ?? 3}
          className={classes}
          {...(reste as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">)}
        />
      ) : (
        <input
          id={idFinal}
          required={requis}
          aria-required={requis || undefined}
          aria-invalid={Boolean(erreur) || undefined}
          aria-describedby={decrivantPar}
          className={classes}
          {...(reste as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}
      <Pied aideId={aideId} erreurId={erreurId} aide={aide} erreur={erreur} />
    </div>
  );
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
