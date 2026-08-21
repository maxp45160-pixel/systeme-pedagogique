"use client";

/**
 * Le bloc « domaine cible » de la modale de création.
 *
 * Écrit trois fois dans `modale-competence.tsx` — saisie assistée, relecture
 * de la proposition, formulaire manuel — avec des ids de datalist différents
 * et deux gabarits (compact en saisie, détaillé ailleurs). Un seul composant :
 * la divergence suivante aurait été invisible jusqu'à ce qu'un écran montre
 * un domaine que l'autre ne connaît pas.
 */

export function BlocDomaineCible({
  competenceSeule,
  estDomaineExistant,
  idListe,
  domaineCible,
  onChangerDomaine,
  domainesExistants,
  prefixeConnu,
  detaille = false,
}: {
  competenceSeule: boolean;
  estDomaineExistant: boolean;
  /** L'id du datalist doit être unique par instance rendue. */
  idListe: string;
  domaineCible: string;
  onChangerDomaine: (valeur: string) => void;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  prefixeConnu?: string;
  detaille?: boolean;
}) {
  const choixLibre = competenceSeule && !estDomaineExistant;
  return (
    <div
      className={
        detaille
          ? "rounded-xl border border-bordure bg-surface-2/60 p-3.5"
          : "rounded-lg border border-bordure bg-surface-2/60 px-3 py-2 text-xs"
      }
    >
      {choixLibre ? (
        <label className="block">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Domaine de rattachement
          </span>
          <input
            list={idListe}
            value={domaineCible}
            onChange={(e) => onChangerDomaine(e.target.value)}
            placeholder="Choisir un domaine existant"
            className="mt-1 w-full rounded-md border border-bordure-controle bg-surface px-2.5 py-1.5 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none"
          />
          <datalist id={idListe}>
            {domainesExistants.map((domaine) => (
              <option key={domaine.id} value={domaine.nom} />
            ))}
          </datalist>
        </label>
      ) : detaille ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primaire-faible px-2.5 py-1 font-mono text-xs font-semibold text-primaire">
              {prefixeConnu ?? "DOM"}
            </span>
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
                Domaine cible
              </p>
              <h3 className="font-serif text-sm font-semibold text-texte">{domaineCible}</h3>
            </div>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[0.6875rem] font-medium text-texte-discret">
            Rattaché
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded bg-primaire-faible px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-primaire">
              {prefixeConnu ?? "DOM"}
            </span>
            <span className="font-semibold text-texte">{domaineCible}</span>
          </div>
          <span className="text-[0.6875rem] text-texte-discret">Domaine cible</span>
        </div>
      )}
    </div>
  );
}
