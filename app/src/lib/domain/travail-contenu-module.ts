import type { InterventionSeance, InterventionType } from "./intervention-seance";

export const TYPES_CONTENU_MODULE_TRAVAILLABLES = [
  "cours",
  "cours-ecrit",
  "note",
  "definition",
  "exercice-donne",
  "devoir",
] as const;

export type TypeContenuModuleTravaillable = typeof TYPES_CONTENU_MODULE_TRAVAILLABLES[number];

export interface GesteContenuModule {
  type: InterventionType;
  libelle: string;
}

const GESTES_PAR_TYPE = {
  cours: [
    { type: "read", libelle: "Lire" },
    { type: "synthesize", libelle: "Synthétiser" },
    { type: "recall", libelle: "Rappeler" },
    { type: "explain", libelle: "Expliquer" },
  ],
  "cours-ecrit": [
    { type: "read", libelle: "Lire" },
    { type: "synthesize", libelle: "Synthétiser" },
    { type: "recall", libelle: "Rappeler" },
    { type: "explain", libelle: "Expliquer" },
  ],
  note: [
    { type: "recall", libelle: "Rappeler" },
    { type: "explain", libelle: "Expliquer" },
    { type: "synthesize", libelle: "Synthétiser" },
  ],
  definition: [
    { type: "recall", libelle: "Rappeler" },
    { type: "explain", libelle: "Expliquer" },
    { type: "synthesize", libelle: "Synthétiser" },
  ],
  "exercice-donne": [{ type: "resolve", libelle: "Résoudre sans mesure" }],
  devoir: [{ type: "produce", libelle: "Produire" }],
} satisfies Record<TypeContenuModuleTravaillable, readonly GesteContenuModule[]>;

export function estContenuModuleTravaillable(type: string): type is TypeContenuModuleTravaillable {
  return TYPES_CONTENU_MODULE_TRAVAILLABLES.includes(type as TypeContenuModuleTravaillable);
}

export function gestesPourContenuModule(type: string): readonly GesteContenuModule[] {
  return estContenuModuleTravaillable(type) ? GESTES_PAR_TYPE[type] : [];
}

export function construireInterventionDepuisContenu(entree: {
  documentId: string;
  titre: string;
  typeDocument: string;
  geste: string;
  skillCodes?: string[];
}): InterventionSeance {
  const gestes = gestesPourContenuModule(entree.typeDocument);
  const geste = gestes.find((item) => item.type === entree.geste);
  if (!geste) throw new Error("Ce geste n’est pas disponible pour ce type de contenu.");

  return {
    id: `intervention-${entree.documentId}-${geste.type}`,
    type: geste.type,
    label: `${geste.libelle} · ${entree.titre}`,
    source: {
      kind: entree.typeDocument === "cours" || entree.typeDocument === "cours-ecrit" ? "course" : "document",
      ref: entree.documentId,
    },
    ...(entree.skillCodes?.length ? { targetSkillCodes: [...new Set(entree.skillCodes)] } : {}),
    expectedEffect: "preparation",
  };
}
