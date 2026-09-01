"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerSeanceDepuisContenu } from "@/lib/store/seance-actions";
import { gestesPourContenuModule } from "@/lib/domain/travail-contenu-module";

export function ActionsTravailContenu({
  documentId,
  moduleId,
  typeDocument,
}: {
  documentId: string;
  moduleId: string;
  typeDocument: string;
}) {
  const router = useRouter();
  const gestes = gestesPourContenuModule(typeDocument);
  const [mode, setMode] = useState<"maintenant" | "planifier" | null>(null);
  const [geste, setGeste] = useState<string>(gestes[0]?.type ?? "");
  const [date, setDate] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enCours, demarrerTransition] = useTransition();

  if (gestes.length === 0) return null;

  function soumettre() {
    if (!mode || !geste) return;
    setErreur(null);
    demarrerTransition(async () => {
      try {
        const id = await creerSeanceDepuisContenu(
          {
            documentId,
            moduleId,
            geste,
            ...(mode === "planifier" ? { planifieePour: new Date(date).toISOString() } : {}),
          },
          mode === "planifier" ? "planifiee" : "en-cours",
        );
        if (mode === "maintenant") {
          router.push(`/seances?session=${encodeURIComponent(id)}&intervention=${encodeURIComponent(`intervention-${documentId}-${geste}`)}&sas=1`);
          return;
        }
        setMode(null);
        setConfirmation("Séance planifiée");
        router.refresh();
      } catch (cause) {
        setErreur(cause instanceof Error ? cause.message : "La séance n’a pas pu être créée.");
      }
    });
  }

  return (
    <div className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => { setMode("maintenant"); setConfirmation(null); }}
          className="rounded-md bg-primaire px-2.5 py-1.5 text-xs font-semibold text-texte-inverse hover:bg-primaire-survol"
        >
          Travailler maintenant
        </button>
        <button
          type="button"
          onClick={() => { setMode("planifier"); setConfirmation(null); }}
          className="rounded-md border border-bordure bg-surface px-2.5 py-1.5 text-xs font-semibold text-texte hover:border-primaire/40"
        >
          Planifier
        </button>
      </div>
      {confirmation && <p className="mt-1 text-right text-xs font-medium text-primaire" aria-live="polite">{confirmation}</p>}
      {mode && (
        <div className="absolute right-0 top-full z-[var(--superposition-menu)] mt-2 w-72 rounded-xl border border-bordure bg-surface p-3 text-left shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-texte">{mode === "maintenant" ? "Choisir le geste" : "Planifier le travail"}</p>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-texte-discret hover:text-texte">Fermer</button>
          </div>
          <label className="mt-3 block text-xs font-medium text-texte-attenue">
            Geste
            <select value={geste} onChange={(event) => setGeste(event.target.value)} className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-2 text-sm text-texte">
              {gestes.map((item) => <option key={item.type} value={item.type}>{item.libelle}</option>)}
            </select>
          </label>
          {mode === "planifier" && (
            <label className="mt-3 block text-xs font-medium text-texte-attenue">
              Date et heure
              <input type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-md border border-bordure bg-surface px-2 py-2 text-sm text-texte" />
            </label>
          )}
          <p className="mt-3 text-xs leading-relaxed text-texte-discret">Ce travail prépare le cours. Il ne crée aucune mesure de compétence.</p>
          {erreur && <p className="mt-2 text-xs text-danger" role="alert">{erreur}</p>}
          <button
            type="button"
            disabled={enCours || (mode === "planifier" && !date)}
            onClick={soumettre}
            className="mt-3 w-full rounded-md bg-primaire px-3 py-2 text-xs font-semibold text-texte-inverse disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Création…" : mode === "maintenant" ? "Commencer" : "Confirmer la planification"}
          </button>
        </div>
      )}
    </div>
  );
}
