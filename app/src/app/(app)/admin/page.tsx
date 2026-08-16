import { Suspense } from "react";
import { notFound } from "next/navigation";
import { EntetePage } from "@/components/layout/entete-page";
import { SqueletteContenu } from "@/components/layout/squelette";
import { BandeauInfo } from "@/components/ui/primitives";
import { TableComptes } from "@/components/admin/table-comptes";
import { estAdministrateur, lireAccesCourant, listerComptes } from "@/lib/store/acces";

/**
 * Le panel d'administration (ADR-074).
 *
 * ## Ce qu'il montre, et ce qu'il ne montrera jamais
 *
 * Qui existe, depuis quand, ce que son travail totalise, et si son accès est
 * ouvert. Rien de plus : aucun énoncé d'exercice, aucune preuve, aucune note,
 * aucun document. Un administrateur n'est pas un lecteur privilégié du travail
 * des autres — les données personnelles ne se partagent pas sans consentement
 * explicite (P8), et un rôle n'est pas un consentement.
 *
 * Les compteurs affichés viennent d'une fonction SQL qui ne renvoie que des
 * nombres. Il n'existe aucun chemin, depuis cet écran, vers le contenu d'un
 * autre compte.
 *
 * ## `notFound` et non `redirect`
 *
 * Un non-administrateur ne doit pas apprendre que cette page existe. Une
 * redirection vers l'accueil le lui dirait. L'autorisation réelle, elle, ne
 * dépend pas de ce test : `admin_comptes()` refuse d'elle-même, et les
 * politiques de `comptes_acces` n'acceptent d'écriture que d'un admin.
 */
export default async function PageAdmin() {
  return (
    <>
      <EntetePage
        titre="Comptes et accès"
        sousTitre="Qui a un compte, ce que son travail totalise, et qui peut encore entrer."
      />
      <Suspense fallback={<SqueletteContenu />}>
        <ContenuAdmin />
      </Suspense>
    </>
  );
}

async function ContenuAdmin() {
  const [admin, acces] = await Promise.all([estAdministrateur(), lireAccesCourant()]);
  if (!admin || !acces) notFound();

  const comptes = await listerComptes();

  return (
    <div className="space-y-5">
      <BandeauInfo>
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-info" aria-hidden />
        <p className="text-texte-attenue">
          <strong className="font-medium text-info">Suspendre coupe la lecture, pas les données.</strong>{" "}
          Un compte suspendu ne lit plus une seule ligne de son travail — les politiques de la base
          le refusent — mais rien n&apos;est supprimé : rouvrir l&apos;accès rend tout en l&apos;état.
        </p>
      </BandeauInfo>

      <TableComptes comptes={comptes} moiId={acces.userId} />
    </div>
  );
}
