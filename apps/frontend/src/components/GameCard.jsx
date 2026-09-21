import React from "react";
import { Link } from "react-router-dom";

export const GameCard = ({ game }) => {
  return (
    <Link
      to={`/game/${game.slug}`}
      className="group relative flex flex-col items-center transition-all duration-300 hover:-translate-y-1.5 select-none"
    >
      {/* Game Image Container with smooth rounded corners matching clone screenshot */}
      <div className="relative aspect-square w-full rounded-2xl sm:rounded-3xl overflow-hidden shadow-md border border-white/60 group-hover:shadow-glow group-hover:border-brand-violet/50 transition-all duration-300 bg-black/10">
        {/* Light Sheen Beam on Hover only */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl sm:rounded-3xl z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] group-hover:animate-sweep-left-to-right" />
        </div>

        {/* Game Artwork */}
        <img
          src={game.logoUrl}
          alt={game.name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
          loading="lazy"
        />

        {/* Subtle hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Game Title: Centered Bold Uppercase Text Underneath */}
      <div className="mt-2 sm:mt-2.5 text-center px-1 w-full">
        <h3 className="font-kulen font-extrabold text-[11px] sm:text-xs md:text-sm text-[#1C172B] group-hover:text-brand-violet uppercase tracking-wide truncate transition-colors">
          {game.name}
        </h3>
      </div>
    </Link>
  );
};


