/**
 * Squelettes d'attente partagés.
 *
 * Deux usages, volontairement distincts :
 *
 * - `SqueletteContenu` remplit une frontière `<Suspense>` *à l'intérieur* d'une
 *   page : l'en-tête, lui, est déjà rendu et n'a pas besoin d'être simulé.
 * - `SquelettePage` sert de `loading.tsx` au groupe `(app)`, quand rien de la
 *   page n'est encore rendu — il ajoute donc les barres d'en-tête.
 *
 * Purement visuels : aucune donnée, aucune valeur chiffrée. Ils ne prétendent
 * rien mesurer (protocole anti-hallucination : pas de zéro par défaut).
 */

export function Barre({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

export function SqueletteContenu({ cartes = 6 }: { cartes?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="Chargement…"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: cartes }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border border-bordure bg-surface p-4">
          <Barre className="h-4 w-24" />
          <Barre className="h-8 w-16" />
          <Barre className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SquelettePage() {
  return (
    <div aria-busy="true" aria-label="Chargement…" className="space-y-6">
      <div className="space-y-2">
        <Barre className="h-7 w-56" />
        <Barre className="h-4 w-80" />
      </div>

      <SqueletteContenu />
    </div>
  );
}
