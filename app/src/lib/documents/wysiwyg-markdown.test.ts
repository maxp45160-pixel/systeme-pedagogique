import { describe, expect, it } from "vitest";
import {
  separerFrontMatterEtCorps,
  recomposerDocumentComplet,
  formaterEnLigneVersHtml,
  markdownVersHtml,
  detecterEtatFormatage,
  ETAT_FORMATAGE_DEFAUT,
} from "./wysiwyg-markdown";

describe("wysiwyg-markdown", () => {
  it("sépare proprement le front-matter YAML et le corps", () => {
    const markdown = `---
type: preuve
id: preuve-123
competencies:
  - AMS-01
---

## Titre du document

Voici un paragraphe d'explication.`;

    const { frontmatterBrut, corps } = separerFrontMatterEtCorps(markdown);
    expect(frontmatterBrut).toBe(`---
type: preuve
id: preuve-123
competencies:
  - AMS-01
---`);
    expect(corps).toBe(`## Titre du document\n\nVoici un paragraphe d'explication.`);
  });

  it("gère l'absence de frontmatter sans altérer le texte", () => {
    const { frontmatterBrut, corps } = separerFrontMatterEtCorps("Un texte simple.");
    expect(frontmatterBrut).toBe("");
    expect(corps).toBe("Un texte simple.");
  });

  it("recompose fidèlement le document avec son frontmatter d'origine", () => {
    const front = `---\ntype: note\nid: note-1\n---`;
    const corps = `## Nouveau contenu\n\nTexte modifié.`;
    const recompose = recomposerDocumentComplet(front, corps);
    expect(recompose).toBe(`---\ntype: note\nid: note-1\n---\n\n## Nouveau contenu\n\nTexte modifié.`);
  });

  it("formate les styles en ligne (gras, italique, wikiliens, code)", () => {
    const ligne = "Un mot **important**, un autre *discret*, du `code` et un lien [[AMS-01|Gestion du stress]].";
    const html = formaterEnLigneVersHtml(ligne);
    expect(html).toContain("<strong>important</strong>");
    expect(html).toContain("<em>discret</em>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain('data-wikilien="AMS-01"');
    expect(html).toContain("[[Gestion du stress]]");
  });

  it("convertit un document Markdown complet en HTML structuré pour contenteditable", () => {
    const md = `## Section 1
Un paragraphe avec **du gras**.

- Premier élément
- Second élément

> Une citation importante.`;

    const html = markdownVersHtml(md);
    expect(html).toContain("<h2>Section 1</h2>");
    expect(html).toContain("<p>Un paragraphe avec <strong>du gras</strong>.</p>");
    expect(html).toContain("<ul><li>Premier élément</li><li>Second élément</li></ul>");
    expect(html).toContain("<blockquote>Une citation importante.</blockquote>");
  });

  it("gère l'état de formatage par défaut sans environnement DOM actif", () => {
    const etat = detecterEtatFormatage(null);
    expect(etat).toEqual(ETAT_FORMATAGE_DEFAUT);
    expect(etat.bold).toBe(false);
    expect(etat.italic).toBe(false);
    expect(etat.h2).toBe(false);
  });
});
