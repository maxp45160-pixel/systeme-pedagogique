import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { EntetePage } from "@/components/layout/entete-page";
import { Carte } from "@/components/ui/primitives";
import { FormulaireProfil } from "@/components/profil/formulaire-profil";

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
  const nonRenseigne = (v: string) => (v.includes("à renseigner") ? "" : v);

  return (
    <>
      <EntetePage
        titre="Profil"
        sousTitre="Ce que tu déclares de toi. Sert à pondérer les recommandations et à cadrer le tuteur — jamais à déduire un niveau."
        actions={
          <Link href="/competences?vue=gerer" className="text-xs text-primaire hover:underline">
            Gérer le référentiel
          </Link>
        }
      />

      <Carte>
        <div className="px-5 py-4">
          <FormulaireProfil
            formation={nonRenseigne(u.formation)}
            objectifMoyenTerme={nonRenseigne(u.objectifMoyenTerme)}
            objectifLongTerme={nonRenseigne(u.objectifLongTerme)}
            preferencesPedagogiques={u.preferencesPedagogiques ?? []}
            plan={u.plan}
          />
        </div>
      </Carte>
    </>
  );
}
