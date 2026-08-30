import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { PageExplication } from "@/components/explication/page-explication";
import { Carte, EtatVide, classesLienBouton } from "@/components/ui/primitives";
import { lireInterventionsSeance } from "@/lib/domain/legacy-session-intervention-adapter";
import { statutSeance } from "@/lib/domain/seance";

export const metadata: Metadata = { title: "Explication guidée" };

export default async function PageExpliquer(props: {
  searchParams: Promise<{ code?: string; session?: string; intervention?: string; retour?: string }>;
}) {
  const params = await props.searchParams;
  const code = (params.code ?? "").trim();

  if (!code) {
    redirect("/app");
  }

  return (
    <Suspense fallback={<SqueletteContenu />}>
      <ContenuExpliquer
        code={code}
        sessionId={params.session?.trim() || undefined}
        interventionId={params.intervention?.trim() || undefined}
        retour={params.retour}
      />
    </Suspense>
  );
}

function retourInterventionValide(retour: string | undefined, sessionId: string): string {
  if (typeof retour === "string" && retour.startsWith("/seances?") && !retour.startsWith("//")) {
    return retour;
  }
  return `/seances?session=${encodeURIComponent(sessionId)}`;
}

async function ContenuExpliquer({
  code,
  sessionId,
  interventionId,
  retour,
}: {
  code: string;
  sessionId?: string;
  interventionId?: string;
  retour?: string;
}) {
  const ctx = await chargerContexte();
  const skill = ctx.referentiel.parCode.get(code);

  if (!skill) {
    /*
     * Un code qui a disparu (archivage, révision du référentiel) ne renvoie
     * plus au tableau de bord en silence : la personne arrivait sans savoir
     * pourquoi, avec l'impression d'une panne. On nomme ce qui s'est passé.
     */
    return (
      <Carte>
        <EtatVide
          titre="Cette compétence n'existe plus au référentiel"
          message={`Le lien pointait vers « ${code} », qui a été archivée ou retirée depuis. Le reste du référentiel est intact.`}
          action={
            <Link href="/app" className={classesLienBouton("principal")}>
              Retour au tableau de bord
            </Link>
          }
        />
      </Carte>
    );
  }

  const domaine = ctx.referentiel.domainesParId.get(skill.domaine);
  const modeSeanceDemande = Boolean(sessionId || interventionId);
  if (modeSeanceDemande) {
    const seance = sessionId ? ctx.donnees.sessions.find((candidate) => candidate.id === sessionId) : undefined;
    const intervention = seance && interventionId
      ? lireInterventionsSeance(seance).interventions.find((candidate) => candidate.id === interventionId)
      : undefined;
    if (!seance || statutSeance(seance) !== "en-cours" || !intervention || intervention.type !== "explain") {
      return (
        <Carte>
          <EtatVide
            titre="Cette intervention n'est plus disponible"
            message="La séance ou son intervention a changé. Rien n'a été enregistré ; retournez à la séance pour reprendre le parcours courant."
            action={
              <Link
                href={retourInterventionValide(retour, sessionId ?? "")}
                className={classesLienBouton("principal")}
              >
                Retour à la séance
              </Link>
            }
          />
        </Carte>
      );
    }
    return (
      <PageExplication
        skill={skill}
        domaine={domaine}
        compteId={ctx.donnees.user.id}
        modeIntervention={{
          sessionId: seance.id,
          interventionId: intervention.id,
          retourHref: retourInterventionValide(retour, seance.id),
        }}
      />
    );
  }

  return (
    <PageExplication
      skill={skill}
      domaine={domaine}
      compteId={ctx.donnees.user.id}
    />
  );
}
