"use client";

/**
 * Formulaire de déclaration d'une échéance — le geste 100 % humain.
 *
 * Le tuteur ne propose RIEN ici : ni compétence, ni date, ni libellé. La
 * personne déclare un fait (« examen », « rendu »), et le système l'enregistre
 * tel quel après validation domaine — la même que celle du serveur, une seule
 * autorité (`validerNouvelEngagement`).
 *
 * Le ciblage de compétences est facultatif : une échéance non ciblée reste un
 * fait daté visible, elle n'alimente simplement pas le facteur « Proximité
 * d'échéance » du moteur, qui ne sait lire que des compétences.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import { creerEngagement } from "@/lib/store/engagement-actions";
import type { EntreeEngagement, TypeEngagement } from "@/lib/domain/engagement";

export interface InitialisationEngagement {
  type?: TypeEngagement;
  libelle?: string;
  echeanceLe?: string;
  /** Module présélectionné (déclaration depuis la fiche d'un domaine, ADR-137). */
  moduleDomaineId?: string;
}

const TYPES: { cle: TypeEngagement; libelle: string }[] = [
  { cle: "examen", libelle: "Examen" },
  { cle: "rendu", libelle: "Rendu" },
];

export function ModaleEngagement({
  competences,
  modules = [],
  initial,
  onFermer,
}: {
  /** Compétences actives du compte, pour le ciblage facultatif. */
  competences: { code: string; intitule: string }[];
  /** Modules (domaines vivants) du compte, pour le rattachement facultatif (ADR-137). */
  modules?: { id: string; nom: string }[];
  /** Pré-remplissage (chemin assisté ou déclaration depuis un module). */
  initial?: InitialisationEngagement;
  onFermer: () => void;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const [type, setType] = useState<TypeEngagement>(initial?.type ?? "examen");
  const [libelle, setLibelle] = useState(initial?.libelle ?? "");
  const [echeanceLe, setEcheanceLe] = useState(initial?.echeanceLe ?? "");
  const [codes, setCodes] = useState<string[]>([]);
  const [moduleDomaineId, setModuleDomaineId] = useState(initial?.moduleDomaineId ?? "");

  function basculerCode(code: string) {
    setCodes((precedents) =>
      precedents.includes(code)
        ? precedents.filter((c) => c !== code)
        : [...precedents, code],
    );
  }

  const soumettre = () => {
    setErreur(null);
    const entree: EntreeEngagement = {
      type,
      libelle,
      echeanceLe,
      codes,
      moduleDomaineId: moduleDomaineId || undefined,
    };
    demarrer(async () => {
      try {
        await creerEngagement(entree);
        onFermer();
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Déclaration impossible.");
      }
    });
  };

  return (
    <Modale
      titre="Déclarer une échéance"
      sousTitre="Un fait daté : il orientera ce sur quoi travailler à l'approche de la date."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton
            variante="principal"
            onClick={soumettre}
            enChargement={enCours}
            disabled={!libelle.trim() || !echeanceLe}
          >
            Déclarer
          </Bouton>
        </>
      }
    >
      <div className="space-y-4" data-focus-initial>
        <div>
          <p className="mb-1.5 text-xs font-medium text-texte-attenue">Type</p>
          <div className="flex gap-2">
            {TYPES.map(({ cle, libelle: libelleType }) => (
              <button
                key={cle}
                type="button"
                onClick={() => setType(cle)}
                aria-pressed={type === cle}
                className={cx(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  type === cle
                    ? "border-primaire/40 bg-primaire-faible text-primaire"
                    : "border-bordure bg-surface text-texte-attenue hover:text-texte",
                )}
              >
                {libelleType}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-texte-attenue">Libellé</span>
          <input
            type="text"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            placeholder="Ex. Contrôle sur les stocks"
            autoFocus
            className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-texte-attenue">Date</span>
          <input
            type="date"
            value={echeanceLe}
            onChange={(e) => setEcheanceLe(e.target.value)}
            className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          />
        </label>

        {modules.length > 0 && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-texte-attenue">
              Module concerné{" "}
              <span className="font-normal text-texte-discret">(facultatif)</span>
            </span>
            <select
              value={moduleDomaineId}
              onChange={(e) => setModuleDomaineId(e.target.value)}
              className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            >
              <option value="">Aucun module</option>
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.nom}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[0.6875rem] text-texte-discret">
              Le module rattaché orientera aussi la vue du cours concerné.
            </span>
          </label>
        )}

        {competences.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-texte-attenue">
              Compétences visées <span className="font-normal text-texte-discret">(facultatif)</span>
            </legend>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-bordure p-2">
              {competences.map(({ code, intitule }) => (
                <label
                  key={code}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-surface-2"
                >
                  <input
                    type="checkbox"
                    checked={codes.includes(code)}
                    onChange={() => basculerCode(code)}
                    className="shrink-0"
                  />
                  <span className="font-mono text-[0.6875rem] text-texte-discret">{code}</span>
                  <span className="min-w-0 truncate text-texte">{intitule}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {erreur && (
          <BandeauInfo ton="danger" taille="compacte">
            {erreur}
          </BandeauInfo>
        )}
      </div>
    </Modale>
  );
}
