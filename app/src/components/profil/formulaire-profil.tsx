"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

/**
 * Les familles de travail que le moteur peut privilégier.
 *
 * Elles vivent dans le même champ que les préférences écrites, préfixées pour
 * rester reconnaissables. Un second formulaire sur la même page écrivait le
 * même tableau et effaçait ce que celui-ci venait d'y mettre : une seule
 * écriture, un seul propriétaire du champ.
 */
const PREFIXE_FAMILLE = "adaptive:family:";

const FAMILLES = [
  { jeton: `${PREFIXE_FAMILLE}explorer`, libelle: "Explorer pour comprendre" },
  { jeton: `${PREFIXE_FAMILLE}entrainer`, libelle: "M'entraîner sur des exercices" },
  { jeton: `${PREFIXE_FAMILLE}produire`, libelle: "Produire dans un contexte réel" },
] as const;

/**
 * Les préférences pédagogiques sont une liste, une par ligne.
 *
 * Une zone de texte plutôt qu'une interface à puces : ce sont des phrases
 * écrites par l'utilisateur et relues telles quelles par le tuteur, pas des
 * étiquettes à choisir dans un catalogue. Un catalogue supposerait qu'on sache
 * d'avance quelles préférences existent.
 */
export function FormulaireProfil({
  formation,
  objectifMoyenTerme,
  objectifLongTerme,
  preferencesPedagogiques,
  plan,
  famillesVisibles,
}: {
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  preferencesPedagogiques: string[];
  plan?: string;
  /** Les familles ne se choisissent que si la boucle sait les proposer. */
  famillesVisibles?: boolean;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "info" | "alerte"; texte: string } | null>(null);

  const [form, setForm] = useState(formation);
  const [moyen, setMoyen] = useState(objectifMoyenTerme);
  const [long, setLong] = useState(objectifLongTerme);
  // Les jetons de famille ne s'affichent pas dans la zone de texte : ils y
  // seraient illisibles, et une relecture les effacerait sans le vouloir.
  const [prefs, setPrefs] = useState(
    preferencesPedagogiques.filter((p) => !p.startsWith(PREFIXE_FAMILLE)).join("\n"),
  );
  const [familles, setFamilles] = useState(
    () => new Set(preferencesPedagogiques.filter((p) => p.startsWith(PREFIXE_FAMILLE))),
  );
  const [planState, setPlanState] = useState(plan ?? "");

  function basculerFamille(jeton: string) {
    setFamilles((precedent) => {
      const suivant = new Set(precedent);
      if (suivant.has(jeton)) suivant.delete(jeton);
      else suivant.add(jeton);
      return suivant;
    });
  }

  function enregistrer() {
    setMessage(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: form,
          objectifMoyenTerme: moyen,
          objectifLongTerme: long,
          preferencesPedagogiques: [...prefs.split("\n"), ...familles],
          // Chaîne vide et non `undefined` : vider le plan doit l'effacer en
          // base, or `modifierProfil` ignore les champs absents.
          plan: planState,
        });
        setMessage({ ton: "info", texte: "Profil enregistré." });
        router.refresh();
      } catch (e) {
        setMessage({
          ton: "alerte",
          texte: e instanceof Error ? e.message : "Enregistrement impossible.",
        });
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Champ
        label="Formation ou point de départ"
        value={form}
        onChange={(e) => setForm(e.target.value)}
        placeholder="ce que tu as étudié ou pratiqué"
        aide="Contexte transmis au tuteur. Aucun niveau n'en est déduit."
      />

      <Champ
        label="Objectif à moyen terme"
        value={moyen}
        onChange={(e) => setMoyen(e.target.value)}
        placeholder="ce que tu veux pouvoir faire dans les mois qui viennent"
        aide="C'est la référence de l'importance des compétences. Sans lui, elles se vaudraient toutes et la recommandation perdrait son premier facteur."
      />

      <Champ
        label="Objectif à long terme (facultatif)"
        value={long}
        onChange={(e) => setLong(e.target.value)}
        placeholder="l'horizon, s'il est déjà clair"
      />

      <Champ
        multiligne
        label="Préférences pédagogiques (une par ligne)"
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
        rows={4}
        placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
        className="resize-y"
        aide="Transmises au tuteur comme un fait déclaré : il les respecte, il ne les devine jamais."
      />

      {famillesVisibles && (
        <fieldset>
          <legend className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Façons de travailler que tu préfères
          </legend>
          <div className="space-y-2">
            {FAMILLES.map(({ jeton, libelle }) => (
              <label key={jeton} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={familles.has(jeton)}
                  onChange={() => basculerFamille(jeton)}
                />
                <span>{libelle}</span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-texte-attenue">
            Une préférence pèse dans le choix de la prochaine action ; elle ne l&apos;impose pas.
          </p>
        </fieldset>
      )}

      <Champ
        multiligne
        label="Plan de travail (facultatif)"
        value={planState}
        onChange={(e) => setPlanState(e.target.value)}
        rows={6}
        placeholder={
          "Ce que tu veux accomplir, dans quel ordre, avec quel contexte.\nEx : « D'abord consolider les fondamentaux de logique, puis attaquer l'optimisation linéaire pour le Master. Je travaille surtout le soir, 1h par session. »"
        }
        className="resize-y"
        aide="Transmis au tuteur pour orienter les exercices et la priorisation. Plus c'est précis, plus le tuteur peut cibler — mais rien ne t'engage à suivre ce plan à la lettre."
      />

      {message && (
        <BandeauInfo ton={message.ton} taille="compacte">
          <p className={message.ton === "alerte" ? "text-alerte" : "text-texte-attenue"}>
            {message.texte}
          </p>
        </BandeauInfo>
      )}

      <Bouton onClick={enregistrer} disabled={enCours} variante="principal">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </div>
  );
}
