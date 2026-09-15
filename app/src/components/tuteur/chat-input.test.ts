import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

describe("ChatInput", () => {
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
