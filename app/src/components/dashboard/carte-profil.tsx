"use client";

import { profilDeclare } from "@/lib/domain/profil";
import { Carte, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
import { ouvrirReglagesCompte } from "@/components/layout/compte";
import type { User } from "@/lib/domain/types";

/**
 * Carte Profil du tableau de bord.
 *
 * Montre ce que le profil déclare réellement et ce qui manque, sans en inventer
 * (ADR-029). Ouvre directement le panneau de réglages sur l'onglet Profil.
 */
export function CarteProfil({ user }: { user: User }) {
  const p = profilDeclare(user);
  const manquants: string[] = [];
  if (!p.formation) manquants.push("la formation");
  if (!p.objectifMoyenTerme) manquants.push("un objectif à moyen terme");
  if (!p.objectifLongTerme) manquants.push("un objectif à long terme");
  if (p.preferencesPedagogiques.length === 0) manquants.push("des préférences pédagogiques");
  if (!p.plan) manquants.push("un plan de travail");

  return (
    <Carte>
      <EnTeteCarte
        titre="Profil"
        action={
          <Etiquette ton={p.vide ? "info" : "succes"}>
            {p.vide ? "À compléter" : "Renseigné"}
          </Etiquette>
        }
      />
      <div className="px-5 py-4">
        {p.vide ? (
          <p className="text-xs text-texte-attenue">
            Rien n&apos;a encore été déclaré. Le tuteur ne suppose ni diplôme ni objectif :
            c&apos;est ce qui manque qui guide ce qu&apos;il faudrait dire.
          </p>
        ) : (
          <dl className="space-y-1.5 text-xs">
            {p.formation && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-texte-discret">Formation</dt>
                <dd className="text-texte-attenue">{p.formation}</dd>
              </div>
            )}
            {p.objectifMoyenTerme && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-texte-discret">Moyen terme</dt>
                <dd className="text-texte-attenue">{p.objectifMoyenTerme}</dd>
              </div>
            )}
            {p.objectifLongTerme && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-texte-discret">Long terme</dt>
                <dd className="text-texte-attenue">{p.objectifLongTerme}</dd>
              </div>
            )}
            {p.preferencesPedagogiques.length > 0 && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-texte-discret">Préférences</dt>
                <dd className="text-texte-attenue">
                  {p.preferencesPedagogiques.join(" · ")}
                </dd>
              </div>
            )}
            {p.plan && <dt className="pt-1 text-texte-discret">Plan de travail déclaré</dt>}
          </dl>
        )}

        {!p.vide && manquants.length > 0 && (
          <p className="mt-2 text-[0.6875rem] text-texte-discret">
            Il manque : {manquants.join(", ")}.
          </p>
        )}

        <button
          type="button"
          onClick={() => ouvrirReglagesCompte("profil")}
          className="mt-3 inline-block text-xs font-medium text-primaire hover:underline cursor-pointer"
        >
          {p.vide ? "Renseigner le profil" : "Modifier le profil"}
        </button>
      </div>
    </Carte>
  );
}