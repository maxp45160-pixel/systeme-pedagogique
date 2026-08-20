import { profilDeclare } from "@/lib/domain/profil";
import { Carte, EnTeteCarte, Etiquette } from "@/components/ui/primitives";
import type { User } from "@/lib/domain/types";

/**
 * Carte synthétique du Profil d'apprentissage, en tête de `/compte`.
 *
 * Affiche clairement ce qui est déclaré, le style pédagogique et ce qui manque,
 * sans inventer de fausse métrique (ADR-029).
 */
export function CarteProfil({ user }: { user: User }) {
  const p = profilDeclare(user);
  const manquants: string[] = [];
  if (!p.formation) manquants.push("la formation / point de départ");
  if (p.preferencesPedagogiques.length === 0) manquants.push("des préférences pédagogiques");

  return (
    <Carte>
      <EnTeteCarte
        titre="Profil d'apprentissage actif"
        action={
          <Etiquette ton={p.vide ? "info" : manquants.length === 0 ? "succes" : "neutre"}>
            {p.vide ? "À initialiser" : manquants.length === 0 ? "Complet" : "Partiel"}
          </Etiquette>
        }
      />
      <div className="px-5 py-4 space-y-3">
        {p.vide ? (
          <p className="text-xs leading-relaxed text-texte-attenue">
            Rien n&apos;a encore été déclaré. Votre objectif sera formulé au démarrage, puis utilisé
            automatiquement pour calibrer les exercices.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-lg bg-surface-2/40 border border-bordure/60 p-3 space-y-1">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret block">
                Point de départ / Formation
              </span>
              <p className="font-medium text-texte leading-snug">
                {p.formation || "Non renseigné"}
              </p>
            </div>

            <div className="rounded-lg bg-surface-2/40 border border-bordure/60 p-3 space-y-1">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret block">
                Intention déclarée
              </span>
              <p className="text-texte-attenue leading-snug">
                {p.objectifMoyenTerme || p.objectifLongTerme || "Non renseignée"}
              </p>
            </div>

            {p.preferencesPedagogiques.length > 0 && (
              <div className="sm:col-span-2 rounded-lg bg-surface-2/40 border border-bordure/60 p-3 space-y-1.5">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret block">
                  Préférences & Style d&apos;apprentissage
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {p.preferencesPedagogiques.map((pref) => (
                    <span
                      key={pref}
                      className="inline-flex items-center rounded-md bg-surface border border-bordure/80 px-2 py-0.5 text-[0.6875rem] font-medium text-texte shadow-xs"
                    >
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {!p.vide && manquants.length > 0 && (
          <p className="text-[0.6875rem] text-texte-discret">
            Champs optionnels non déclarés : {manquants.join(", ")}.
          </p>
        )}
      </div>
    </Carte>
  );
}
