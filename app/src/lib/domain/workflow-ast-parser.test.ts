import { describe, expect, it } from "vitest";
import {
  analyserFichierSourceAst,
  resoudreNavigationPartagee,
  resoudreSurfacesPartagees,
  type FichierAstAnalyse,
} from "./workflow-ast-parser";

/*
 * Ce que ce fichier protège :
 *
 *  1. `resoudreNavigationPartagee` retrouve les destinations du rail et de la
 *     barre mobile — y compris les `href` déclarés en données (tableaux
 *     d'objets), que l'analyse JSX seule ne voit pas.
 *  2. Elle n'attribue la navigation persistante qu'aux pages enveloppées par
 *     le layout (dossier), et ignore les `redirect` de garde (`/login`).
 *  3. `resoudreSurfacesPartagees` retrouve les modales et tiroirs montés par
 *     le cadre partagé (tuteur flottant, point d'entrée `+`), là aussi par
 *     imports transitifs du layout.
 */

function analyser(relatif: string, contenu: string): FichierAstAnalyse {
  return analyserFichierSourceAst("", relatif, contenu);
}

function analysesDeBase(): Map<string, FichierAstAnalyse> {
  const navigation = analyser(
    "components/layout/navigation.ts",
    `
export const NAVIGATION = [
  { href: "/progression", libelle: "Progression" },
  { href: "/atelier", libelle: "Atelier" },
  { href: "/seances", libelle: "Cahier" },
  { href: "/aide", libelle: "Aide" },
];
`,
  );

  const sidebar = analyser(
    "components/layout/sidebar.tsx",
    `
import Link from "next/link";
import { navigationPour } from "./navigation";
export function Sidebar() {
  return (
    <nav>
      {navigationPour(false).map((e) => (
        <Link key={e.href} href={e.href}>{e.libelle}</Link>
      ))}
      <Link href="/compte">Compte</Link>
    </nav>
  );
}
`,
  );

  const layout = analyser(
    "app/(app)/layout.tsx",
    `
import { Sidebar } from "@/components/layout/sidebar";
import { redirect } from "next/navigation";
export default async function Layout() {
  const compte = await lireCompte();
  if (!compte) redirect("/login");
  return <Sidebar />;
}
`,
  );

  const analyses = new Map<string, FichierAstAnalyse>();
  analyses.set("components/layout/navigation.ts", navigation);
  analyses.set("components/layout/sidebar.tsx", sidebar);
  analyses.set("app/(app)/layout.tsx", layout);
  return analyses;
}

describe("resoudreNavigationPartagee", () => {
  it("retrouve les destinations du rail, y compris les href déclarés en données", () => {
    const resultat = resoudreNavigationPartagee(analysesDeBase());

    const cibles = resultat.get("app/(app)");
    expect(cibles).toBeDefined();
    expect(cibles).toContain("/progression");
    expect(cibles).toContain("/atelier");
    expect(cibles).toContain("/seances");
    expect(cibles).toContain("/aide");
    expect(cibles).toContain("/compte");
  });

  it("ignore les redirect de garde du layout (login/suspendu)", () => {
    const resultat = resoudreNavigationPartagee(analysesDeBase());
    const cibles = resultat.get("app/(app)");
    expect(cibles).not.toContain("/login");
  });

  it("ne couvre que les pages enveloppées par le layout", () => {
    const resultat = resoudreNavigationPartagee(analysesDeBase());
    expect(resultat.has("app/(app)")).toBe(true);
    // Un layout hors app (inexistant ici) ne produit rien, et un fichier
    // non-layout n'est pas traité comme un dossier de navigation partagée.
    expect(resultat.has("components/layout")).toBe(false);
  });
});

describe("resoudreSurfacesPartagees", () => {
  it("retrouve le tiroir flottant du tuteur monté par le layout", () => {
    const tiroir = analyser(
      "components/tuteur/tiroir-tuteur.tsx",
      `export function TiroirTuteur() { return <Tiroir />; }`,
    );

    const layout = analyser(
      "app/(app)/layout.tsx",
      `
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
export default async function Layout() {
  return <TiroirTuteur />;
}
`,
    );

    const analyses = new Map<string, FichierAstAnalyse>();
    analyses.set("components/tuteur/tiroir-tuteur.tsx", tiroir);
    analyses.set("app/(app)/layout.tsx", layout);

    const resultat = resoudreSurfacesPartagees(analyses);
    expect(resultat.get("app/(app)")).toContain("tiroir:tuteur");
  });

  it("retrouve une modale ouverte par le point d'entrée du rail", () => {
    const capture = analyser(
      "components/intention/capture-intention.tsx",
      `<Modale titre="De quoi as-tu besoin ?" />`,
    );

    const contexte = analyser(
      "components/intention/contexte-intention.tsx",
      `import { CaptureIntention } from "./capture-intention";
export function FournisseurIntention() { return <CaptureIntention />; }`,
    );

    const layout = analyser(
      "app/(app)/layout.tsx",
      `
import { FournisseurIntention } from "@/components/intention/contexte-intention";
export default async function Layout() {
  return <FournisseurIntention />;
}
`,
    );

    const analyses = new Map<string, FichierAstAnalyse>();
    analyses.set("components/intention/capture-intention.tsx", capture);
    analyses.set("components/intention/contexte-intention.tsx", contexte);
    analyses.set("app/(app)/layout.tsx", layout);

    const resultat = resoudreSurfacesPartagees(analyses);
    expect(resultat.get("app/(app)")).toContain("modal:de-quoi-as-tu-besoin");
  });

  it("ne rattache rien quand le layout ne monte aucune surface", () => {
    const layout = analyser(
      "app/(app)/layout.tsx",
      `export default function Layout() { return <div />; }`,
    );

    const analyses = new Map<string, FichierAstAnalyse>();
    analyses.set("app/(app)/layout.tsx", layout);

    const resultat = resoudreSurfacesPartagees(analyses);
    expect(resultat.size).toBe(0);
  });

  it("n'expose pas les modales imbriquées dans un tiroir du cadre", () => {
    const modaleCompetence = analyser(
      "components/referentiel/modale-competence.tsx",
      `export function ModaleCompetence() { return <Modale />; }`,
    );

    const chat = analyser(
      "components/tuteur/chat.tsx",
      `import { ModaleCompetence } from "@/components/referentiel/modale-competence";
export function Chat() { return <ModaleCompetence />; }`,
    );

    const tiroir = analyser(
      "components/tuteur/tiroir-tuteur.tsx",
      `import { Chat } from "./chat";
export function TiroirTuteur() { return <Tiroir>{Chat}</Tiroir>; }`,
    );

    const layout = analyser(
      "app/(app)/layout.tsx",
      `
import { TiroirTuteur } from "@/components/tuteur/tiroir-tuteur";
export default async function Layout() {
  return <TiroirTuteur />;
}
`,
    );

    const analyses = new Map<string, FichierAstAnalyse>();
    analyses.set("components/referentiel/modale-competence.tsx", modaleCompetence);
    analyses.set("components/tuteur/chat.tsx", chat);
    analyses.set("components/tuteur/tiroir-tuteur.tsx", tiroir);
    analyses.set("app/(app)/layout.tsx", layout);

    const resultat = resoudreSurfacesPartagees(analyses);
    expect(resultat.get("app/(app)")).toContain("tiroir:tuteur");
    expect(resultat.get("app/(app)")).not.toContain("modal:competence");
  });
});