/**
 * Remplaçant de `server-only` sous Vitest — voir l'alias dans `vitest.config.ts`.
 *
 * Le vrai paquet lève à l'import pour interdire à un composant client de tirer
 * du code serveur dans son bundle. C'est le build Next qui doit faire respecter
 * cette règle, pas le lanceur de tests : sous Vitest il n'existe aucune
 * frontière client/serveur, et la levée rendait intestables toutes les routes
 * dont la chaîne d'imports traverse `lib/store`.
 */
export {};
