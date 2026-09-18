import { expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ contexte: vi.fn(), document: vi.fn(), modifier: vi.fn(), dorsale: vi.fn(), referentiel: vi.fn() }));
vi.mock("./depot-actions", () => ({ lireContexteOrganisationDepotAction: m.contexte }));
vi.mock("./documents", () => ({ lireDocument: m.document, modifierDocument: m.modifier }));
vi.mock("./db", () => ({ dorsaleCompte: m.dorsale }));
vi.mock("./referentiel", () => ({ lireReferentiel: m.referentiel }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { annulerRattachementDelegueAction, rattacherDomaineDelegueAction } from "./delegation-classement-actions";
import { definirChampsFrontMatter, parserFrontMatter } from "@/lib/documents/markdown";
import { lireCreationDomaineDeleguee } from "@/lib/documents/creation-domaine-deleguee";
import { assemblerReferentiel } from "@/lib/domain/referentiel-compte";
import type { Domaine } from "@/lib/domain/types";
import type { DepotDocumentaire } from "@/lib/documents/depot";

// Aucun réseau : les actions et règles métier sont réelles, seuls les ports de
// stockage sont simulés. Le CAS et le journal idempotent sont des hypothèses du
// double, pas une preuve de la transaction PostgreSQL distante.
const original = "---\ntitle: Source intacte\nrole: support\ndepot_version: 2\nsource_relative_path: sources/astronomie.txt\n---\n# Notes personnelles\n\nUne étoile n'est pas une planète.\n";
type Incident = { index: number; moment: "avant" | "apres"; type: "panne" | "humain" };
type Recu = { domaine_id: string; type: string; origine: string };

function environnement(nouveau: boolean, incident?: Incident) {
  let md = original;
  let version = 1;
  let injecte = false;
  let creations = 0;
  const trace: string[] = [];
  const recus = new Map<string, Recu>();
  const domaines: Domaine[] = nouveau ? [] : [{ id: "astronomie", nom: "Astronomie", prefixe: "AST", description: "Étoiles", origine: "utilisateur", archive: false, ordre: 0, version: 1 }];
  domaines.push({ id: "choix-humain", nom: "Autre sujet", prefixe: "AUT", description: "Choix déclaré", origine: "utilisateur", archive: false, ordre: 1, version: 1 });
  const source = { documentId: "doc", citation: "Une étoile n'est pas une planète." };
  const depot: DepotDocumentaire = {
    id: "doc", version: 2, titre: "Source intacte", type: "support", note: "Étoiles",
    creeLe: "2026-09-17", modifieLe: "v1", pieces: [], competencesLiees: [], corrections: [],
    analyses: [{ id: "a", documentId: "doc", empreinte: "source", statut: "terminee", pages: [], couvertures: [], erreur: null,
      creeLe: "2026-09-17", modifieLe: "2026-09-17", restitution: {
        version: 2, modele: "synthetique", creeLe: "2026-09-17", elements: [], couvertures: [],
        organisation: { titreSuggere: "Astronomie", typeSuggere: "cours", justification: "Étoiles", sources: [source], competences: [],
          domaine: nouveau
            ? { mode: "nouveau", nom: "Astronomie", description: "Étoiles", justification: "Étoiles", sources: [source] }
            : { mode: "existant", id: "astronomie", justification: "Étoiles", sources: [source] },
        },
      },
    }],
  };
  const analysesInitiales = structuredClone(depot.analyses);
  const lire = (): DepotDocumentaire => {
    const f = parserFrontMatter(md).frontMatter;
    return structuredClone({ ...depot, modifieLe: `v${version}`, domaineId: f.domaine || undefined,
      rangementOrigine: f.rangement_origine, rangementAnalyseId: f.rangement_analyse_id,
      rangementRevuLe: f.rangement_revu_le, rangementStatut: f.rangement_statut,
      creationDomaineDeleguee: lireCreationDomaineDeleguee(f.classement_creation_deleguee),
    } as DepotDocumentaire);
  };
  function perturber(index: number, moment: Incident["moment"]) {
    if (injecte || incident?.index !== index || incident.moment !== moment) return;
    injecte = true;
    if (incident.type === "panne") throw new Error(`Panne injectée : ${trace[index]} / ${moment}`);
    md = definirChampsFrontMatter(md, { domaine: "choix-humain", rangement_origine: "personne", rangement_analyse_id: "a",
      rangement_revu_le: "2026-09-17T00:00:00.000Z", rangement_statut: "rangee" });
    version++;
  }
  async function operation<T>(nom: string, effet: () => T): Promise<T> {
    const index = trace.push(nom) - 1;
    perturber(index, "avant");
    const resultat = effet();
    perturber(index, "apres");
    return resultat;
  }
  m.contexte.mockImplementation(() => operation("lire-contexte", () => ({ ressources: [lire()], referentiel: {
    compteId: "compte", domaines: structuredClone(domaines.filter((d) => !d.archive)), competences: [],
  } })));
  m.document.mockImplementation(() => operation("lire-document", () => ({ contenuMd: md, updatedAt: `v${version}`, frontmatter: parserFrontMatter(md).frontMatter })));
  m.modifier.mockImplementation((_id: string, contenu: string, _capture: boolean, attendue: string) => operation("ecrire-document", () => {
    if (attendue !== `v${version}`) throw new Error("Conflit CAS");
    md = contenu;
    version++;
    return { updatedAt: `v${version}` };
  }));
  m.referentiel.mockImplementation(() => operation("lire-referentiel", () => assemblerReferentiel(structuredClone(domaines), [])));
  m.dorsale.mockImplementation(() => operation("lire-compte", () => ({ userId: "compte", supabase: {
    from: (table: string) => {
      expect(table).toBe("referentiel_changes");
      let cle = "";
      let compte = "";
      const q = { select: () => q, eq: (champ: string, valeur: string) => {
        if (champ === "request_id") cle = valeur;
        if (champ === "user_id") compte = valeur;
        return q;
      }, maybeSingle: () => operation("lire-recu", () => ({ data: structuredClone(recus.get(`${compte}:${cle}`) ?? null), error: null })) };
      return q;
    },
    rpc: (nom: string, args: { p_request_id: string; p_commande: { domaine: Domaine; competences: unknown[] }; p_origine: string }) => operation("creer-domaine", () => {
      expect(nom).toBe("appliquer_commande_referentiel");
      expect(args.p_origine).toBe("tuteur");
      expect(args.p_commande.competences).toEqual([]);
      const cle = `compte:${args.p_request_id}`;
      if (!recus.has(cle)) {
        const d = args.p_commande.domaine;
        // Un autre request_id ne bénéficie pas du rejeu SQL.
        if (domaines.some((existant) => existant.id === d.id)) throw new Error("Domaine déjà présent");
        domaines.push(structuredClone(d));
        recus.set(cle, { domaine_id: d.id, type: "creer_domaine", origine: "tuteur" });
        creations++;
      }
      return { error: null };
    }),
  } })));
  const verifierSource = () => {
    const parsed = parserFrontMatter(md);
    expect(parsed.corps).toBe(parserFrontMatter(original).corps);
    expect(parsed.frontMatter).toMatchObject(parserFrontMatter(original).frontMatter);
    expect(depot.analyses).toEqual(analysesInitiales);
    expect(lire().competencesLiees).toEqual([]);
    expect(creations).toBeLessThanOrEqual(nouveau ? 1 : 0);
  };
  return { trace, lire, verifierSource, creations: () => creations, injecte: () => injecte,
    rattacher: () => rattacherDomaineDelegueAction("doc", "a", `v${version}`),
    retirer: () => annulerRattachementDelegueAction("doc", "a", `v${version}`),
  };
}

for (const nouveau of [false, true]) {
  for (const type of ["panne", "humain"] as const) {
    it(`${nouveau ? "nouveau domaine" : "domaine existant"} : ${type} avant/après chaque accès, reprise explicite sans perte`, async () => {
      const reference = environnement(nouveau);
      expect((await reference.rattacher()).statut).toBe("rattache");
      const chemin = [...reference.trace];
      console.info(`${nouveau ? "Nouveau domaine" : "Domaine existant"}, ${type} : ${chemin.length * 2} interruptions avant/après les ports.`);
      for (let index = 0; index < chemin.length; index++) {
        for (const moment of ["avant", "apres"] as const) {
          const scenario = `${type} ${moment} ${index}:${chemin[index]}`;
          const env = environnement(nouveau, { index, moment, type });
          // Une erreur ou un retour partiel est recevable ; une reprise demandée
          // explicitement doit ensuite converger, sans rejouer une création acquise.
          await env.rattacher().catch(() => undefined);
          expect(env.injecte(), scenario).toBe(true);
          const resultat = await env.rattacher();
          expect(resultat.statut, scenario).toBe(type === "panne" ? "rattache" : "preserve");
          expect(env.lire().domaineId, scenario).toBe(type === "panne" ? "astronomie" : "choix-humain");
          if (type === "panne") expect(env.creations(), scenario).toBe(nouveau ? 1 : 0);
          env.verifierSource();
          // Les deux gestes suivants éprouvent le refus durable, y compris
          // après la reprise d'une écriture dont la réponse était perdue.
          if (type === "panne") {
            await env.retirer();
            expect((await env.rattacher()).statut, scenario).toBe("preserve");
            expect(env.lire().domaineId, scenario).toBeUndefined();
            env.verifierSource();
          }
        }
      }
    });
  }
}
