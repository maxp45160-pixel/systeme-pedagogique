"use client";

import type { StatistiquesAdmin } from "@/lib/domain/admin-kpi";

export function KpiDashboard({ kpis }: { kpis: StatistiquesAdmin }) {
  return (
    <div className="space-y-6">
      {/* 4 cartes KPI maîtresses */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Utilisateurs */}
        <div className="relative overflow-hidden rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Comptes Inscrits
            </span>
            <span className="inline-flex items-center rounded-full bg-primaire-faible px-2 py-0.5 text-xs font-medium text-primaire">
              +{kpis.nouveaux7j} (7j)
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-texte">{kpis.totalComptes}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-texte-attenue">
            <span>{kpis.comptesActifs} actifs</span>
            <span>·</span>
            <span>{kpis.comptesSuspendus} suspendus</span>
          </div>
        </div>

        {/* Utilisateurs Actifs Récent */}
        <div className="relative overflow-hidden rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Activité Récente
            </span>
            <span className="inline-flex items-center rounded-full bg-succes-faible px-2 py-0.5 text-xs font-medium text-succes">
              {kpis.tauxEngagement}% engagés
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-texte">{kpis.actifs7j}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-texte-attenue">
            <span>{kpis.actifs30j} actifs sur 30j</span>
            <span>·</span>
            <span>{kpis.nouveaux30j} nouveaux 30j</span>
          </div>
        </div>

        {/* Volume de Travail Réalisé */}
        <div className="relative overflow-hidden rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Séances & Exercices
            </span>
            <span className="inline-flex items-center rounded-full bg-info-faible px-2 py-0.5 text-xs font-medium text-info">
              ~{kpis.moyenneSeances}/compte
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-texte">{kpis.totalSeances}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-texte-attenue">
            <span>{kpis.totalExercices} exercices résolus</span>
          </div>
        </div>

        {/* Preuves & Compétences */}
        <div className="relative overflow-hidden rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Preuves de Maîtrise
            </span>
            <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-texte">
              ~{kpis.moyennePreuves}/compte
            </span>
          </div>
          <p className="mt-3 text-3xl font-bold tracking-tight text-texte">{kpis.totalPreuves}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-texte-attenue">
            <span>{kpis.totalCompetences} compétences travaillées</span>
          </div>
        </div>
      </div>

      {/* 2ème rangée : Répartition de l'activité & Listes remarquables */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Répartition de l'activité */}
        <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold text-texte">Répartition de l&apos;Engagement</h3>
          <p className="mt-1 text-xs text-texte-discret">
            Segmentation des utilisateurs selon leur nombre de séances effectuées.
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-xs font-medium text-texte">
                <span>Intensif (&gt; 10 séances)</span>
                <span>{kpis.repartitionActivite.intensif} compte(s)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-succes transition-all"
                  style={{
                    width: `${kpis.totalComptes ? (kpis.repartitionActivite.intensif / kpis.totalComptes) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-texte">
                <span>Régulier (4 à 10 séances)</span>
                <span>{kpis.repartitionActivite.regulier} compte(s)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-info transition-all"
                  style={{
                    width: `${kpis.totalComptes ? (kpis.repartitionActivite.regulier / kpis.totalComptes) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-texte">
                <span>Débutant (1 à 3 séances)</span>
                <span>{kpis.repartitionActivite.debutant} compte(s)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-alerte transition-all"
                  style={{
                    width: `${kpis.totalComptes ? (kpis.repartitionActivite.debutant / kpis.totalComptes) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-medium text-texte">
                <span>Sans activité (0 séance)</span>
                <span>{kpis.repartitionActivite.aucune} compte(s)</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-bordure transition-all"
                  style={{
                    width: `${kpis.totalComptes ? (kpis.repartitionActivite.aucune / kpis.totalComptes) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top comptes les plus actifs */}
        <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold text-texte">Comptes les Plus Actifs</h3>
          <p className="mt-1 text-xs text-texte-discret">
            Classés par nombre cumulé de séances et preuves acquises.
          </p>

          <div className="mt-4 divide-y divide-bordure/60">
            {kpis.topActifs.length === 0 ? (
              <p className="py-6 text-center text-xs text-texte-discret">Aucune activité enregistrée.</p>
            ) : (
              kpis.topActifs.map((c) => (
                <div key={c.userId} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-texte">
                      {c.prenom || c.email?.split("@")[0] || "Anonyme"}
                    </p>
                    <p className="truncate text-xs text-texte-discret">{c.email || c.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-texte">
                      {c.seances} séances · {c.preuves} preuves
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Nouveaux inscrits récents */}
        <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold text-texte">Dernières Inscriptions</h3>
          <p className="mt-1 text-xs text-texte-discret">
            Les derniers comptes ayant rejoint la plateforme.
          </p>

          <div className="mt-4 divide-y divide-bordure/60">
            {kpis.derniersInscrits.length === 0 ? (
              <p className="py-6 text-center text-xs text-texte-discret">Aucun compte inscrit.</p>
            ) : (
              kpis.derniersInscrits.map((c) => (
                <div key={c.userId} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-texte">
                      {c.prenom || c.email?.split("@")[0] || "Anonyme"}
                    </p>
                    <p className="truncate text-xs text-texte-discret">{c.email || c.userId.slice(0, 8)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-texte-discret">
                      {c.creeLe ? new Date(c.creeLe).toLocaleDateString("fr-FR") : "—"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
