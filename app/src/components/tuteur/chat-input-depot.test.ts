import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("./pieces-conversation",()=>({usePiecesConversation:()=>({fichiers:[{relatif:"Cours.pdf"}],occupe:false,survol:false,interfacePieces:()=>null,liste:null,envoyer:vi.fn(),deposer:vi.fn(),setSurvol:vi.fn()})}));
import { ChatInput } from "./chat-input";

it("réunit le consentement fournisseur et le dépôt en une action explicite",()=>{
  const html=renderToStaticMarkup(createElement(ChatInput,{onEnvoyer:vi.fn(),onDepotConserve:vi.fn(),onArreter:vi.fn(),enCours:false,cleAbsente:true,usage:null,saisieInitiale:"",fournisseurDocumentaire:"mistral"}));
  expect(html).toContain("Préparer ma proposition");
  expect(html).toContain("Mistral");expect(html).toContain("20 premières pages");
  expect(html).toContain("0,583");
  expect(html).not.toContain("Autoriser et analyser");
  expect(html).not.toContain("type=\"checkbox\"");
});
