import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extraireSectionsEpub } from "./extraction-epub";

const container = '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="Livre/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
const paquet = '<package xmlns="http://www.idpf.org/2007/opf"><manifest><item id="a" href="texte/a.xhtml" media-type="application/xhtml+xml"/><item id="b" href="texte/b.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="b"/><itemref idref="a"/></spine></package>';
const html = (texte: string, titre = "Chapitre") => `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${titre}</title></head><body>${texte}</body></html>`;
function epub(changements: Record<string, string | null> = {}) {
  const fichiers: Record<string, string> = { mimetype: "application/epub+zip", "META-INF/container.xml": container, "Livre/package.opf": paquet, "Livre/texte/a.xhtml": html("<p>Premier fichier</p>", "A"), "Livre/texte/b.xhtml": html("<p>Second fichier</p>", "B") };
  for (const [nom, contenu] of Object.entries(changements)) { if (contenu === null) delete fichiers[nom]; else fichiers[nom] = contenu; }
  return zipSync(Object.fromEntries(Object.entries(fichiers).map(([nom, contenu]) => [nom, strToU8(contenu)])));
}

describe("extraction EPUB locale et bornée", () => {
  it("suit le spine, conserve titre/chemin et ne fabrique aucune pagination", () => {
    const resultat = extraireSectionsEpub(epub());
    expect(resultat).toEqual([
      { section: { chemin: "Livre/texte/b.xhtml", titre: "B" }, texte: "Second fichier", incertain: false },
      { section: { chemin: "Livre/texte/a.xhtml", titre: "A" }, texte: "Premier fichier", incertain: false },
    ]);
    expect(resultat.every((s) => !("page" in s))).toBe(true);
  });
  it("décode les entités et préserve ordre des fragments inline et paragraphes", () => {
    const resultat = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html("<p>Le <em>texte</em> &amp; ses &#233;léments.</p><p>Suite.</p><script>ne pas exécuter</script><style>p{color:red}</style>") }));
    expect(resultat[0].texte).toBe("Le texte & ses éléments.\n\nSuite.");
  });
  it("un séparateur horizontal empêche la fusion de deux mots", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html("A<hr/>B") }));
    expect(section.texte).toBe("A\n\nB");
  });
  it("signale les illustrations sans charger leur URL ni inventer leur contenu", () => {
    const resultat = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<p>Observation.</p><img src="https://exemple.invalid/photo.png" alt="citation inventée"/><math><mi>x</mi></math>') }));
    expect(resultat[0].texte).toBe("Observation.");
    expect(resultat[0].incertain).toBe(true);
    expect(resultat[0].section.limites?.[0]).toMatch(/non analysés/);
  });
  it("garde une section purement graphique comme absence de texte, jamais preuve de lecture complète", () => {
    const resultat = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<svg><text>Figure</text></svg>') }));
    expect(resultat[0].texte).toBe("");
    expect(resultat[0].section.limites).toHaveLength(2);
    expect(resultat[0].incertain).toBe(true);
  });
  it.each([
    ["mimetype", "application/zip", /type déclaré/],
    ["META-INF/container.xml", null, /absente/],
    ["Livre/texte/b.xhtml", null, /absente/],
    ["Livre/texte/b.xhtml", "<html><body><p>texte</body></html>", /XML/],
    ["META-INF/encryption.xml", "<encryption/>", /chiffrées/],
    ["../ailleurs", "attaque", /chemin/],
    ["/absolu", "attaque", /chemin/],
    ["Livre\\fichier", "attaque", /chemin/],
    ["Livre/texte/b.xhtml", '<!DOCTYPE html [<!ENTITY x "répétition">]><html><body>&x;</body></html>', /entités/],
    ["Livre/texte/b.xhtml", html("x".repeat(50_001)), /50 000/],
    ["Livre/texte/b.xhtml", html("x".repeat(1_000_001)), /limite|volumineux/],
  ] as const)("refuse une archive invalide ou hostile : %s", (nom, contenu, erreur) => {
    expect(() => extraireSectionsEpub(epub({ [nom]: contenu }))).toThrow(erreur);
  });
  it.each(["https://exemple.invalid/texte.xhtml", "../../../secret.xhtml", "%2Fsecret.xhtml", "%2e%2e/%2e%2e/secret.xhtml"])("refuse un lien de section sortant : %s", (href) => {
    expect(() => extraireSectionsEpub(epub({ "Livre/package.opf": paquet.replace("texte/b.xhtml", href) }))).toThrow(/externe|chemin|Chemin/);
  });
  it("accepte un chemin relatif interne légitime", () => {
    expect(extraireSectionsEpub(epub({ "Livre/package.opf": paquet.replace("texte/b.xhtml", "texte/../texte/b.xhtml") }))[0].texte).toBe("Second fichier");
  });
  it("refuse une archive tronquée avant décompression", () => {
    const archive = epub();
    expect(() => extraireSectionsEpub(archive.slice(0, -10))).toThrow(/incomplète/);
  });
  it("borne la sortie décompressée même si les tailles ZIP déclarées mentent", () => {
    const archive = epub({ "Livre/texte/b.xhtml": html("x".repeat(1_100_000)) });
    const vue = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
    for (let i = 0; i < archive.length - 46; i++) {
      if (vue.getUint32(i, true) === 0x04034b50) vue.setUint32(i + 22, 1, true);
      if (vue.getUint32(i, true) === 0x02014b50) vue.setUint32(i + 24, 1, true);
    }
    expect(() => extraireSectionsEpub(archive)).toThrow(/volumineux|Décompression/);
  });
  it("refuse le marqueur de chiffrement ZIP avant traitement", () => {
    const archive = epub();
    new DataView(archive.buffer, archive.byteOffset, archive.byteLength).setUint16(6, 1, true);
    expect(() => extraireSectionsEpub(archive)).toThrow(/chiffrées/);
  });
  it("ne transforme pas un exposant en chiffre ordinaire", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html("<p>x<sup>2</sup> et H<sub>2</sub>O</p>") }));
    expect(section.texte).toBe("x^{2} et H_{2}O");
    expect(section.incertain).toBe(true);
    expect(section.section.limites?.[0]).toMatch(/Exposants/);
  });
  it("refuse les entrées dont le nom local est dupliqué", () => {
    const archive = epub();
    // Remplace le nom a.xhtml par b.xhtml dans en-têtes local et central.
    const nom = strToU8("Livre/texte/a.xhtml");
    for (let i = 0; i <= archive.length - nom.length; i++) {
      if (nom.every((v, n) => archive[i + n] === v)) archive[i + 12] = "b".charCodeAt(0);
    }
    expect(() => extraireSectionsEpub(archive)).toThrow(/répétées/);
  });
  it("refuse un spine répété ou des identifiants ambigus", () => {
    expect(() => extraireSectionsEpub(epub({ "Livre/package.opf": paquet.replace('idref="a"', 'idref="b"') }))).toThrow(/répété/);
    expect(() => extraireSectionsEpub(epub({ "Livre/package.opf": paquet.replace('id="a"', 'id="b"') }))).toThrow(/répété/);
  });
  it("refuse une profondeur XML excessive et les structures trop nombreuses", () => {
    expect(() => extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html("<div>".repeat(102) + "Texte" + "</div>".repeat(102)) }))).toThrow(/profonde/);
    expect(() => extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html("<br/>".repeat(40001)) }))).toThrow(/complexe/);
  });
  it("refuse une section dont le format EPUB annoncé est SVG plutôt que XHTML", () => {
    expect(() => extraireSectionsEpub(epub({ "Livre/package.opf": paquet.replaceAll("application/xhtml+xml", "image/svg+xml") }))).toThrow(/XHTML/);
  });
});
