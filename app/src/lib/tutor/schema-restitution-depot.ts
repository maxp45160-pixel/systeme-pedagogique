import { MAX_COMPETENCES_ORGANISATION_DEPOT, type ReferentielDepotPourModele } from "@/lib/documents/depot";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import { OBJET_MAX, PRECISION_MAX, VERBES_ACTION } from "@/lib/domain/atomicite";

/** Version du contrat fournisseur, indépendante des restitutions déjà enregistrées. */
export const VERSION_SCHEMA_RESTITUTION_DEPOT = "restitution-json-schema-v2";

interface Schema {
  type?: "object" | "array" | "string" | "number" | "null";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: false;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: readonly string[];
  anyOf?: Schema[];
  $ref?: string;
  $defs?: Record<string, Schema>;
}

const objet = (properties: Record<string, Schema>): Schema => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});
const texte = (maxLength: number): Schema => ({ type: "string", minLength: 1, maxLength });
const choix = (values: readonly string[]): Schema => ({ type: "string", enum: [...new Set(values)] });
const variantes = (anyOf: Schema[]): Schema => anyOf.length === 1 ? anyOf[0] : { anyOf };

/**
 * Contraint la forme avant génération. La validation métier reste obligatoire :
 * pertinence des passages, doublons et cohérence entre domaines ne se déduisent
 * pas du seul schéma JSON. Aucune valeur manquante n'est inventée ici.
 */
export function fabriquerSchemaRestitutionDepot(passageIds: string[], referentiel?: ReferentielDepotPourModele): Schema {
  if (!passageIds.length || passageIds.some((id) => !id.trim())) {
    throw new Error("Aucun catalogue de passages valide pour la restitution.");
  }
  const sources: Schema = {
    type: "array", minItems: 1, maxItems: 3, items: { $ref: "#/$defs/source" },
  };
  const sourcee = { justification: texte(700), sources };
  const elements: Schema = {
    type: "array", maxItems: 8,
    items: objet({ nature: choix(["sujet", "annotation", "incertitude"]), texte: texte(700), sources }),
  };
  const racine = objet({ elements });
  racine.$defs = { source: objet({ passageId: choix(passageIds) }) };
  if (!referentiel) return racine;

  const ids = referentiel.domaines.map(({ id }) => id);
  const codes = referentiel.competences.map(({ code }) => code);
  const domaineExistant = { mode: choix(["existant"]), id: choix(ids) };
  const domaineNouveau = { mode: choix(["nouveau"]), nom: texte(120) };
  const referenceDomaine = variantes([
    ...(ids.length ? [objet(domaineExistant)] : []), objet(domaineNouveau),
  ]);
  const domaine = variantes([
    { type: "null" },
    ...(ids.length ? [objet({ ...domaineExistant, ...sourcee })] : []),
    objet({ ...domaineNouveau, description: texte(700), parentId: ids.length ? { anyOf: [choix(ids), { type: "null" }] } : { type: "null" }, ...sourcee }),
  ]);
  const competence = variantes([
    ...(codes.length ? [objet({ mode: choix(["existante"]), code: choix(codes), ...sourcee })] : []),
    objet({
      mode: choix(["nouvelle"]), verbeAction: choix(VERBES_ACTION), objet: texte(OBJET_MAX),
      precision: { anyOf: [texte(PRECISION_MAX), { type: "null" }] },
      palier: choix(["fondamentaux", "intermediaire", "avance"]),
      importance: { type: "number", minimum: 0, maximum: 1 },
      domaine: referenceDomaine, ...sourcee,
    }),
  ]);
  racine.properties!.organisation = objet({
    titreSuggere: texte(200), typeSuggere: choix(FORMATS_PAR_ROLE.support.map(({ valeur }) => valeur)),
    domaine, competences: { type: "array", maxItems: MAX_COMPETENCES_ORGANISATION_DEPOT, items: competence },
    ...sourcee,
  });
  racine.required!.push("organisation");
  return racine;
}
