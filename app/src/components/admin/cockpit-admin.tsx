"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CompteAdministre } from "@/lib/domain/acces";
import type { StatistiquesAdmin } from "@/lib/domain/admin-kpi";
import type { DiagnosticSysteme } from "@/lib/store/systeme";
import type { DonneesPerspectiveGraphe } from "@/components/dev/graphe-workflow";
import { KpiDashboard } from "./kpi-dashboard";
import { TableComptes } from "./table-comptes";
import { DiagnosticSystemeView } from "./diagnostic-systeme";
import { GrapheWorkflowViz } from "@/components/dev/graphe-workflow";
import { ProfilDashboard } from "@/components/dev/profil-dashboard";
import { BandeauInfo } from "@/components/ui/primitives";

export type OngletAdmin = "kpi" | "comptes" | "diagnostic" | "workflow" | "profil";

export interface DonneesCockpitAdmin {
  comptes: CompteAdministre[];
  moiId: string;
  kpis: StatistiquesAdmin;
  diagnostic: DiagnosticSysteme;
  perspectivesWorkflow: {
    architecture: DonneesPerspectiveGraphe;
    ux: DonneesPerspectiveGraphe;
    uxAtomique: DonneesPerspectiveGraphe;
  };
}

export function CockpitAdmin({
  comptes,
  moiId,
  kpis,
  diagnostic,
  perspectivesWorkflow,
}: DonneesCockpitAdmin) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const ongletActifBrut = searchParams.get("onglet");
  const ongletActif: OngletAdmin =
    ongletActifBrut === "comptes" ||
    ongletActifBrut === "diagnostic" ||
    ongletActifBrut === "workflow" ||
    ongletActifBrut === "profil"
      ? ongletActifBrut
      : "kpi";

  function changerOnglet(nouvelOnglet: OngletAdmin) {
    const params = new URLSearchParams(searchParams.toString());
    if (nouvelOnglet === "kpi") {
      params.delete("onglet");
    } else {
      params.set("onglet", nouvelOnglet);
    }
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  }

  const onglets: { id: OngletAdmin; libelle: string; badge?: string | number }[] = [
    { id: "kpi", libelle: "Indicateurs" },
    { id: "comptes", libelle: "Comptes et accès", badge: comptes.length },
    { id: "diagnostic", libelle: "Diagnostic et sécurité" },
    { id: "workflow", libelle: "Workflow" },
    { id: "profil", libelle: "Performance" },
  ];

  return (
    <div className="space-y-6">
      {/* Barre de navigation des onglets */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-bordure pb-4">
        <nav className="flex flex-wrap gap-1.5" aria-label="Navigation Cockpit Admin">
          {onglets.map((o) => {
            const actif = ongletActif === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => changerOnglet(o.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
                  actif
                    ? "bg-primaire text-primaire-contraste shadow-sm"
                    : "text-texte-discret hover:bg-surface hover:text-texte"
                }`}
              >
                <span>{o.libelle}</span>
                {o.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[0.6875rem] font-semibold ${
                      actif
                        ? "bg-white/20 text-white"
                        : "bg-surface text-texte-discret border border-bordure"
                    }`}
                  >
                    {o.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Contenu selon l'onglet actif */}
      <div>
        {ongletActif === "kpi" && <KpiDashboard kpis={kpis} />}

        {ongletActif === "comptes" && (
          <div className="space-y-5">
            <BandeauInfo>
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
              <p className="text-texte-attenue">
                <strong className="font-medium text-info">
                  Protection des pairs et isolation des données :
                </strong>{" "}
                Un administrateur ne peut ni se couper son propre accès, ni rétrograder ou suspendre un
                autre administrateur. Les données privées (exercices, preuves, notes) restent
                strictement confidentielles (Principe P8).
              </p>
            </BandeauInfo>

            <TableComptes comptes={comptes} moiId={moiId} />
          </div>
        )}

        {ongletActif === "diagnostic" && <DiagnosticSystemeView diagnostic={diagnostic} />}

        {ongletActif === "workflow" && (
          <div className="overflow-hidden rounded-xl border border-bordure bg-surface shadow-sm h-[750px] flex flex-col">
            <GrapheWorkflowViz
              architecture={perspectivesWorkflow.architecture}
              ux={perspectivesWorkflow.ux}
              uxAtomique={perspectivesWorkflow.uxAtomique}
            />
          </div>
        )}

        {ongletActif === "profil" && (
          <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-serif tracking-tight text-texte">Console de Profilage</h2>
              <p className="mt-1 text-xs text-texte-discret">
                Mesure les temps d&apos;exécution des lectures base de données, du moteur pédagogique et
                des rendus client. Vous pouvez activer l&apos;enregistrement ici, naviguer librement sur
                le site (la pastille flottante confirme la capture), puis revenir analyser les résultats.
              </p>
            </div>
            <ProfilDashboard compteId={moiId} />
          </div>
        )}
      </div>
    </div>
  );
}
