import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { extraireSectionsEpub, MAX_TEXTE_SECTION_EPUB, VERSION_EXTRACTION_EPUB } from "./extraction-epub";

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
    expect(resultat[0].texte).toBe("Observation.\nx");
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
  it.each(["x".repeat(120_001), "é🙂".repeat(20_000), ("Une phrase.\n\n".repeat(6_000)).trim()])("découpe sans perte ni caractère UTF-8 coupé", (texte) => {
    const archive = epub({ "Livre/texte/b.xhtml": html(texte, "T".repeat(200)) });
    const extraits = extraireSectionsEpub(archive).filter((s) => s.section.chemin === "Livre/texte/b.xhtml");
    expect(extraits.length).toBeGreaterThan(1);
    expect(extraits.map((s) => s.texte).join("")).toBe(texte);
    expect(extraits.every((s) => Buffer.byteLength(s.texte) <= MAX_TEXTE_SECTION_EPUB)).toBe(true);
    expect(extraits.every((s, i) => s.section.titre.endsWith(`Partie ${i + 1}/${extraits.length}`) && s.section.titre.length <= 200)).toBe(true);
    expect(extraireSectionsEpub(archive)).toEqual(extraireSectionsEpub(archive));
    expect(VERSION_EXTRACTION_EPUB).not.toBe("epub-texte-spine-v1");
  });
  it("préserve les positions définies par une feuille CSS locale déclarée", () => {
    const [section] = extraireSectionsEpub(epub({
      "Livre/package.opf": paquet.replace("</manifest>", '<item id="css" href="styles.css" media-type="text/css"/></manifest>'),
      "Livre/styles.css": "span.indice{vertical-align:sub} .exposant{vertical-align:super} .haut{font-size:.7em;vertical-align:top}",
      "Livre/texte/b.xhtml": html('<p>x<span class="indice">i</span> + y<span class="exposant">2</span> + z<span class="haut">3</span></p>').replace("</head>", '<link rel="stylesheet" href="../styles.css"/></head>'),
    }));
    expect(section.texte).toBe("x_{i} + y^{2} + z[position CSS top : 3]");
    expect(section.incertain).toBe(true);
    expect(section.section.limites?.join(" ")).toContain("sans lui attribuer une signification");
  });
  it("n'infère aucune position du nom de classe et respecte les styles inline", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<p>x<span class="exposant">2</span> y<span style="vertical-align:super">3</span></p>') }));
    expect(section.texte).toBe("x2 y^{3}");
  });
  it("une valeur CSS invalide après super ne prétend pas rétablir la ligne de base", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<p>x<span style="vertical-align:super;vertical-align:normal">2</span></p>') }));
    expect(section.texte).toContain("position CSS normal");
    expect(section.incertain).toBe(true);
    expect(section.texte).not.toBe("x2");
  });
  it("ignore l'alignement des cellules et blocs sans perdre le texte ni les séparateurs", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<div style="vertical-align:top">Titre</div><table><tr><td style="vertical-align:top">A</td><td style="vertical-align:top">x<span style="vertical-align:top">2</span></td></tr></table>') }));
    expect(section.texte).toBe("Titre\n\nA x[position CSS top : 2]");
    expect(section.texte.match(/position CSS top/g)).toHaveLength(1);
  });
  it("signale un style externe sans le charger ni suivre un import CSS", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<p>x<span class="a">2</span></p>').replace("</head>", '<style>@import url("https://example.invalid/x.css"); .a { vertical-align:super }</style><link rel="stylesheet" href="../../../../secret.css"/></head>') }));
    expect(section.texte).toContain("position CSS incertaine");
    expect(section.section.limites?.join(" ")).toMatch(/externe/);
  });
  it("conserve les fractions, indices et accents MathML sans alttext inventé", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<math alttext="ne pas substituer"><mfrac><msub><mi>x</mi><mi>i</mi></msub><msup><mi>y</mi><mn>2</mn></msup></mfrac><mover><mi>R</mi><mo>^</mo></mover></math>') }));
    expect(section.texte).toBe("frac{{x}_{i}}{{y}^{2}} overset{^}{R}");
    expect(section.incertain).toBe(true);
  });
  it("ne restitue pas une expression partielle comme si elle était complète", () => {
    const [section] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('Avant<math><mi>x</mi><maction><mi>y</mi></maction></math>après') }));
    expect(section.texte).toBe("Avant [expression MathML non transcrite] après");
    expect(section.section.limites?.join(" ")).toContain("non prise en charge");
  });
  it("un marqueur d'omission seul n'est jamais du texte source payable", () => {
    const [vide] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<math><maction><mi>x</mi></maction></math>') }));
    expect(vide.texte).toBe("");
    expect(vide.section.limites?.join(" ")).toContain("aucun texte extractible");
    const litteral = "[expression MathML non transcrite]";
    const [source] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html(`<p>${litteral}</p>`) }));
    expect(source.texte).toBe(litteral);
    const [lisible] = extraireSectionsEpub(epub({ "Livre/texte/b.xhtml": html('<math><mi>x</mi></math>') }));
    expect(lisible.texte).toBe("x");
  });
  it("borne le total décompressé même avec des sections découpables", () => {
    const fichiers: Record<string, string> = {};
    const items: string[] = [], spine: string[] = [];
    for (let i = 0; i < 9; i++) { fichiers[`Livre/${i}.xhtml`] = html("x".repeat(950_000)); items.push(`<item id="s${i}" href="${i}.xhtml" media-type="application/xhtml+xml"/>`); spine.push(`<itemref idref="s${i}"/>`); }
    fichiers["Livre/package.opf"] = `<package><manifest>${items.join("")}</manifest><spine>${spine.join("")}</spine></package>`;
    expect(() => extraireSectionsEpub(epub(fichiers))).toThrow(/volumineux|Décompression/);
  });
});
