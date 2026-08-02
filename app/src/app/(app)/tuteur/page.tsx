import { Suspense } from "react";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { construireContexte } from "@/lib/tutor/contexte";
import { choisirConfiguration, decrireChoix } from "@/lib/tutor/moteurs";
import { EntetePage } from "@/components/layout/entete-page";
import { ChatTuteur, type EtatContexteTuteur } from "@/components/tuteur/chat";

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

  // Assemblé ici plutôt que par un `fetch("/api/tutor")` au montage du chat :
  // cette requête-là repayait un `chargerContexte()` complet — le `cache()` de
  // React ne franchit pas la frontière d'une requête HTTP — plus un
  // aller-retour d'authentification, pour un contexte déjà chargé ci-dessus.
  // `messages` est vide, donc le protocole de synthèse est chargé (ADR-021 §4).
  const pedagogique = await construireContexte(ctx, [], exercice);
  const choix = choisirConfiguration(process.env);
  const etatInitial: EtatContexteTuteur = {
    // Conserve le nom historique du champ : l'interface s'en sert pour décider
    // d'afficher le chat ou le repli « copier le contexte ».
    cleConfiguree: choix.kind !== "aucun",
    modele: decrireChoix(choix),
    manifeste: pedagogique.manifeste,
    caracteresTotal: pedagogique.caracteresTotal,
  };

  return (
    <ChatTuteur
      etatInitial={etatInitial}
      competenceCiblee={cible ? cibleLibelle : undefined}
      amorce={amorce}
      exerciceCible={exercice}
      codesCompetences={ctx.etats.map((e) => e.skill.code)}
      compteId={ctx.donnees.user.id}
    />
  );
}
