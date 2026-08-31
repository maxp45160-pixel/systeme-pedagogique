# Design QA — graphe et activité de la fiche domaine

- Source evidence: `C:\Users\Maxime\AppData\Local\Temp\codex-clipboard-8841301e-8641-494f-9579-f4c31f09b97f.png` and `C:\Users\Maxime\AppData\Local\Temp\codex-clipboard-3a81cb29-0791-41eb-a491-01f0066d19b6.png`
- Intended implementation viewport: desktop, matching the supplied domain view
- Implementation URL: `http://10.213.252.111:4173/atelier`
- Intended state: domaine « Qualité », utilisateur authentifié, avec ses observations
- Implementation screenshot: unavailable

## Full-view comparison evidence

Both supplied screenshots were opened and inspected. The local implementation
could not be captured in the corresponding state: the in-app browser was
redirected to `/login?suite=%2Fatelier` because its local session was not
authenticated. The login screen is not valid comparison evidence for the
domain activity or graph views.

## Focused region comparison evidence

Unavailable for the same authentication blocker. The density of the new
activity rows, truncation of long competency labels, the four-item collapsed
state and the graph after proof filtering therefore remain visually unverified.

## Primary interactions

Not browser-tested because the requested screen could not be reached. Targeted
automated tests and the production build passed, but those checks do not
replace interaction or visual verification.

## Console

No domain or graph-view console check was possible because the browser never
reached those views.

## Findings

- [P1] Authenticated implementation state unavailable.
  Evidence: `/atelier` redirected to `/login?suite=%2Fatelier`.
  Impact: no valid rendered comparison or core-interaction test can be made.
  Fix: open the local app with an authenticated browser session, then capture
  the domain activity and graph views and rerun this comparison.

## Comparison history

- Initial pass: blocked before implementation capture; no visual fixes were
  made from unverifiable evidence.

## final result: blocked
