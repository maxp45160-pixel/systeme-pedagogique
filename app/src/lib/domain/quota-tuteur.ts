/**
 * Le solde du quota du tuteur — règle pure (ADR-116).
 *
 * Ici et pas dans `lib/store/quota-tuteur.ts` : ce module est importé par des
 * tests et pourrait l'être par n'importe quelle surface, alors que le store
 * porte `server-only`. C'est aussi la frontière habituelle du dépôt — le
 * domaine calcule, le store persiste.
 *
 * La règle de période existe en deux exemplaires : ici, et dans
 * `consommer_quota_tuteur` côté PostgreSQL. C'est la seule duplication assumée
 * du quota, et `quota-tuteur.test.ts` est ce qui empêche les deux de diverger.
 */

export interface QuotaTuteur {
  /** Générations encore disponibles ce mois-ci sur la clé serveur. */
  restant: number;
  /** Générations incluses par mois pour ce compte. */
  plafond: number;
}

export interface LigneQuota {
  quotaMensuel: number;
  /** Premier jour du mois en cours de décompte, ou `null` si jamais consommé. */
  quotaPeriode: string | null;
  quotaAppels: number;
}

/**
 * Le premier jour du mois courant, au format `YYYY-MM-DD`.
 *
 * Doit rendre la même chaîne que `date_trunc('month', NOW())::DATE` rendu par
 * PostgreSQL. UTC des deux côtés : une base en UTC et un serveur en heure
 * locale feraient diverger le décompte pendant quelques heures autour du 1er.
 */
export function moisCourant(now: Date = new Date()): string {
  const annee = now.getUTCFullYear();
  const mois = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${annee}-${mois}-01`;
}

/**
 * Le solde d'une ligne d'accès, période prise en compte.
 *
 * Une période qui n'est pas le mois courant vaut zéro consommé : le compteur
 * repart au premier appel du mois. Sans cette règle, un compte inactif depuis
 * deux mois lirait « 0 restant » jusqu'à sa prochaine génération — un blocage
 * affiché pour un quota qui, en base, est déjà reparti.
 */
export function soldeQuota(ligne: LigneQuota, now: Date = new Date()): QuotaTuteur {
  const consommes = ligne.quotaPeriode === moisCourant(now) ? ligne.quotaAppels : 0;
  return {
    plafond: ligne.quotaMensuel,
    restant: Math.max(ligne.quotaMensuel - consommes, 0),
  };
}
