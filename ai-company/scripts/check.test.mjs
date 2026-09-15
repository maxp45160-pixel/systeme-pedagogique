import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, basename } from "node:path";
import { checkCompany } from "./check.mjs";

const fence = String.fromCharCode(96).repeat(3);

function fixture(t) {
  const temp = resolve(tmpdir());
  const root = mkdtempSync(join(temp, "ai-company-check-"));
  t.after(() => {
    // Verify the resolved deletion target remains the test-created directory.
    assert.equal(dirname(resolve(root)), temp);
    assert.ok(basename(root).startsWith("ai-company-check-"));
    rmSync(root, { recursive: true, force: true });
  });
  const write = (name, text) => {
    const file = join(root, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  };
  for (const role of ["chief-of-staff", "product", "cto", "qa", "research"]) {
    write("ai-company/agents/" + role + ".md",
      "# Role\n\n## MISSION\n\n## RESPONSABILITÉS\n\n## SOURCES DE VÉRITÉ\n\n## ENTRÉES\n\n## SORTIES\n\n## INTERDICTIONS\n\n## CONDITIONS D'ESCALADE\n");
  }
  return { root, write };
}

test("cross-document paths, Unicode headings and historical explicit anchors resolve", t => {
  const { root, write } = fixture(t);
  write("PRODUCT.md", '# État courant\n\n<a name="adr-017"></a>\n');
  write("ai-company/README.md", "[État](../PRODUCT.md#état-courant)\n[ADR](../PRODUCT.md#adr-017)");
  assert.deepEqual(checkCompany(root).errors, []);
});

test("missing local targets and missing anchors fail without hiding either", t => {
  const { root, write } = fixture(t);
  write("PRODUCT.md", "# Vision");
  write("ai-company/README.md", "[Absent](absent.md)\n[Anchor](../PRODUCT.md#inconnu)");
  const errors = checkCompany(root).errors;
  assert.equal(errors.length, 2);
  assert.ok(errors.some(e => e.includes("cible absente")));
  assert.ok(errors.some(e => e.includes("ancre absente")));
});

test("out-of-repository targets fail and HTTPS sources are not fetched", t => {
  const { root, write } = fixture(t);
  write("ai-company/README.md", "[Outside](../../private.md)\n[Web](https://example.invalid/source)");
  const result = checkCompany(root);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /hors dépôt/);
});

test("missing role sections and an unclosed fence are reported", t => {
  const { root, write } = fixture(t);
  write("ai-company/agents/qa.md", "# QA\n\n## MISSION\n\n" + fence + "text\nunfinished");
  const errors = checkCompany(root).errors;
  assert.ok(errors.some(e => e.includes("rubrique absente : SORTIES")));
  assert.ok(errors.some(e => e.includes("non fermé")));
});

test("accepted decision without human provenance and with mismatching index fails", t => {
  const { root, write } = fixture(t);
  write("ai-company/decisions/README.md", "| [DEC-0001](DEC-0001-test.md) | Test | proposed |");
  write("ai-company/decisions/DEC-0001-test.md",
    "# Decision\n- Identifiant : DEC-0001\n- Date : 2026-09-15\n- Statut : accepted\n" +
    "- Validation humaine : aucune\n- Source de la validation : UNKNOWN\n" +
    ["Contexte", "Problème", "Options étudiées", "Décision", "Justification",
      "Conséquences", "Éléments de remise en cause", "Historique"].map(s => "\n## " + s + "\n").join(""));
  const errors = checkCompany(root).errors;
  assert.ok(errors.some(e => e.includes("statut différent")));
  assert.equal(errors.filter(e => e.includes("provenance humaine manquante")).length, 2);
});

test("portable links inside fenced examples do not become real dependencies", t => {
  const { root, write } = fixture(t);
  write("ai-company/README.md", fence + "markdown\n[Example](does-not-exist.md)\n" + fence + "\n");
  assert.deepEqual(checkCompany(root).errors, []);
});
