import React from "react";
import { Link } from "react-router-dom";

export const GameCard = ({ game }) => {
  return (
    <Link
      to={`/game/${game.slug}`}
      className="game-card group relative flex flex-col items-center select-none"
    >
      <div className="game-card-shell relative aspect-square w-full">
        <div className="game-card-artwork">
          <img src={game.logoUrl} alt={game.name} className="h-full w-full object-cover" loading="lazy" />
          <span className="game-card-sheen" aria-hidden="true" />
        </div>
      </div>

      <div className="game-card-nameplate">
        <h3 className="truncate font-heading font-bold">
          {game.name}
        </h3>
      </div>
    </Link>
  );
};

