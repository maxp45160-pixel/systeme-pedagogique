"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { creerBranche } from "@/lib/store/referentiel-actions";
import { normaliserPalier } from "@/lib/domain/referentiel-compte";
import { BandeauInfo, Bouton, cx } from "@/components/ui/primitives";
import type { OrigineReferentiel, Palier } from "@/lib/domain/types";

const PALIERS: Array<{ id: Palier; libelle: string; desc: string }> = [
  { id: "fondamentaux", libelle: "Fondamentaux", desc: "Socle & notions" },
  { id: "intermediaire", libelle: "Intermédiaire", desc: "Pratique & analyse" },
  { id: "avance", libelle: "Avancé", desc: "Maîtrise & synthèse" },
];

const IMPORTANCES = [
  { valeur: "1.0", libelle: "Essentielle", note: "Socle clé" },
  { valeur: "0.5", libelle: "Standard", note: "Pratique régulière" },
  { valeur: "0.2", libelle: "Complémentaire", note: "Approfondissement" },
];

interface Ligne {
  intitule: string;
  palier: Palier;
  importance: string;
  retenue: boolean;
}

export interface BrancheInitiale {
  domaine: string;
  prefixe: string;
  description: string;
  justification: string;
  competences: { intitule: string; palier: string; importance: string }[];
}

