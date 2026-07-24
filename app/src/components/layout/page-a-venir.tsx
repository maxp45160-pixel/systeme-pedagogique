import Link from "next/link";
import { EntetePage } from "./entete-page";
import { Carte, Etiquette } from "@/components/ui/primitives";

/**
 * Page d'une section prévue mais non encore construite.
 *
 * Choix délibéré : dire franchement ce qui n'existe pas, plutôt que d'afficher
 * une maquette remplie de données inventées. Le protocole anti-hallucination §7
 * s'applique aussi à l'interface, pas seulement au profil.
 */
export function PageAVenir({
  titre,
  sousTitre,
  raisonAttente,
  fonctionsPrevues,
  entreTemps,
}: {
  titre: string;
  sousTitre: string;
  raisonAttente: string;
  fonctionsPrevues: string[];
  entreTemps?: { texte: string; href: string; libelle: string };
}) {
  return (
    <>
      <EntetePage
        titre={titre}
        sousTitre={sousTitre}
        actions={<Etiquette ton="info">Pas encore construit</Etiquette>}
      />

      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Carte className="lg:col-span-2">
          <div className="px-4 py-4">
            <p className="text-sm">{raisonAttente}</p>

            <div className="mt-4">
              <div className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
                Ce que cette section fera
              </div>
              <ul className="space-y-1.5">
                {fonctionsPrevues.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs text-texte-attenue">
                    <span aria-hidden className="mt-0.5 text-texte-discret">
                      ·
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {entreTemps && (
              <div className="mt-5 rounded-md border border-bordure bg-surface-2 px-3 py-2.5">
                <p className="text-xs text-texte-attenue">{entreTemps.texte}</p>
                <Link
                  href={entreTemps.href}
                  className="mt-1.5 inline-block text-xs text-primaire hover:underline"
                >
                  {entreTemps.libelle} →
                </Link>
              </div>
            )}
          </div>
        </Carte>

        <Carte>
          <div className="px-4 py-4">
            <p className="text-xs font-medium">Pourquoi cette page est vide</p>
            <p className="mt-1.5 text-xs leading-relaxed text-texte-attenue">
              Le cahier des charges demande de construire une base solide avant les fonctions
              avancées. Afficher une maquette remplie de données inventées serait plus flatteur,
              mais contredirait la règle qui gouverne tout le reste du système : ne jamais présenter
              comme réel ce qui ne l&apos;est pas.
            </p>
          </div>
        </Carte>
      </div>
    </>
  );
}
