import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { PageExplication } from "@/components/explication/page-explication";
import { Carte, EtatVide, classesLienBouton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Explication guidée" };

export default async function PageExpliquer(props: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await props.searchParams;
  const code = (params.code ?? "").trim();

  if (!code) {
    redirect("/");
  }

  return (
    <Suspense fallback={<SqueletteContenu />}>
      <ContenuExpliquer code={code} />
    </Suspense>
  );
}

async function ContenuExpliquer({ code }: { code: string }) {
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
            <Link href="/" className={classesLienBouton("principal")}>
              Retour au tableau de bord
            </Link>
          }
        />
      </Carte>
    );
  }

  const domaine = ctx.referentiel.domainesParId.get(skill.domaine);

  return (
    <PageExplication
      skill={skill}
      domaine={domaine}
      compteId={ctx.donnees.user.id}
    />
  );
}
