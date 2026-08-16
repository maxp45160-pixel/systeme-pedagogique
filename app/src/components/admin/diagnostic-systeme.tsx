"use client";

import type { DiagnosticSysteme } from "@/lib/store/systeme";

export function DiagnosticSystemeView({ diagnostic }: { diagnostic: DiagnosticSysteme }) {
  const { baseDeDonnees, ia, environnement, securite } = diagnostic;

  return (
    <div className="space-y-6">
      {/* En-tête statut global */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Base de données */}
        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Base de données
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                baseDeDonnees.joignable
                  ? "bg-succes-faible text-succes"
                  : "bg-danger-faible text-danger"
              }`}
            >
              {baseDeDonnees.joignable ? "Connectée" : "Indisponible"}
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-texte">
            {baseDeDonnees.joignable ? `${baseDeDonnees.latenceMs} ms` : "Erreur"}
          </p>
          <p className="mt-1 text-xs text-texte-discret">
            {baseDeDonnees.configuree ? "Supabase PostgreSQL" : "Non configuré"}
          </p>
          {baseDeDonnees.erreur && (
            <p className="mt-2 text-xs text-danger font-mono break-all">{baseDeDonnees.erreur}</p>
          )}
        </div>

        {/* Moteur IA */}
        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Moteur IA Serveur
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                ia.tuteurServeurActif
                  ? "bg-info-faible text-info"
                  : "bg-surface-2 text-texte-discret"
              }`}
            >
              {ia.tuteurServeurActif ? "Configuré" : "Clé Client"}
            </span>
          </div>
          <p className="mt-3 text-xl font-bold text-texte truncate">{ia.modeleDefaut}</p>
          <p className="mt-1 text-xs text-texte-discret">{ia.moteurServeur}</p>
        </div>

        {/* Environnement */}
        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Environnement
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                environnement.estProduction
                  ? "bg-surface-2 text-texte"
                  : "bg-alerte-faible text-alerte"
              }`}
            >
              {environnement.nodeEnv}
            </span>
          </div>
          <p className="mt-3 text-xl font-bold text-texte">Node {environnement.versionNode}</p>
          <p className="mt-1 text-xs text-texte-discret">App Router Next.js</p>
        </div>

        {/* Sécurité */}
        <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
              Niveau de Sécurité
            </span>
            <span className="inline-flex items-center rounded-full bg-succes-faible px-2 py-0.5 text-xs font-medium text-succes">
              Verrouillé
            </span>
          </div>
          <p className="mt-3 text-xl font-bold text-texte">RLS + Triggers</p>
          <p className="mt-1 text-xs text-texte-discret">Protection des pairs & données</p>
        </div>
      </div>

      {/* Grille détaillée */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Fournisseurs IA configurés */}
        <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold text-texte">Fournisseurs d'Intelligence Artificielle</h3>
          <p className="mt-1 text-xs text-texte-discret">
            Détection de la présence des clés d'API serveur (sans exposition des valeurs secrètes).
          </p>

          <div className="mt-4 divide-y divide-bordure/60">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-faible text-info font-semibold text-sm">
                  C
                </span>
                <div>
                  <div className="text-sm font-medium text-texte">Tuteur Compatible OpenAI (Palier gratuit)</div>
                  <div className="text-xs text-texte-discret">TUTEUR_CLE / TUTEUR_URL_BASE / TUTEUR_MODELE</div>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ia.tuteurCompatible
                    ? "bg-succes-faible text-succes"
                    : "bg-surface-2 text-texte-discret"
                }`}
              >
                {ia.tuteurCompatible ? "Présente" : "Absente"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-alerte-faible text-alerte font-semibold text-sm">
                  A
                </span>
                <div>
                  <div className="text-sm font-medium text-texte">Anthropic Claude</div>
                  <div className="text-xs text-texte-discret">ANTHROPIC_API_KEY</div>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ia.anthropic
                    ? "bg-succes-faible text-succes"
                    : "bg-surface-2 text-texte-discret"
                }`}
              >
                {ia.anthropic ? "Présente" : "Absente"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primaire-faible text-primaire font-semibold text-sm">
                  G
                </span>
                <div>
                  <div className="text-sm font-medium text-texte">Google Gemini</div>
                  <div className="text-xs text-texte-discret">GEMINI_API_KEY / GOOGLE_API_KEY</div>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ia.gemini
                    ? "bg-succes-faible text-succes"
                    : "bg-surface-2 text-texte-discret"
                }`}
              >
                {ia.gemini ? "Présente" : "Absente"}
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-texte font-semibold text-sm">
                  M
                </span>
                <div>
                  <div className="text-sm font-medium text-texte">Mistral AI</div>
                  <div className="text-xs text-texte-discret">MISTRAL_API_KEY</div>
                </div>
              </div>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  ia.mistral
                    ? "bg-succes-faible text-succes"
                    : "bg-surface-2 text-texte-discret"
                }`}
              >
                {ia.mistral ? "Présente" : "Absente"}
              </span>
            </div>
          </div>
        </div>

        {/* Garde-fous et Invariants de Sécurité */}
        <div className="rounded-xl border border-bordure bg-surface p-6 shadow-sm">
          <h3 className="text-base font-semibold text-texte">Garde-fous & Invariants Système</h3>
          <p className="mt-1 text-xs text-texte-discret">
            Vérification des protections d'autorisation et d'isolation des données.
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-bordure/60 bg-fond/50 p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-succes-faible text-succes text-xs font-bold">
                ✓
              </span>
              <div>
                <div className="text-sm font-medium text-texte">Row Level Security (RLS) PostgreSQL</div>
                <div className="text-xs text-texte-discret">
                  Toutes les tables métiers sont verrouillées par `auth.uid() = user_id`.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-bordure/60 bg-fond/50 p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-succes-faible text-succes text-xs font-bold">
                ✓
              </span>
              <div>
                <div className="text-sm font-medium text-texte">Protection des Pairs Administrateurs</div>
                <div className="text-xs text-texte-discret">
                  Interdiction formelle de rétrogradation et suspension d'un admin par un autre admin.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-bordure/60 bg-fond/50 p-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-succes-faible text-succes text-xs font-bold">
                ✓
              </span>
              <div>
                <div className="text-sm font-medium text-texte">Principe P8 — Confidentialité Stricte</div>
                <div className="text-xs text-texte-discret">
                  Zéro lecture de contenus d'exercices, notes ou conversations d'autrui dans le panel admin.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-bordure/60 bg-fond/50 p-3">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  securite.variablesSensiblesIsolees
                    ? "bg-succes-faible text-succes"
                    : "bg-danger-faible text-danger"
                }`}
              >
                {securite.variablesSensiblesIsolees ? "✓" : "!"}
              </span>
              <div>
                <div className="text-sm font-medium text-texte">Isolation des Clés Secrètes</div>
                <div className="text-xs text-texte-discret">
                  Aucune clé `service_role` ni clé d'API privée n'est exposée au client (`NEXT_PUBLIC_`).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
