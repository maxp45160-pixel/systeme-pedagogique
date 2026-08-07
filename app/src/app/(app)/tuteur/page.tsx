import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { construireEtatInitialTuteur } from "@/lib/tutor/etat-initial";
import { EntetePage } from "@/components/layout/entete-page";
import { ChatTuteur } from "@/components/tuteur/chat";

export default async function PageTuteur(props: {
  searchParams: Promise<{ competence?: string; amorce?: string; exercice?: string }>;
}) {
  const { competence, amorce, exercice } = await props.searchParams;

  return (
    <>
      <EntetePage
        titre="IA Tutor"
        sousTitre="Un tuteur qui reçoit les protocoles du système et l'état réel de tes compétences. Il questionne, corrige et propose — il ne modifie rien sans ta validation."
      />

      <Suspense fallback={<SqueletteContenu cartes={3} />}>
        <ContenuTuteur competence={competence} amorce={amorce} exercice={exercice} />
      </Suspense>
    </>
  );
}

async function ContenuTuteur({
  competence,
  amorce,
  exercice,
}: {
  competence?: string;
  amorce?: string;
  /** Exercice depuis lequel on est arrivé — son énoncé part au tuteur. */
  exercice?: string;
}) {
  const ctx = await chargerContexte();

  const cible = competence ? ctx.etatsParCode.get(competence.toUpperCase()) : undefined;
  const cibleLibelle = cible
    ? `${cible.skill.code} — ${cible.skill.intitule}${
        cible.niveau === null
          ? " (jamais évaluée)"
          : ` (niveau actuel ${cible.niveau}/5, confiance ${cible.confiance})`
      }`
    : undefined;

  const etatInitial = await construireEtatInitialTuteur(ctx, exercice);

  return (
    <ChatTuteur
      etatInitial={etatInitial}
      competenceCiblee={cible ? cibleLibelle : undefined}
      amorce={amorce}
      exerciceCible={exercice}
      codesCompetences={ctx.etats.map((e) => e.skill.code)}
      compteId={ctx.donnees.user.id}
      domainesExistants={ctx.referentiel.domaines.map((d) => ({
        id: d.id,
        nom: d.nom,
        prefixe: d.prefixe,
      }))}
    />
  );
}
