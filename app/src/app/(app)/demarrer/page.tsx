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

  const [ctx, admin] = await Promise.all([chargerContexte(), estAdministrateur()]);
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
        sousTitre="Écrivez ce que vous voulez pouvoir faire. Nous le traduisons en exercices."
      />

      {/*
        Le tutoriel est proposé ici, pas imposé avant : quelqu'un qui sait déjà
        ce qu'il veut travailler ne doit pas traverser une page d'explications
        pour commencer. Le lien reste au-dessus du formulaire pour rester vu.
      */}
      <p className="mb-4 px-1 text-xs text-texte-attenue">
        Première visite ?{" "}
        <Link href="/aide" className="font-medium text-primaire underline underline-offset-2">
          Lis d&apos;abord comment ça marche
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
          />
        </div>
      </Carte>

      {/*
        Ce qui vient après, dit maintenant plutôt que découvert plus tard —
        mais replié : le tour guidé raconte déjà ce récit, et le formulaire ne
        doit pas le porter deux fois avant toute action. Le wording est
        inchangé ; seul le conteneur change.
      */}
      <details className="group mt-6 rounded-xl border border-bordure bg-surface-2/50 px-5 py-4">
        <summary className="cursor-pointer list-none marker:hidden">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret transition-colors group-open:text-texte-attenue hover:text-texte-attenue">
            Ensuite — ce qui se passe après la génération
          </span>
        </summary>
        <ol className="mt-2.5 space-y-2 text-xs leading-relaxed text-texte-attenue">
          <li>
            <span className="font-medium text-texte">1. Tu relis la proposition.</span> Le tuteur
            découpe le sujet en compétences mesurables ; tu décoches ce qui ne te concerne pas.
            Rien n&apos;est enregistré avant ta validation.
          </li>
          <li>
            <span className="font-medium text-texte">2. Le tableau de bord te propose une action.</span>{" "}
            Une seule — celle qui produira la prochaine observation.
          </li>
          <li>
            <span className="font-medium text-texte">
              3. Pour tout le reste, le bouton <span className="font-mono">+</span>.
            </span>{" "}
            Tu y écris ce dont tu as besoin, en une phrase, et le système choisit quoi faire :
            s&apos;entraîner, produire, déposer une ressource, ou étendre ton référentiel. Tu n&apos;as
            jamais à choisir quel objet créer.
          </li>
        </ol>
      </details>

      <p className="mt-4 px-1 text-xs text-texte-attenue">
        Rien n&apos;est figé : le référentiel se modifie, s&apos;étend et se réduit à tout moment
        depuis l&apos;<span className="font-medium">Atelier</span>.
      </p>
    </>
  );
}
