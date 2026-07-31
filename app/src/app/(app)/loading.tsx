/**
 * Squelette de chargement du groupe `(app)`.
 *
 * Next.js l'affiche instantanément dès qu'on clique sur un lien, pendant que le
 * rendu serveur (lecture Supabase + dérivation) se fait. Sans lui, la navigation
 * restait figée sur la page précédente jusqu'à la fin du rendu — la cause perçue
 * de « c'est lent quand je clique ».
 *
 * Il couvre l'attente des paramètres de route. Une fois ceux-ci résolus, chaque
 * page rend son propre en-tête et confie le reste à une frontière `<Suspense>`
 * qui, elle, affiche `SqueletteContenu` : l'en-tête et ses commandes deviennent
 * utilisables sans attendre les données.
 */
import { SquelettePage } from "@/components/layout/squelette";

export default function Chargement() {
  return <SquelettePage />;
}
