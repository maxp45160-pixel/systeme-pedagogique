import { Suspense } from "react";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { SqueletteContenu } from "@/components/layout/squelette";
import { PageExplication } from "@/components/explication/page-explication";

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
    redirect("/");
  }

  const domaine = ctx.referentiel.domainesParId.get(skill.domaine);
  const etat = ctx.etats.find((e) => e.skill.code === skill.code);

  return (
    <PageExplication
      skill={skill}
      domaine={domaine}
      etat={etat}
      compteId={ctx.donnees.user.id}
    />
  );
}
