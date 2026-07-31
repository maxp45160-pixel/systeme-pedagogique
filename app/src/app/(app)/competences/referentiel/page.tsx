import { Suspense } from "react";
import Link from "next/link";
import { chargerContexte } from "@/lib/store/context";
import { chargerRetraits } from "@/lib/store/referentiel";
import { SqueletteContenu } from "@/components/layout/squelette";
import { EntetePage } from "@/components/layout/entete-page";
import { Carte, EtatVide } from "@/components/ui/primitives";
import { GestionReferentiel } from "@/components/referentiel/gestion";
import { ValidationBranche } from "@/components/referentiel/validation-branche";

/**
 * Gestion du référentiel du compte (ADR-026, ADR-027).
 *
 * Route statique placée avant `competences/[code]` : Next.js donne la priorité
 * au segment littéral, « referentiel » ne sera donc jamais lu comme un code.
 *
 * Deux usages dans un seul écran, parce que c'est le même geste vu à deux
 * moments : valider une branche que le tuteur vient de proposer, et entretenir
 * celle qui existe déjà.
 */
export default async function PageReferentiel(props: {
  searchParams: Promise<{ proposition?: string }>;
}) {
  const { proposition } = await props.searchParams;

  return (
    <>
      <EntetePage
        titre="Référentiel"
        sousTitre="La liste de ce que le système peut mesurer sur toi. Elle t'appartient : le tuteur la propose, tu la valides, tu la modifies."
        actions={
          <Link href="/tuteur" className="text-xs text-primaire hover:underline">
            Demander une branche au tuteur
          </Link>
        }
      />

      <Suspense fallback={<SqueletteContenu />}>
        <ContenuReferentiel proposition={Boolean(proposition)} />
      </Suspense>
    </>
  );
}

async function ContenuReferentiel({ proposition }: { proposition: boolean }) {
  const [ctx, retraits] = await Promise.all([chargerContexte(), chargerRetraits()]);
  const { referentiel } = ctx;

  return (
    <>
      {/*
        Le formulaire de validation ne s'affiche que sur le drapeau posé par le
        chat, jamais au montage : lire `sessionStorage` de sa propre initiative
        rejouerait une proposition déjà consommée.
      */}
      {proposition && (
        <Carte className="mb-4">
          <div className="px-5 py-4">
            <ValidationBranche
              domainesExistants={referentiel.domaines.map((d) => ({
                id: d.id,
                nom: d.nom,
                prefixe: d.prefixe,
              }))}
            />
          </div>
        </Carte>
      )}

      {referentiel.skills.length === 0 ? (
        <Carte>
          <EtatVide
            titre="Aucun référentiel"
            message="Ce compte n'a pas encore de compétences à suivre. Déclare ton sujet de travail : le tuteur proposera une première branche, que tu valideras ici."
            action={
              <Link href="/demarrer" className="text-xs text-primaire hover:underline">
                Déclarer mon sujet
              </Link>
            }
          />
        </Carte>
      ) : (
        <GestionReferentiel
          domaines={referentiel.domaines}
          skills={referentiel.skills}
          retraits={Object.fromEntries(retraits)}
        />
      )}
    </>
  );
}
