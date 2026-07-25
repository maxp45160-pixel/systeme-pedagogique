import { chargerContexte } from "@/lib/store/context";
import { EntetePage } from "@/components/layout/entete-page";
import { ChatTuteur } from "@/components/tuteur/chat";

export default async function PageTuteur(props: {
  searchParams: Promise<{ competence?: string }>;
}) {
  const { competence } = await props.searchParams;
  const ctx = await chargerContexte();

  const cible = competence ? ctx.etatsParCode.get(competence.toUpperCase()) : undefined;
  const amorce = cible
    ? `${cible.skill.code} — ${cible.skill.intitule}${
        cible.niveau === null
          ? " (jamais évaluée)"
          : ` (niveau actuel ${cible.niveau}/5, confiance ${cible.confiance})`
      }`
    : undefined;

  return (
    <>
      <EntetePage
        titre="IA Tutor"
        sousTitre="Un tuteur qui reçoit les protocoles du système et l'état réel de tes compétences. Il questionne, corrige et propose — il ne modifie rien sans ta validation."
      />
      <ChatTuteur
        competenceCiblee={amorce}
        modeDemo={ctx.mode === "demo"}
        codesCompetences={ctx.etats.map((e) => e.skill.code)}
      />
    </>
  );
}
