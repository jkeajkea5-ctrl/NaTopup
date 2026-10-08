import React from "react";
import { Link } from "react-router-dom";

export const GameCard = ({ game }) => {
  const frameThemes = [
    { accent: "#23e6ed", accentDark: "#087f9d", glow: "#36f4ff" },
    { accent: "#ffd35c", accentDark: "#9b6510", glow: "#ffe494" },
    { accent: "#9a8dff", accentDark: "#5147a5", glow: "#b8b0ff" },
    { accent: "#ff713e", accentDark: "#9c2a13", glow: "#ff9a68" },
    { accent: "#ff557e", accentDark: "#94233f", glow: "#ff8fab" },
  ];
  const themeIndex = [...String(game.slug || game.name || "game")]
    .reduce((total, character) => total + character.charCodeAt(0), 0) % frameThemes.length;
  const theme = frameThemes[themeIndex];

  return (
    <Link
      to={`/game/${game.slug}`}
      className="game-card group relative flex flex-col items-center select-none"
      style={{
        "--game-frame-accent": theme.accent,
        "--game-frame-dark": theme.accentDark,
        "--game-frame-glow": theme.glow,
      }}
    >
      <div className="game-card-shell relative aspect-square w-full">
        <span className="game-card-corners" aria-hidden="true" />
        <div className="game-card-artwork">
          <img src={game.logoUrl} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
          <span className="game-card-sheen" aria-hidden="true" />
          <span className="game-card-artwork-shade" aria-hidden="true" />
        </div>
      </div>

      <div className="game-card-nameplate">
        <h3 className="truncate font-kulen font-extrabold uppercase">
          {game.name}
        </h3>
      </div>
    </Link>
  );
};