export function ValidationBranche({
  domainesExistants,
  initiale,
  origine = "tuteur",
  domaineFixe = false,
  surEnregistre,
  onFermer,
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  /** État initial — vide pour une création manuelle, pré-rempli pour une suggestion. */
  initiale?: BrancheInitiale;
  /** D'où vient la branche : « manuel » ou « tuteur ». */
  origine?: OrigineReferentiel;
  /** Si vrai, masque les champs domaine/préfixe pour se concentrer sur les compétences */
  domaineFixe?: boolean;
  /** Appelé après l'enregistrement — pour fermer la modale ou rafraîchir. */
  surEnregistre?: (codes: string[]) => void;
  onFermer?: () => void;
}) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [domaine, setDomaine] = useState(initiale?.domaine ?? "");
  const [prefixe, setPrefixe] = useState(initiale?.prefixe ?? "");
  const prefixeManuelRef = useRef(Boolean(initiale?.prefixe));
  const [description, setDescription] = useState(initiale?.description ?? "");
  const justification = initiale?.justification ?? "";

  function genererPrefixeAuto(nom: string): string {
    const nettoye = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const mots = nettoye.split(/[^A-Z0-9]+/).filter(Boolean);
    if (mots.length === 0) return "";
    if (mots.length === 1) return mots[0].slice(0, 4);
    if (mots.length === 2) return (mots[0].slice(0, 2) + mots[1].slice(0, 2)).slice(0, 4);
    return mots.map((m) => m[0]).slice(0, 4).join("");
  }

  function gererChangementDomaine(valeur: string) {
    setDomaine(valeur);
    if (!prefixeManuelRef.current) {
      setPrefixe(genererPrefixeAuto(valeur));
    }
  }

  const [lignes, setLignes] = useState<Ligne[]>(() => {
    if (initiale?.competences && initiale.competences.length > 0) {
      return initiale.competences.map((c) => ({
        intitule: c.intitule,
        palier: normaliserPalier(c.palier),
        importance: c.importance || "0.5",
        retenue: true,
      }));
    }
    return [{ intitule: "", palier: "fondamentaux", importance: "0.5", retenue: true }];
  });

  const existant = domainesExistants.find(
    (d) => d.nom.toLowerCase() === domaine.trim().toLowerCase(),
  );

  const estDomaineConnu = Boolean(domaineFixe || existant);

  useEffect(() => {
    // Focus direct sur l'intitulé à l'ouverture
    inputRef.current?.focus();
  }, []);

  function majLigne(i: number, maj: Partial<Ligne>) {
    setLignes((l) => l.map((x, k) => (k === i ? { ...x, ...maj } : x)));
  }

  function ajouterLigne() {
    const dernierPalier = lignes[lignes.length - 1]?.palier ?? "fondamentaux";
    setLignes((l) => [
      ...l,
      { intitule: "", palier: dernierPalier, importance: "0.5", retenue: true },
    ]);
  }

  const retenues = lignes.filter((l) => l.retenue && l.intitule.trim().length > 0);
  const pret = domaine.trim().length > 2 && retenues.length > 0;

  function soumettre() {
    setErreur(null);
    demarrer(async () => {
      try {
        const r = await creerBranche({
          domaine: domaine.trim(),
          prefixe: (existant ? existant.prefixe : prefixe).trim(),
          description: description.trim(),
          competences: retenues.map((l) => ({
            intitule: l.intitule.trim(),
            palier: l.palier,
            importance: l.importance,
          })),
          origine,
        });
        surEnregistre?.(r.codes);
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* En-tête du domaine */}
      {estDomaineConnu ? (
        <div className="flex items-center justify-between rounded-xl border border-bordure bg-surface-2/60 p-3.5">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primaire-faible px-2.5 py-1 font-mono text-xs font-semibold text-primaire">
              {existant?.prefixe || prefixe || "DOM"}
            </span>
            <div>
              <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-texte-discret">
                Domaine cible
              </p>
              <h3 className="font-serif text-sm font-semibold text-texte">
                {existant?.nom ?? domaine}
              </h3>
            </div>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-[0.6875rem] font-medium text-texte-discret">
            Rattaché
          </span>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-bordure bg-surface-2/30 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Nouveau Domaine
            </span>
            <span className="text-[0.6875rem] text-texte-discret">
              Branche d’apprentissage
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <div>
              <label className="block text-xs font-medium text-texte-attenue mb-1">
                Nom du domaine *
              </label>
              <input
                value={domaine}
                onChange={(e) => gererChangementDomaine(e.target.value)}
                placeholder="Ex : Cryptographie & Sécurité"
                className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-texte-attenue mb-1">
                Préfixe (3-4 l.)
              </label>
              <input
                value={prefixe}
                onChange={(e) => {
                  prefixeManuelRef.current = true;
                  setPrefixe(e.target.value.toUpperCase());
                }}
                placeholder="Ex : CRYP"
                maxLength={5}
                className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 font-mono text-sm uppercase text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-texte-attenue mb-1">
              Description (facultative)
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Périmètre et objectifs pédagogiques du domaine…"
              className="w-full rounded-lg border border-bordure bg-surface px-3 py-2 text-xs text-texte placeholder:text-texte-discret focus:border-primaire outline-none"
            />
          </div>
        </div>
      )}

      {justification && (
        <div className="rounded-xl border border-info/30 bg-info-faible p-3 text-xs text-info leading-relaxed">
          <span className="font-semibold">Observation du tuteur :</span> {justification}
        </div>
      )}

      {/* Formulaire des compétences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
            {lignes.length > 1 ? `Compétences à ajouter (${lignes.length})` : "Compétence"}
          </label>
          <span className="text-[0.6875rem] text-texte-discret">
            Le code est attribué automatiquement
          </span>
        </div>

        <div className="space-y-4">
          {lignes.map((l, i) => (
            <div
              key={i}
              className={cx(
                "rounded-xl border border-bordure bg-surface p-4 shadow-xs space-y-3.5 transition-all",
                !l.retenue && "opacity-50",
              )}
            >
              {/* Ligne Intitulé */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-texte">
                    Intitulé de la compétence *
                  </label>
                  {lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLignes((ls) => ls.filter((_, k) => k !== i))}
                      className="text-[0.6875rem] text-texte-discret hover:text-danger cursor-pointer transition-colors"
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <input
                  ref={i === 0 ? inputRef : undefined}
                  value={l.intitule}
                  onChange={(e) => majLigne(i, { intitule: e.target.value })}
                  placeholder="Ex : Analyser les structures logiques d'un argument et ses présupposés"
                  className="w-full rounded-lg border border-bordure bg-surface-2/40 px-3.5 py-2.5 text-sm font-medium text-texte placeholder:text-texte-discret focus:border-primaire focus:bg-surface outline-none transition-all shadow-xs"
                />
              </div>

              {/* Sélection du Palier */}
              <div>
                <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-1.5">
                  Palier d'apprentissage
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PALIERS.map((p) => {
                    const actif = l.palier === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => majLigne(i, { palier: p.id })}
                        className={cx(
                          "flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all cursor-pointer",
                          actif
                            ? "border-primaire bg-primaire-faible text-primaire shadow-xs"
                            : "border-bordure bg-surface hover:border-primaire/40 hover:bg-surface-2 text-texte-attenue",
                        )}
                      >
                        <span className="text-xs font-semibold">{p.libelle}</span>
                        <span className="mt-0.5 text-[0.625rem] opacity-75 hidden sm:inline">
                          {p.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sélection de l'Importance */}
              <div>
                <label className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret mb-1.5">
                  Niveau d'importance
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {IMPORTANCES.map((imp) => {
                    const actif = l.importance === imp.valeur;
                    return (
                      <button
                        key={imp.valeur}
                        type="button"
                        onClick={() => majLigne(i, { importance: imp.valeur })}
                        className={cx(
                          "flex items-center justify-center gap-1.5 rounded-lg border py-1.5 px-2 text-xs transition-all cursor-pointer",
                          actif
                            ? "border-primaire bg-primaire/10 text-primaire font-semibold"
                            : "border-bordure bg-surface hover:bg-surface-2 text-texte-discret",
                        )}
                      >
                        <span>{imp.libelle}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={ajouterLigne}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primaire hover:underline cursor-pointer"
        >
          <span>+ Ajouter une autre compétence</span>
        </button>
      </div>

      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="text-danger">{erreur}</p>
        </BandeauInfo>
      )}

      {/* Barre d'action */}
      <div className="sticky bottom-0 z-10 -mx-5 -mb-4 mt-4 flex items-center justify-end gap-3 border-t border-bordure bg-surface/95 backdrop-blur-sm px-5 py-3.5">
        {onFermer && (
          <Bouton
            type="button"
            variante="secondaire"
            disabled={enCours}
            onClick={onFermer}
          >
            Annuler
          </Bouton>
        )}
        <Bouton
          type="button"
          onClick={soumettre}
          disabled={!pret || enCours}
          enChargement={enCours}
          variante="principal"
        >
          {enCours
            ? "Enregistrement…"
            : !estDomaineConnu
            ? retenues.length > 1
              ? `Créer le domaine et ses ${retenues.length} compétences`
              : "Créer le domaine"
            : retenues.length > 1
            ? `Ajouter les ${retenues.length} compétences`
            : "Ajouter la compétence"}
        </Bouton>
      </div>
    </div>
  );
}
