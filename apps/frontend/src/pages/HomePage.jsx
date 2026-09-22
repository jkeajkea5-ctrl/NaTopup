import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Gamepad2,
} from "lucide-react";
import { fetchGames } from "../services/api";
import { HeroSlider } from "../components/HeroSlider";
import { GameCard } from "../components/GameCard";

export const HomePage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["games"],
    queryFn: fetchGames,
  });

  const games = data?.games || [];
  const promotions = data?.promotions || [];
  const popularGames = games.filter((game) => game.isPopular);
  const featuredGames = popularGames.length ? popularGames : games.slice(0, 4);
  const marqueeGames = featuredGames.length < 4
    ? [...featuredGames, ...featuredGames, ...featuredGames]
    : featuredGames;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Hero Promotional Slider (LisaTopup Level 1) */}
      <section>
        <HeroSlider promotions={promotions} />
      </section>

      {featuredGames.length > 0 && (
        <section aria-labelledby="featured-games-title" className="featured-games space-y-2 overflow-hidden">
          <h2 id="featured-games-title" className="featured-heading font-heading text-sm font-extrabold tracking-[0.14em] text-[#594274] sm:text-base">
            FEATURED GAMES
          </h2>
          <div className="relative overflow-hidden py-1.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-6 bg-gradient-to-r from-[#EBE3F0] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-6 bg-gradient-to-l from-[#EBE3F0] to-transparent" />
            <div className="featured-games-track animate-marquee-cards">
              {[0, 1].map((group) => (
                <div key={group} className="flex shrink-0 items-center gap-2.5 pr-2.5 sm:gap-3 sm:pr-3" aria-hidden={group === 1 ? true : undefined}>
                  {marqueeGames.map((game, index) => (
                    <Link
                      key={`${game.id}-${index}`}
                      to={`/game/${game.slug}`}
                      tabIndex={group === 1 ? -1 : undefined}
                      className="featured-game-card group relative flex w-[170px] shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl p-2.5 sm:w-[195px] sm:gap-3 sm:p-3"
                    >
                      <img src={game.logoUrl} alt="" loading="lazy" className="featured-game-logo h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14" />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-heading text-xs font-extrabold text-[#352449] sm:text-sm">{game.name}</h3>
                        <p className="mt-0.5 truncate text-[10px] font-medium text-[#81708f] sm:text-[11px]">Instant top-up</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="games" aria-labelledby="popular-games-title" className="popular-games scroll-mt-24 space-y-5">
        <div className="popular-games-header">
          <div className="flex items-center gap-3">
            <h2 id="popular-games-title" className="popular-games-title font-kulen">
              ហ្គេមពេញនិយម
            </h2>
            <span className="popular-games-count" aria-label={`${games.length} games`}>
              {isLoading ? "…" : games.length}
            </span>
          </div>
          <div className="popular-games-rule" aria-hidden="true" />
        </div>

        {/* Responsive game grid: 2-3 phone, 4 tablet, 6 desktop. */}
        {isLoading ? (
          <div className="responsive-game-grid grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="flex flex-col items-center animate-pulse space-y-2 w-full"
              >
                <div className="aspect-square w-full bg-gray-200 rounded-xl sm:rounded-2xl" />
                <div className="h-3 bg-gray-200 rounded-lg w-2/3 mx-auto mt-2" />
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-16 bg-brand-surface rounded-2xl border border-brand-border">
            <Gamepad2 className="w-12 h-12 text-brand-muted mx-auto mb-3 opacity-40" />
            <h3 className="font-heading font-semibold text-lg text-brand-text">រកមិនឃើញហ្គេមទេ</h3>
          </div>
        ) : (
          <div className="responsive-game-grid grid grid-cols-2 min-[380px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 md:gap-3.5 lg:gap-4">
            {games.map((game, index) => (
              <div key={game.id} className="popular-game-enter min-w-0" style={{ "--enter-delay": `${Math.min(index, 11) * 45}ms` }}>
                <GameCard game={game} />
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
};
