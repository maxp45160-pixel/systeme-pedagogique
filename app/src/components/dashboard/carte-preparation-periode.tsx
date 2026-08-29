"use client";

/**
 * Configuration concrète du plan — faits déclarés, jamais état de parcours.
 *
 * La carte reste accessible depuis le tableau de bord. Elle ne mémorise plus
 * une progression locale : les créneaux et les échéances vivent dans leurs
 * sources existantes et peuvent être relus, complétés ou corrigés plus tard.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BandeauInfo, Bouton, Carte, Etiquette } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { BoutonEcheance } from "@/components/dashboard/bouton-echeance";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import {
  ajouterDisponibiliteDeclaree,
  modifierDisponibiliteDeclaree,
  supprimerDisponibiliteDeclaree,
  type EntreeDisponibiliteDeclaree,
} from "@/lib/domain/contexte-orchestration";
import type { DisponibiliteDeclaree } from "@/lib/domain/types";

interface ModuleContexte {
  id: string;
  nom: string;
}

interface EngagementContexte {
  id: string;
  libelle: string;
  echeanceLe: string;
}

interface CompetenceContexte {
  code: string;
  intitule: string;
}

export interface CartePreparationPeriodeProps {
  disponibilitesDeclarees?: readonly DisponibiliteDeclaree[];
  modules: readonly ModuleContexte[];
  competences: readonly CompetenceContexte[];
  engagementsOuverts: readonly EngagementContexte[];
}

function deuxChiffres(valeur: number): string {
  return String(valeur).padStart(2, "0");
}

function versChampsLocaux(instant: string): { date: string; heure: string } | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date:
      String(date.getFullYear()).padStart(4, "0") +
      "-" +
      deuxChiffres(date.getMonth() + 1) +
      "-" +
      deuxChiffres(date.getDate()),
    heure: deuxChiffres(date.getHours()) + ":" + deuxChiffres(date.getMinutes()),
  };
}

function versInstant(date: string, heure: string): string {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) {
    throw new Error("Choisissez un jour valide.");
  }
  if (!/^[0-9]{2}:[0-9]{2}$/.test(heure)) {
    throw new Error("Choisissez une heure valide.");
  }
  const instant = new Date(date + "T" + heure + ":00");
  if (Number.isNaN(instant.getTime())) {
    throw new Error("Le jour ou l'heure n'est pas valide.");
  }
  return instant.toISOString();
}

function libelleJour(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "Jour illisible";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function libelleHeure(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "heure illisible";
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function libelleEcheance(date: string): string {
  const relue = new Date(date + "T00:00:00");
  if (Number.isNaN(relue.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(relue);
}

export function CartePreparationPeriode({
  disponibilitesDeclarees,
  modules,
  competences,
  engagementsOuverts,
}: CartePreparationPeriodeProps) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [creneaux, setCreneaux] = useState<DisponibiliteDeclaree[]>(
    () => [...(disponibilitesDeclarees ?? [])],
  );
  const [editeurOuvert, setEditeurOuvert] = useState(false);
  const [indexEdite, setIndexEdite] = useState<number | null>(null);
  const [jour, setJour] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const commandeLancee = useRef(false);

  useEffect(() => {
    let actif = true;
    queueMicrotask(() => {
      if (actif) setCreneaux([...(disponibilitesDeclarees ?? [])]);
    });
    return () => {
      actif = false;
    };
  }, [disponibilitesDeclarees]);

  function ouvrirAjout() {
    setIndexEdite(null);
    setJour("");
    setDebut("");
    setFin("");
    setErreur(null);
    setEditeurOuvert(true);
  }

  function ouvrirEdition(index: number) {
    const creneau = creneaux[index];
    const localDebut = creneau ? versChampsLocaux(creneau.startsAt) : null;
    const localFin = creneau ? versChampsLocaux(creneau.endsAt) : null;
    if (!localDebut || !localFin) {
      setErreur("Ce créneau est illisible et ne peut pas être modifié.");
      return;
    }
    setIndexEdite(index);
    setJour(localDebut.date);
    setDebut(localDebut.heure);
    setFin(localFin.heure);
    setErreur(null);
    setEditeurOuvert(true);
  }

  function annulerEdition() {
    setEditeurOuvert(false);
    setIndexEdite(null);
    setErreur(null);
  }

  function enregistrerCreneau() {
    if (commandeLancee.current) return;
    let prochain: DisponibiliteDeclaree[];
    try {
      const entree: EntreeDisponibiliteDeclaree = {
        startsAt: versInstant(jour, debut),
        endsAt: versInstant(jour, fin),
        sourceRef: indexEdite === null ? undefined : creneaux[indexEdite]?.sourceRef,
      };
      prochain =
        indexEdite === null
          ? ajouterDisponibiliteDeclaree(creneaux, entree)
          : modifierDisponibiliteDeclaree(creneaux, indexEdite, entree);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Créneau refusé.");
      return;
    }

    commandeLancee.current = true;
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({ disponibilitesDeclarees: prochain });
        setCreneaux(prochain);
        commandeLancee.current = false;
        if (indexEdite === null) {
          setJour("");
          setDebut("");
          setFin("");
        } else {
          annulerEdition();
        }
        router.refresh();
      } catch (cause) {
        commandeLancee.current = false;
        setErreur(cause instanceof Error ? cause.message : "Créneau impossible à enregistrer.");
      }
    });
  }

  function supprimerCreneau(index: number) {
    if (commandeLancee.current) return;
    try {
      const prochain = supprimerDisponibiliteDeclaree(creneaux, index);
      commandeLancee.current = true;
      setErreur(null);
      demarrer(async () => {
        try {
          await modifierProfil({ disponibilitesDeclarees: prochain });
          setCreneaux(prochain);
          commandeLancee.current = false;
          if (indexEdite === index) annulerEdition();
          else if (indexEdite !== null && index < indexEdite) setIndexEdite(indexEdite - 1);
          router.refresh();
        } catch (cause) {
          commandeLancee.current = false;
          setErreur(cause instanceof Error ? cause.message : "Créneau impossible à supprimer.");
        }
      });
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Créneau impossible à supprimer.");
    }
  }

  return (
    <Carte className="border-primaire/30 bg-surface" data-testid="carte-preparation-periode">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-bordure/60 px-5 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-medium tracking-tight text-texte">
              Vos créneaux et échéances
            </h2>
            <Etiquette ton="info">À votre rythme</Etiquette>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-texte-attenue">
            Ajoutez uniquement les moments et les dates qui aideront à composer votre plan.
            Vous pourrez les modifier ici plus tard.
          </p>
        </div>
        <span className="text-xs text-texte-discret">Données déclarées</span>
      </div>

      {erreur && (
        <div className="px-5 pt-4 sm:px-6">
          <BandeauInfo ton="danger" taille="compacte">
            <p>{erreur}</p>
          </BandeauInfo>
        </div>
      )}

      <div className="divide-y divide-bordure/60">
        <section aria-labelledby="titre-creneaux" className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="titre-creneaux" className="text-sm font-semibold text-texte">
                Créneaux disponibles
              </h3>
              <p className="mt-1 text-xs text-texte-attenue">
                Une absence de créneau ne signifie pas une difficulté : elle signifie seulement
                que vous n&apos;avez rien déclaré ici.
              </p>
            </div>
            <Bouton
              type="button"
              variante="secondaire"
              taille="petite"
              onClick={ouvrirAjout}
              disabled={enCours}
            >
              Ajouter un créneau
            </Bouton>
          </div>

          {creneaux.length > 0 ? (
            <ul className="mt-4 space-y-2" aria-label="Créneaux déclarés">
              {creneaux.map((creneau, index) => (
                <li
                  key={creneau.startsAt + "-" + creneau.endsAt + "-" + index}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface-2 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium capitalize text-texte">
                      {libelleJour(creneau.startsAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-texte-attenue">
                      De {libelleHeure(creneau.startsAt)} à {libelleHeure(creneau.endsAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Bouton
                      type="button"
                      variante="discret"
                      taille="petite"
                      onClick={() => ouvrirEdition(index)}
                      disabled={enCours}
                      aria-label={"Modifier le créneau du " + libelleJour(creneau.startsAt)}
                    >
                      Modifier
                    </Bouton>
                    <Bouton
                      type="button"
                      variante="discret"
                      taille="petite"
                      onClick={() => supprimerCreneau(index)}
                      disabled={enCours}
                      aria-label={"Supprimer le créneau du " + libelleJour(creneau.startsAt)}
                    >
                      Supprimer
                    </Bouton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-bordure px-3 py-3 text-sm text-texte-attenue">
              Aucun créneau déclaré pour le moment.
            </p>
          )}

          {editeurOuvert && (
            <form
              className="mt-4 rounded-md border border-primaire/30 bg-surface-2 p-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                enregistrerCreneau();
              }}
              aria-labelledby="titre-editeur-creneau"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h4 id="titre-editeur-creneau" className="text-sm font-medium text-texte">
                    {indexEdite === null ? "Nouveau créneau" : "Modifier le créneau"}
                  </h4>
                  <p className="mt-1 text-xs text-texte-attenue">
                    Le jour et les deux heures sont nécessaires pour éviter une plage ambiguë.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={annulerEdition}
                  disabled={enCours}
                  className="text-xs text-texte-attenue underline-offset-2 hover:text-texte hover:underline"
                >
                  Fermer
                </button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Champ
                  id="creneau-jour"
                  label="Jour"
                  type="date"
                  value={jour}
                  onChange={(event) => setJour(event.target.value)}
                  disabled={enCours}
                  requis
                />
                <Champ
                  id="creneau-debut"
                  label="Heure de début"
                  type="time"
                  value={debut}
                  onChange={(event) => setDebut(event.target.value)}
                  disabled={enCours}
                  requis
                />
                <Champ
                  id="creneau-fin"
                  label="Heure de fin"
                  type="time"
                  value={fin}
                  onChange={(event) => setFin(event.target.value)}
                  disabled={enCours}
                  requis
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Bouton
                  type="submit"
                  variante="principal"
                  taille="petite"
                  disabled={enCours || !jour || !debut || !fin}
                  enChargement={enCours}
                >
                  {indexEdite === null ? "Ajouter" : "Enregistrer"}
                </Bouton>
                <button
                  type="button"
                  onClick={annulerEdition}
                  disabled={enCours}
                  className="px-2 py-1.5 text-xs text-texte-attenue hover:text-texte"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </section>

        <section aria-labelledby="titre-echeances" className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="titre-echeances" className="text-sm font-semibold text-texte">
                Échéances à venir
              </h3>
              <p className="mt-1 text-xs text-texte-attenue">
                Elles orientent les priorités du plan ; elles ne mesurent rien.
              </p>
            </div>
            <BoutonEcheance
              competences={[...competences]}
              modules={[...modules]}
              mode="action"
              libelle="Ajouter une échéance"
            />
          </div>

          {engagementsOuverts.length > 0 ? (
            <ul className="mt-4 space-y-2" aria-label="Échéances ouvertes">
              {engagementsOuverts.map((engagement) => (
                <li
                  key={engagement.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-bordure bg-surface-2 px-3 py-2.5"
                >
                  <span className="text-sm text-texte">{engagement.libelle}</span>
                  <time dateTime={engagement.echeanceLe} className="text-xs text-texte-attenue">
                    {libelleEcheance(engagement.echeanceLe)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-bordure px-3 py-3 text-sm text-texte-attenue">
              Aucune échéance déclarée pour le moment.
            </p>
          )}
        </section>
      </div>

      <p className="border-t border-bordure/60 px-5 py-3 text-xs text-texte-discret sm:px-6">
        Ces informations restent vos déclarations. Le plan les relit ; il ne transforme pas une
        absence de créneau en faiblesse.
      </p>
    </Carte>
  );
}
