import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { ChatInput } from "./chat-input";

/** Exécute les fonctions réelles avec leurs ports simulés, sans DOM ajouté.
 * Vérifie l'ordre synchrone/asynchrone ; ne prétend pas tester les effets React. */
function fonctionUI(fichier: string, nom: string, contexte: Record<string, unknown>) {
  const contenu = readFileSync(new URL(fichier, import.meta.url), "utf8");
  const source = ts.createSourceFile(fichier, contenu, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fonctions: ts.FunctionDeclaration[] = [];
  function visiter(noeud: ts.Node) {
    if (ts.isFunctionDeclaration(noeud) && noeud.name?.text === nom) fonctions.push(noeud);
    ts.forEachChild(noeud, visiter);
  }
  visiter(source);
  const fonction = fonctions[0];
  if (!fonction) throw new Error(`Fonction ${nom} absente de ${fichier}`);
  const js = ts.transpileModule(fonction.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return runInNewContext(`${js}\n${nom};`, contexte) as (...args: unknown[]) => Promise<void>;
}

function portsDepot(envoyer: () => Promise<boolean>) {
  const verrouDepot = { current: false };
  return {
    bloque: false, verrouEnvoi: { current: false }, saisie: "Une pensée à conserver", organiserTexte: true,
    onDepotConserve: vi.fn(), pieces: { fichiers: [], envoyer: vi.fn(envoyer) }, depotBloque: false, cleAbsente: true,
    accordDepot: { current: undefined }, autorisation: { fournisseur: "mistral", coutMaximum: 1 },
    onEtatDepot: vi.fn((occupe: boolean) => { verrouDepot.current = occupe; }), verrouDepot,
    onEnvoyer: vi.fn(), setSaisie: vi.fn(), setOrganiserTexte: vi.fn(),
  };
}

describe("ChatInput", () => {
  it("verrouille le changement de conversation avant d'attendre le dépôt texte", async () => {
    let terminer!: (valeur: boolean) => void;
    const ports = portsDepot(() => new Promise<boolean>((resolve) => { terminer = resolve; }));
    const soumettre = fonctionUI("./chat-input.tsx", "soumettre", ports);
    const enCours = soumettre();
    expect(ports.onEtatDepot.mock.calls).toEqual([[true]]);
    expect(ports.onEtatDepot.mock.invocationCallOrder[0]).toBeLessThan(ports.pieces.envoyer.mock.invocationCallOrder[0]);
    const ecrireSession = vi.fn();
    const changer = fonctionUI("./chat.tsx", "changerConversationDocumentaire", {
      enCours: false, envoiEnAttente: null, verrouDepot: ports.verrouDepot, ecrireSession,
    });
    await changer({ id: "autre-document" });
    expect(ecrireSession).not.toHaveBeenCalled();
    expect(ports.setSaisie).not.toHaveBeenCalled();
    terminer(true);
    await enCours;
    expect(ports.onEtatDepot.mock.calls).toEqual([[true], [false]]);
    expect(ports.setSaisie).toHaveBeenCalledWith("");
    expect(ports.setOrganiserTexte).toHaveBeenCalledWith(false);
    expect(ports.onEnvoyer).not.toHaveBeenCalled();
  });

  it("libère le verrou en cas d'échec sans effacer la note ni la convertir en message", async () => {
    const ports = portsDepot(async () => { throw new Error("Dépôt interrompu"); });
    const soumettre = fonctionUI("./chat-input.tsx", "soumettre", ports);
    await expect(soumettre()).rejects.toThrow("Dépôt interrompu");
    expect(ports.onEtatDepot.mock.calls).toEqual([[true], [false]]);
    expect(ports.verrouDepot.current).toBe(false);
    expect(ports.verrouEnvoi.current).toBe(false);
    expect(ports.setSaisie).not.toHaveBeenCalled();
    expect(ports.setOrganiserTexte).not.toHaveBeenCalled();
    expect(ports.onEnvoyer).not.toHaveBeenCalled();
  });

  it("présente les pièces jointes et le texte dans la même saisie, sans destination de dépôt", () => {
    const html = renderToStaticMarkup(createElement(ChatInput, {
      onEnvoyer: vi.fn(), onDepotConserve: vi.fn(), onArreter: vi.fn(),
      enCours: false, cleAbsente: true, usage: null, saisieInitiale: "",
    }));
    expect(html).toContain("Joindre");
    expect(html).toContain("Joindre un dossier");
    expect(html).toContain('type="file"');
    expect(html).toContain("glissez vos cours");
    expect(html).not.toContain("nouveau=1");
  });
  it("édite les formules dans une zone composée et accessible", () => {
    const html = renderToStaticMarkup(
      createElement(ChatInput, {
        onEnvoyer: vi.fn(),
        onArreter: vi.fn(),
        onCopier: vi.fn(),
        copieSecours: false,
        enCours: false,
        cleAbsente: false,
        usage: null,
        saisieInitiale: "Calculer \\(\\div \\)",
      }),
    );

    expect(html).toContain('role="textbox"');
    expect(html).toContain('aria-label="Message à envoyer au tuteur"');
    expect(html).toContain('contentEditable="true"');
    expect(html).toContain("min-h-24");
    expect(html).not.toContain("min-h-full");
    expect(html).not.toContain("<textarea");
  });
});
