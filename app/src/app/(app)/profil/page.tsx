import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { EntetePage } from "@/components/layout/entete-page";
import { Carte } from "@/components/ui/primitives";
import { FormulaireProfil } from "@/components/profil/formulaire-profil";
import { ObjectifsStructures } from "@/components/profil/objectifs-structures";
import { loadAdaptiveGoals } from "@/lib/store/adaptive-learning";

/**
 * Édition du profil déclaré.
 *
 * Ces colonnes existaient depuis l'origine et **rien ne les renseignait** :
 * deux comptes sur trois affichaient « Formation à renseigner ». C'était le
 * prérequis matériel qu'ADR-009 identifiait depuis le 27/07/2026.
 *
 * Elles ne sont pas décoratives. L'objectif à moyen terme est la référence par
 * rapport à laquelle l'importance d'une compétence se déclare (protocole du
 * référentiel §4) : sans lui, toutes les compétences se vaudraient et la
 * recommandation perdrait son premier facteur. Les préférences pédagogiques
 * sont transmises au tuteur comme un fait observé — il les respecte, il ne les
 * infère jamais.
 *
 * Aucun niveau n'est jamais déduit de ce qui est déclaré ici. Seules des preuves
 * en produisent (anti-hallucination §7).
 */
export default async function PageProfil() {
  const ctx = await chargerContexte();
  const u = ctx.donnees.user;
  const adaptatif = u.learningLoopMode === "adaptive-v1";
  const objectifs = adaptatif ? await loadAdaptiveGoals(u.id) : [];
  const nonRenseigne = (v: string) => (v.includes("à renseigner") ? "" : v);

  return (
    <>
      <EntetePage
        titre="Profil"
        sousTitre="Ce que tu déclares de toi. Sert à pondérer les recommandations et à cadrer le tuteur — jamais à déduire un niveau."
        actions={
          <Link href="/atelier" className="text-xs text-primaire hover:underline">
            Gérer le référentiel
          </Link>
        }
      />

      <div className="space-y-5">
        <Carte>
          <div className="space-y-5 px-5 py-4">
            <FormulaireProfil
              formation={nonRenseigne(u.formation)}
              objectifMoyenTerme={nonRenseigne(u.objectifMoyenTerme)}
              objectifLongTerme={nonRenseigne(u.objectifLongTerme)}
              preferencesPedagogiques={u.preferencesPedagogiques ?? []}
              plan={u.plan}
              famillesVisibles={adaptatif}
            />
            {/*
              L'objectif détaillé se replie sous l'objectif déclaré, au lieu de
              s'ouvrir en tête du tableau de bord : c'est la même intention, dite
              une fois de plus précisément — pas un second système d'objectifs.
            */}
            {adaptatif && (
              <ObjectifsStructures objectifs={objectifs} competences={ctx.referentiel.actifs} />
            )}
          </div>
        </Carte>
        {/*
          L'interrupteur de la bêta adaptative n'est pas rendu : la colonne
          `profiles.learning_loop_mode` n'existe pas en production, et l'écrire
          lèverait une erreur PostgREST. Le composant reste au dépôt
          (`components/profil/activation-boucle-adaptative.tsx`) ; le remettre
          ici demande d'abord d'appliquer la migration qui crée la colonne.
        */}
      </div>
    </>
  );
}
