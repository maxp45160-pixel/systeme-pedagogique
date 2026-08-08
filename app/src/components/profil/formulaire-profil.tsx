"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { modifierProfil } from "@/lib/store/referentiel-actions";
import { Bouton, cx } from "@/components/ui/primitives";

const champ =
  "mt-1 w-full rounded-md border border-bordure bg-surface px-2.5 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none";

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
}: {
  formation: string;
  objectifMoyenTerme: string;
  objectifLongTerme: string;
  preferencesPedagogiques: string[];
  plan?: string;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState<{ ton: "info" | "alerte"; texte: string } | null>(null);

  const [form, setForm] = useState(formation);
  const [moyen, setMoyen] = useState(objectifMoyenTerme);
  const [long, setLong] = useState(objectifLongTerme);
  const [prefs, setPrefs] = useState(preferencesPedagogiques.join("\n"));
  const [planState, setPlanState] = useState(plan ?? "");

  function enregistrer() {
    setMessage(null);
    demarrer(async () => {
      try {
        await modifierProfil({
          formation: form,
          objectifMoyenTerme: moyen,
          objectifLongTerme: long,
          preferencesPedagogiques: prefs.split("\n"),
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
      <label className="block">
        <span className="text-xs font-medium">Formation ou point de départ</span>
        <input
          value={form}
          onChange={(e) => setForm(e.target.value)}
          placeholder="ce que tu as étudié ou pratiqué"
          className={champ}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Contexte transmis au tuteur. Aucun niveau n&apos;en est déduit.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium">Objectif à moyen terme</span>
        <input
          value={moyen}
          onChange={(e) => setMoyen(e.target.value)}
          placeholder="ce que tu veux pouvoir faire dans les mois qui viennent"
          className={champ}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          C&apos;est la référence de l&apos;importance des compétences. Sans lui, elles se
          vaudraient toutes et la recommandation perdrait son premier facteur.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium">
          Objectif à long terme <span className="text-texte-discret">(facultatif)</span>
        </span>
        <input
          value={long}
          onChange={(e) => setLong(e.target.value)}
          placeholder="l'horizon, s'il est déjà clair"
          className={champ}
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium">
          Préférences pédagogiques <span className="text-texte-discret">(une par ligne)</span>
        </span>
        <textarea
          value={prefs}
          onChange={(e) => setPrefs(e.target.value)}
          rows={4}
          placeholder={"Reformuler avant de corriger.\nPartir d'un cas concret plutôt que de la théorie."}
          className={cx(champ, "resize-y")}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Transmises au tuteur comme un fait déclaré : il les respecte, il ne les devine jamais.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium">
          Plan de travail <span className="text-texte-discret">(facultatif)</span>
        </span>
        <textarea
          value={planState}
          onChange={(e) => setPlanState(e.target.value)}
          rows={6}
          placeholder={
            "Ce que tu veux accomplir, dans quel ordre, avec quel contexte.\nEx : « D'abord consolider les fondamentaux de logique, puis attaquer l'optimisation linéaire pour le Master. Je travaille surtout le soir, 1h par session. »"
          }
          className={cx(champ, "resize-y")}
        />
        <span className="mt-1 block text-[0.6875rem] text-texte-discret">
          Transmis au tuteur pour orienter les exercices et la priorisation. Plus c&apos;est
          précis, plus le tuteur peut cibler — mais rien ne t&apos;engage à suivre ce plan à la lettre.
        </span>
      </label>

      {message && (
        <p
          className={cx(
            "rounded-md border px-3 py-2 text-xs",
            message.ton === "alerte"
              ? "border-alerte/30 bg-alerte-faible text-alerte"
              : "border-info/30 bg-info-faible text-texte-attenue",
          )}
        >
          {message.texte}
        </p>
      )}

      <Bouton onClick={enregistrer} disabled={enCours} variante="principal">
        {enCours ? "Enregistrement…" : "Enregistrer"}
      </Bouton>
    </div>
  );
}
