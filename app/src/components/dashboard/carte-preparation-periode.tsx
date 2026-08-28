"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Carte, Bouton, Etiquette } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { RappelNouveauBesoin } from "@/components/intention/bouton-intention";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import {
  normaliserDisponibilitesDeclarees,
  progressionContexte,
  type EtapeContexte,
} from "@/lib/domain/contexte-orchestration";
import {
  acquitterEtapeAssistantContexte,
  lireEtatAssistantContexte,
  type EtatAssistantContexte,
} from "@/lib/ui/assistant-contexte";
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

export interface CartePreparationPeriodeProps {
  compteId: string;
  observationsCount: number;
  periodeDeclaree?: string;
  disponibilitesDeclarees?: readonly DisponibiliteDeclaree[];
  modules: readonly ModuleContexte[];
  engagementsOuverts: readonly EngagementContexte[];
}

const TITRES: Record<EtapeContexte, string> = {
  periode: "Votre période",
  modules: "Vos modules",
  disponibilites: "Vos disponibilités",
  echeances: "Vos échéances",
};

const SOUS_TITRES: Record<EtapeContexte, string> = {
  periode: "Un repère déclaré, sans transformer votre période en objectif.",
  modules: "Les domaines académiques déjà déclarés sont préremplis.",
  disponibilites: "Quelques créneaux suffisent ; vous pourrez en ajouter plus tard.",
  echeances: "Les échéances connues orientent le plan, elles ne créent aucune dette.",
};

function libelleDate(date: string): string {
  const relue = new Date(`${date}T00:00:00`);
  if (Number.isNaN(relue.getTime())) return date;
  return relue.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

export function CartePreparationPeriode({
  compteId,
  observationsCount,
  periodeDeclaree,
  disponibilitesDeclarees,
  modules,
  engagementsOuverts,
}: CartePreparationPeriodeProps) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [hydrate, setHydrate] = useState(false);
  const [etat, setEtat] = useState<EtatAssistantContexte>({ version: 1, etapesAcquittees: [] });
  const [periode, setPeriode] = useState(periodeDeclaree ?? "");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setEtat(lireEtatAssistantContexte(compteId));
      setHydrate(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [compteId]);

  const progression = useMemo(() => progressionContexte({
    periodeDeclaree,
    disponibilitesDeclarees,
    nombreEcheancesOuvertes: engagementsOuverts.length,
    etapesIgnorees: etat.etapesAcquittees,
  }), [periodeDeclaree, disponibilitesDeclarees, engagementsOuverts.length, etat.etapesAcquittees]);

  if (!hydrate || observationsCount === 0 || progression.termine || !progression.prochaineEtape) return null;

  const etape = progression.prochaineEtape;

  function acquitter(etapeAcquittee: EtapeContexte) {
    const prochain = acquitterEtapeAssistantContexte(compteId, etapeAcquittee);
    setEtat(prochain);
    setErreur(null);
  }

  function passer() {
    acquitter(etape);
  }

  function enregistrerPeriode() {
    setErreur(null);
    demarrer(async () => {
      try {
        await modifierProfil({ periodeDeclaree: periode });
        acquitter("periode");
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Période impossible à enregistrer.");
      }
    });
  }

  function enregistrerDisponibilite() {
    setErreur(null);
    demarrer(async () => {
      try {
        const disponibilites = normaliserDisponibilitesDeclarees([{ startsAt: debut, endsAt: fin }]);
        await modifierProfil({ disponibilitesDeclarees: disponibilites });
        acquitter("disponibilites");
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "Disponibilité impossible à enregistrer.");
      }
    });
  }

  return (
    <Carte className="border-primaire/30 bg-surface" data-testid="carte-preparation-periode">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-bordure/60 px-5 py-5 sm:px-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-medium tracking-tight text-texte">Préparer votre période</h2>
            <Etiquette ton="info">Facultatif</Etiquette>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-texte-attenue">
            Quelques repères déclarés pour aider le plan à composer avec votre réalité.
          </p>
          {modules.length > 0 && (
            <p className="mt-2 text-xs text-texte-discret">
              {modules.length} module{modules.length > 1 ? "s" : ""} déjà déclaré{modules.length > 1 ? "s" : ""}.
            </p>
          )}
        </div>
        <span className="text-xs text-texte-discret">Une étape à la fois</span>
      </div>

      <div className="px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-primaire">{TITRES[etape]}</p>
        <p className="mt-1 text-sm text-texte-attenue">{SOUS_TITRES[etape]}</p>

        {etape === "periode" && (
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); enregistrerPeriode(); }}>
            <Champ
              id="periode-orchestration"
              label="Période ou horizon"
              value={periode}
              onChange={(event) => setPeriode(event.target.value)}
              placeholder="Ex. semestre d'automne 2026"
              aide="Vous pouvez laisser cette étape de côté."
              disabled={enCours}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Bouton variante="principal" taille="normale" type="submit" disabled={enCours || periode.trim().length === 0}>
                Enregistrer et continuer
              </Bouton>
              <Bouton variante="discret" taille="normale" type="button" onClick={passer} disabled={enCours}>
                Plus tard
              </Bouton>
            </div>
          </form>
        )}

        {etape === "disponibilites" && (
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); enregistrerDisponibilite(); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Champ id="disponibilite-debut" label="Début" type="datetime-local" value={debut} onChange={(event) => setDebut(event.target.value)} disabled={enCours} />
              <Champ id="disponibilite-fin" label="Fin" type="datetime-local" value={fin} onChange={(event) => setFin(event.target.value)} disabled={enCours} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Bouton variante="principal" taille="normale" type="submit" disabled={enCours || debut.length === 0 || fin.length === 0}>
                Ajouter ce créneau
              </Bouton>
              <Bouton variante="discret" taille="normale" type="button" onClick={passer} disabled={enCours}>
                Plus tard
              </Bouton>
            </div>
          </form>
        )}

        {etape === "echeances" && (
          <div className="mt-4 space-y-4">
            {engagementsOuverts.length > 0 ? (
              <ul className="divide-y divide-bordure/60 rounded-md border border-bordure">
                {engagementsOuverts.map((engagement) => (
                  <li key={engagement.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="text-texte">{engagement.libelle}</span>
                    <span className="text-xs text-texte-attenue">{libelleDate(engagement.echeanceLe)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p className="text-sm text-texte-attenue">Aucune échéance n&apos;est connue pour le moment.</p>
                <RappelNouveauBesoin />
              </>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Bouton variante="secondaire" taille="normale" type="button" onClick={() => acquitter("echeances")} disabled={enCours}>
                Continuer
              </Bouton>
              <Bouton variante="discret" taille="normale" type="button" onClick={passer} disabled={enCours}>
                Plus tard
              </Bouton>
            </div>
          </div>
        )}

        {erreur && <p className="mt-3 text-sm text-danger" role="alert">{erreur}</p>}
      </div>
    </Carte>
  );
}
