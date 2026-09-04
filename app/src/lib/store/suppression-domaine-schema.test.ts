import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260904084047_supprimer_domaine_archive.sql", import.meta.url),
  "utf8",
);
const schema = readFileSync(new URL("../../../supabase/schema.sql", import.meta.url), "utf8");

function commande(source: string): string {
  const debut = source.indexOf("CREATE OR REPLACE FUNCTION public.supprimer_domaine_archive");
  const fin = source.indexOf("TO authenticated;", debut);
  if (debut < 0 || fin < 0) throw new Error("Commande de suppression absente du schéma");
  return source.slice(debut, fin + "TO authenticated;".length).replace(/\s+/g, " ").trim();
}

describe("suppression sûre d'un domaine archivé", () => {
  it("garde la migration et le schéma de référence alignés", () => {
    expect(commande(schema)).toBe(commande(migration));
  });

  it("refuse la suppression d'un domaine actif ou porteur de données", () => {
    expect(migration).toContain("IF NOT v_archive THEN");
    expect(migration).toContain("public.observations");
    expect(migration).toContain("public.exercises");
    expect(migration).toContain("public.sessions");
    expect(migration).toContain("public.engagements");
    expect(migration).toContain("public.documents");
    expect(migration).toContain("public.propositions_referentiel");
    expect(migration).toContain("public.moteur_decisions");
    expect(migration).toContain("IF cardinality(v_blocages) > 0 THEN");
  });

  it("journalise la suppression sans effacer le registre des codes émis", () => {
    expect(migration).toContain("DELETE FROM public.competences");
    expect(migration).toContain("DELETE FROM public.domaines");
    expect(migration).toContain("INSERT INTO public.referentiel_changes");
    expect(migration).not.toMatch(/DELETE FROM public\.referentiel_codes_emis/i);
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).toContain("p_expected_version");
  });
});
