/**
 * Squelette de chargement du groupe `(app)`.
 *
 * Next.js l'affiche instantanément dès qu'on clique sur un lien, pendant que le
 * rendu serveur (revalidation du jeton + lecture Supabase + dérivation) se fait.
 * Sans lui, la navigation restait figée sur la page précédente jusqu'à la fin du
 * rendu — la cause perçue de « c'est lent quand je clique ».
 *
 * Purement visuel : aucune donnée, aucune valeur chiffrée. Il ne prétend donc
 * rien mesurer (protocole anti-hallucination : pas de zéro par défaut).
 */
function Barre({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 ${className}`} />;
}

export default function Chargement() {
  return (
    <div aria-busy="true" aria-label="Chargement…" className="space-y-6">
      <div className="space-y-2">
        <Barre className="h-7 w-56" />
        <Barre className="h-4 w-80" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-bordure bg-surface p-4"
          >
            <Barre className="h-4 w-24" />
            <Barre className="h-8 w-16" />
            <Barre className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
