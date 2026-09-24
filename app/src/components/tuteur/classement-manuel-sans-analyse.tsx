"use client";

import { useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import { MAX_COMPETENCES_LIEES_RESSOURCE, cheminDomaineClassement } from "@/lib/documents/classement-ressources";
import type { DepotDocumentaire } from "@/lib/documents/depot";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";
import { FORMATS_PAR_ROLE } from "@/lib/documents/roles-note";
import { enregistrerRangementManuelSansAnalyseAction } from "@/lib/store/rangement-manuel-actions";

/** Correction locale possible même si la lecture IA n'a rien produit. */
export function ClassementManuelSansAnalyse({ depot, referentiel, occupe, onActualiser }: {
  depot: DepotDocumentaire;
  referentiel: ContexteOrganisationDepot;
  occupe: boolean;
  onActualiser?: (id: string) => void;
}) {
  const [ressource, setRessource] = useState(depot);
  const [titre, setTitre] = useState(depot.titre);
  const [type, setType] = useState(depot.type);
  const [domaineId, setDomaineId] = useState(depot.domaineId ?? "");
  const [codes, setCodes] = useState<string[]>(depot.competencesLiees);
  const [recherche, setRecherche] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirme, setConfirme] = useState(false);
  const rechercheNormalisee = recherche.trim().toLocaleLowerCase("fr-FR");
  const selectionnees = referentiel.competences.filter((competence) => codes.includes(competence.code));
  const trouvees = rechercheNormalisee.length >= 2 ? referentiel.competences.filter((competence) =>
    !codes.includes(competence.code) && `${competence.code} ${competence.intitule} ${competence.domaineNom}`.toLocaleLowerCase("fr-FR").includes(rechercheNormalisee)).slice(0, 20) : [];
  const competences = [...selectionnees, ...trouvees];
  const bloque = occupe || enregistrement;

  async function enregistrer() {
    if (bloque || !titre.trim()) return;
    setEnregistrement(true);
    setErreur(null);
    try {
      const nouvelle = await enregistrerRangementManuelSansAnalyseAction({
        documentId: ressource.id,
        updatedAtAttendu: ressource.modifieLe,
        titre: titre.trim(),
        type,
        ...(domaineId ? { domaineId } : {}),
        codes,
      });
      setRessource(nouvelle);
      setConfirme(true);
    } catch (incident) {
      setErreur(incident instanceof Error ? incident.message : "Le rangement n’a pas pu être enregistré. Relisez la ressource avant de recommencer.");
    } finally {
      setEnregistrement(false);
    }
  }

  return <section aria-label={`Rangement manuel de ${ressource.titre}`} className="space-y-4 rounded-lg border border-bordure p-4">
    <div className="space-y-1"><h2 className="text-base font-semibold">Ranger « {ressource.titre} »</h2><p className="text-xs text-texte-attenue">Aucune proposition IA terminée n’est nécessaire. Vos choix restent modifiables ; ce rangement ne mesure aucune compétence.</p></div>
    <label className="block space-y-1 text-sm"><span>Titre</span><input className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={titre} maxLength={200} disabled={bloque} onChange={(event) => { setTitre(event.target.value); setConfirme(false); }} /></label>
    <label className="block space-y-1 text-sm"><span>Type de document</span><select className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={type} disabled={bloque} onChange={(event) => { setType(event.target.value); setConfirme(false); }}>{FORMATS_PAR_ROLE.support.map((format) => <option key={format.valeur} value={format.valeur}>{format.libelle}</option>)}</select></label>
    <label className="block space-y-1 text-sm"><span>Domaine</span><select className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2" value={domaineId} disabled={bloque} onChange={(event) => { setDomaineId(event.target.value); setConfirme(false); }}><option value="">À trier</option>{referentiel.domaines.map((domaine) => <option key={domaine.id} value={domaine.id}>{cheminDomaineClassement(domaine.id, referentiel.domaines)}</option>)}</select></label>
    <fieldset disabled={bloque} className="space-y-2"><legend className="text-sm font-medium">Compétences principales liées au document</legend><p className="text-xs text-texte-attenue">Choisissez dans votre référentiel celles qui figurent dans ce support. Cela ne déclare aucun travail ni aucune maîtrise.</p><input type="search" className="min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher par nom, code ou domaine" aria-label="Rechercher une compétence à lier" />{competences.map((competence) => <label key={competence.code} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-4 accent-primaire" checked={codes.includes(competence.code)} disabled={!codes.includes(competence.code) && codes.length >= MAX_COMPETENCES_LIEES_RESSOURCE} onChange={(event) => { setCodes((avant) => event.target.checked ? [...avant, competence.code] : avant.filter((code) => code !== competence.code)); setConfirme(false); }} /><span>{competence.intitule} <span className="text-xs text-texte-attenue">{competence.code}</span></span></label>)}{rechercheNormalisee.length < 2 && !codes.length && <p className="text-xs text-texte-attenue">Saisissez au moins deux caractères pour chercher une compétence.</p>}{codes.length >= MAX_COMPETENCES_LIEES_RESSOURCE && <p className="text-xs text-danger">Limite technique de {MAX_COMPETENCES_LIEES_RESSOURCE} compétences atteinte.</p>}</fieldset>
    <Bouton type="button" variante="principal" disabled={bloque || !titre.trim()} onClick={() => void enregistrer()}>{enregistrement ? "Enregistrement…" : "Enregistrer ce rangement"}</Bouton>
    {confirme && <p role="status" className="text-sm">Rangement conservé. Vous pouvez encore le modifier ici.</p>}
    {erreur && <div className="space-y-2"><p role="alert" className="text-sm text-danger">{erreur}</p>{onActualiser && <Bouton type="button" taille="petite" variante="secondaire" onClick={() => onActualiser(ressource.id)}>Relire le document sans relancer l’IA</Bouton>}</div>}
  </section>;
}
