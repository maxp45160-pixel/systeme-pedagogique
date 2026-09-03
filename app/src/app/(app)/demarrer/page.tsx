import Link from "next/link";
import { redirect } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import { valeurDeclaree } from "@/lib/domain/profil";
import { estAdministrateur } from "@/lib/store/acces";
import { EntetePage } from "@/components/layout/entete-page";
import { BandeauInfo, Carte } from "@/components/ui/primitives";
import { FormulaireAmorcage } from "@/components/demarrer/formulaire-amorcage";
import { IconeAmpoule, IconeFleche } from "@/components/ui/icones";
import { choisirConfiguration } from "@/lib/tutor/moteurs";
import { lireQuotaTuteur } from "@/lib/store/quota-tuteur";

/**
 * Amorçage d'un compte neuf (ADR-026).
 *
 * Un compte démarre sans référentiel : il n'y a rien à mesurer, et le tableau
 * de bord n'aurait que des tirets à montrer. Cet écran demande les trois seules
 * choses que le système ne peut pas dériver — le sujet, l'intention, le point de
 * départ — puis passe la main au tuteur.
 *
 * Pour les administrateurs, l'accès reste possible via `?apercu=1` afin de
 * tester et prévisualiser l'expérience d'amorçage sans devoir recréer de compte.
 */
export default async function PageDemarrer(props: {
  searchParams?: Promise<{ apercu?: string; preview?: string }>;
}) {
  const params = props.searchParams ? await props.searchParams : undefined;
  const modeApercu = params?.apercu === "1" || params?.preview === "1";

  const [ctx, admin, quota] = await Promise.all([
    chargerContexte(),
    estAdministrateur(),
    lireQuotaTuteur(),
  ]);
  const accesApercuAdmin = modeApercu && admin;

  // Le référentiel existe déjà : il n'y a rien à amorcer sauf si un administrateur
  // inspecte ou teste l'écran en mode aperçu.
  if (ctx.referentiel.skills.length > 0 && !accesApercuAdmin) {
    redirect("/atelier");
  }

  return (
    <>
      {accesApercuAdmin && ctx.referentiel.skills.length > 0 && (
        <div className="mb-4">
          <BandeauInfo ton="info" taille="compacte">
            <div className="flex flex-wrap items-center justify-between gap-2 w-full">
              <span className="text-xs flex items-center gap-1.5">
                <IconeAmpoule className="size-3.5 text-info shrink-0" />
                <span>
                  <strong>Mode test administrateur</strong> : Vous visualisez l&apos;écran d&apos;amorçage sans réinitialiser votre compte existant.
                </span>
              </span>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primaire hover:underline"
              >
                <span>Retour à Comptes et accès</span>
                <IconeFleche className="size-3" />
              </Link>
            </div>
          </BandeauInfo>
        </div>
      )}

      <EntetePage
        titre="Sur quoi voulez-vous progresser ?"
        sousTitre="Choisissez un seul point de départ. Votre premier test arrive avant le tableau de bord."
      />

      {/*
        Le tutoriel est proposé ici, pas imposé avant : quelqu'un qui sait déjà
        ce qu'il veut travailler ne doit pas traverser une page d'explications
        pour commencer. Le lien reste au-dessus du formulaire pour rester vu.
      */}
      <p className="mb-4 px-1 text-xs text-texte-attenue">
        Première visite ?{" "}
        <Link href="/aide" className="font-medium text-primaire underline underline-offset-2">
          Lisez d&apos;abord comment ça marche
        </Link>{" "}
        — le fonctionnement complet, écran par écran, en quelques minutes.
      </p>

      <Carte>
        <div className="px-5 py-4">
          {/*
            La présence d'une clé côté SERVEUR est connue ici, pas dans le
            composant client : sans elle, le formulaire ne peut pas distinguer
            « aucune clé nulle part » de « clé absente du seul navigateur » — et
            un déploiement avec clé serveur désactiverait le bouton à tort.
          */}
          <FormulaireAmorcage
            objectifMoyenTerme={valeurDeclaree(ctx.donnees.user.objectifMoyenTerme) ?? ""}
            objectifLongTerme={valeurDeclaree(ctx.donnees.user.objectifLongTerme) ?? ""}
            compteId={ctx.donnees.user.id}
            cleServeurConfiguree={choisirConfiguration(process.env).kind !== "aucun"}
            quotaRestant={quota?.restant ?? null}
          />
        </div>
      </Carte>

      {/*
        Le dépôt d'un cours n'a plus sa place au PREMIER écran (25/08/2026).
        Le bandeau « Vous avez déjà un PDF ? » détournait le seul choix que cet
        écran existe pour poser — un axe — vers une action qui en présuppose
        plusieurs (un référentiel, un domaine, un fichier). Le geste reste
        entier dans Mes cours (`?creation=cours`), où il a déjà tout son
        parcours (ADR-129) ; il est rappelé ici, replié, sans concurrencer le
        formulaire.
      */}

      {/*
        Ce qui vient après, dit maintenant plutôt que découvert plus tard —
        mais replié : le tour guidé raconte déjà ce récit, et le formulaire ne
        doit pas le porter deux fois avant toute action. Le wording est
        inchangé ; seul le conteneur change. La ligne sur les PDF de cours vit
        ici depuis le retrait du bandeau : atteignable, pas proposée d'entrée.
      */}
      <details className="group mt-6 rounded-xl border border-bordure bg-surface-2/50 px-5 py-4">
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret transition-colors group-open:text-texte-attenue hover:text-texte-attenue">
            Ensuite — votre premier parcours
          </span>
        </summary>
        <ol className="mt-2.5 space-y-2 text-xs leading-relaxed text-texte-attenue">
          <li>
            <span className="font-medium text-texte">1. Vous retenez un seul axe.</span> Le tuteur
            propose une carte plus large, mais le reste demeure replié. Vous pourrez l&apos;étendre
            plus tard, au fil de votre pratique.
          </li>
          <li>
            <span className="font-medium text-texte">2. Vous passez directement un test express.</span>{" "}
            Un exercice court pose votre premier repère. Vous voyez et validez l&apos;énoncé avant de commencer.
          </li>
          <li>
            <span className="font-medium text-texte">
              3. Le tableau de bord s&apos;ouvre ensuite.
            </span>{" "}
            Il s&apos;appuie déjà sur ce que vous venez de faire, au lieu de vous accueillir par une liste vide.
          </li>
          <li>
            <span className="font-medium text-texte">4. Un cours en PDF trouve sa place après.</span>{" "}
            Quand votre axe est posé, déposez-le depuis Mes cours : le tuteur le lira et proposera
            des séances à relire.
          </li>
        </ol>
      </details>

    </>
  );
}
