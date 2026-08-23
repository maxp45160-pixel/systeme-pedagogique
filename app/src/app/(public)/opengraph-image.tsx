import { ImageResponse } from "next/og";

export const alt = "Système pédagogique — apprenez par la pratique, sachez où vous en êtes vraiment";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Carte de partage social (Open Graph / Twitter) du groupe public.
 * Couleurs issues de `tokens.css` (thème clair) : les jetons CSS ne sont pas
 * résolus par Satori, les primitives sont donc reprises en dur ici —
 * toute modification de `tokens.css` doit être répercutée.
 */
export default function ImageOg() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f6f2e9",
          color: "#262117",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: -0.5,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: "#2f6b4f",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            S
          </div>
          Système pédagogique
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            textAlign: "center",
            maxWidth: 960,
            letterSpacing: -2,
            display: "flex",
          }}
        >
          Apprenez par la pratique. Sachez où vous en êtes vraiment.
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 32,
            color: "#5b5240",
            textAlign: "center",
            display: "flex",
          }}
        >
          Exercices sur mesure · niveau démontré, jamais inventé · privé
        </div>

        <div
          style={{
            marginTop: 56,
            padding: "18px 44px",
            borderRadius: 14,
            backgroundColor: "#2f6b4f",
            color: "#ffffff",
            fontSize: 32,
            fontWeight: 600,
            display: "flex",
          }}
        >
          Commencer gratuitement
        </div>
      </div>
    ),
    { ...size },
  );
}
