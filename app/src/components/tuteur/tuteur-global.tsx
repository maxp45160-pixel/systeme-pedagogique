/**
 * Le tuteur, accessible de partout — en tiroir, pas en navigation.
 *
 * Remplace `BoutonTuteurFlottant`, qui était un `<Link href="/tuteur">` : le
 * bouton ressemblait à un ouvre-panneau et faisait perdre la page en cours.
 * Le tiroir garde la page visible derrière lui, ce pour quoi il existe.
 *
 * Sans exercice ni compétence ciblés : le contexte de la page n'est pas connu
 * ici. Les pages qui ont mieux à transmettre montent leur propre tiroir, et le
 * flottant s'efface alors (`HorsPageContextuelle`).
 */

import { chargerContexte } from "@/lib/store/context";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
import { HorsPageContextuelle } from "@/components/tuteur/hors-page-contextuelle";

export async function TuteurGlobal() {
  const ctx = await chargerContexte();
  const etatInitial = await construireEtatInitialTuteur(ctx);

  return (
    <HorsPageContextuelle>
      <TiroirTuteur
        declencheur="flottant"
        libelle="Ouvrir le tuteur"
        etatInitial={etatInitial}
        codesCompetences={ctx.etats.map((e) => e.skill.code)}
        compteId={ctx.donnees.user.id}
        domainesExistants={ctx.referentiel.domaines.map((d) => ({
          id: d.id,
          nom: d.nom,
          prefixe: d.prefixe,
        }))}
      />
    </HorsPageContextuelle>
  );
}
