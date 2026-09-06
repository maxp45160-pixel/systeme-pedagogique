import { describe, expect, it } from "vitest";
import { depuisDepotGlisse, depuisSelection, fusionnerImports, nomImport, type FichierImport } from "./import-depot";

function fichier(nom: string, taille = 10): FichierImport {
  return { fichier: { name: nom.split("/").at(-1)!, size: taille, type: "", lastModified: 1 } as File, relatif: nom };
}
function entree(nom: string): FileSystemEntry {
  return { name: nom, isFile: true, isDirectory: false, file: (ok: (f: File) => void) => ok(fichier(nom).fichier) } as unknown as FileSystemEntry;
}
function dossier(nom: string, lots: FileSystemEntry[][]): FileSystemEntry {
  return { name: nom, isFile: false, isDirectory: true, createReader: () => {
    let i = 0;
    return { readEntries: (ok: (e: FileSystemEntry[]) => void) => ok(lots[i++] ?? []) };
  } } as unknown as FileSystemEntry;
}
describe("import cumulatif de documents", () => {
  it("ajoute plusieurs sélections sans remplacer les précédentes", () => {
    const premier = fusionnerImports([], [fichier("a.pdf"), fichier("b.pdf")]);
    expect(fusionnerImports(premier.fichiers, [fichier("c.pdf")]).fichiers.map(f => f.relatif)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });
  it("ignore une resélection identique mais conserve les homonymes de deux dossiers", () => {
    const a = fichier("Cours/a.pdf");
    expect(fusionnerImports([a], [a, fichier("Notes/a.pdf")]).fichiers).toHaveLength(2);
  });
  it("signale chaque refus sans perdre les fichiers valides", () => {
    const initial = [fichier("a.pdf")];
    const r = fusionnerImports(initial, [fichier("b.txt"), fichier("gros.pdf", 11 * 1024 * 1024), fichier("photo.webp")]);
    expect(r.refuses).toHaveLength(2);
    expect(r.fichiers.map(f => f.relatif)).toEqual(["a.pdf", "photo.webp"]);
    expect(initial).toHaveLength(1);
  });
  it("compte les fichiers déjà conservés dans le plafond de cent", () => {
    const r = fusionnerImports([], [fichier("a.pdf"), fichier("b.pdf")], 99);
    expect(r.fichiers).toHaveLength(1);
    expect(r.refuses).toHaveLength(1);
  });
  it("compte les octets déjà conservés dans le plafond de cent Mio", () => {
    const r = fusionnerImports([], [fichier("a.pdf", 1024 * 1024), fichier("b.pdf", 1)], 10, 99 * 1024 * 1024);
    expect(r.fichiers).toHaveLength(1);
    expect(r.refuses).toHaveLength(1);
  });
  it("conserve le chemin sélectionné dans un libellé plat", () => {
    const f = { ...fichier("a.pdf").fichier, webkitRelativePath: "Cours/Chapitre/a.pdf" } as File;
    expect(nomImport(depuisSelection([f])[0])).toBe("Cours · Chapitre · a.pdf");
    expect(nomImport(fichier("x".repeat(200) + "/a.pdf"))).toHaveLength(160);
  });
  it("parcourt les sous-dossiers et toutes les fournées du navigateur", async () => {
    const racine = dossier("Cours", [Array.from({ length: 100 }, (_, i) => entree(`${i}.pdf`)), [dossier("Chapitre", [[entree("suite.pdf")]])]]);
    const data = { items: [{ kind: "file", webkitGetAsEntry: () => racine, getAsFile: () => null }], files: [] } as unknown as DataTransfer;
    const r = await depuisDepotGlisse(data);
    expect(r).toHaveLength(101);
    expect(r[100].relatif).toBe("Cours/Chapitre/suite.pdf");
  });
  it("préserve aussi un fichier sans entrée de dossier dans un dépôt mixte", async () => {
    const f = fichier("photo.png").fichier;
    const data = { items: [
      { kind: "file", webkitGetAsEntry: () => dossier("Cours", [[entree("a.pdf")]]), getAsFile: () => null },
      { kind: "file", getAsFile: () => f },
    ], files: [f] } as unknown as DataTransfer;
    expect((await depuisDepotGlisse(data)).map(f => f.relatif)).toEqual(["Cours/a.pdf", "photo.png"]);
  });
  it("utilise la liste de fichiers quand les entrées ne sont pas disponibles", async () => {
    const f = fichier("a.pdf").fichier;
    expect(await depuisDepotGlisse({ items: [], files: [f] } as unknown as DataTransfer)).toEqual([{ fichier: f, relatif: "a.pdf" }]);
  });
});
