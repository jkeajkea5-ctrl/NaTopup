import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { fetchGames } from "../services/api";

const GAME_SEARCH_ALIASES = {
  "mobile-legends": ["ml", "mlbb", "mobile legend", "bang bang"],
  "free-fire": ["ff", "freefire", "free fire my", "ff my", "sgmy"],
  "pubg-mobile": ["pubg", "pubgm", "uc"],
  "honor-of-kings": ["hok", "honour of kings", "honor kings"],
  valorant: ["valo", "valorant kh", "valorant cambodia"],
  zepeto: ["zepeto zems"],
  "delta-force": ["delta", "deltaforce"],
  "blood-strike": ["bloodstrike"],
  "magic-chess-gogo": ["magic chess", "mcgogo", "gogo"],
  "crossfire-legend": ["crossfire", "cross fire", "cf legend"],
};

const normalizeSearch = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\u1780-\u17ff]+/g, " ")
    .trim();

export const NavbarSearch = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const container = useRef(null);
  const input = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({ queryKey: ["games"], queryFn: fetchGames });
  const term = normalizeSearch(query);
  const compactTerm = term.replace(/\s+/g, "");
  const matches = (data?.games || []).filter((game) => {
    const aliases = GAME_SEARCH_ALIASES[game.slug] || [];
    const searchable = normalizeSearch([
      game.name,
      game.slug,
      game.category,
      game.region,
      ...aliases,
    ].join(" "));
    return searchable.includes(term) || searchable.replace(/\s+/g, "").includes(compactTerm);
  });
  const visible = open && !!term;

  useEffect(() => { setOpen(false); setQuery(""); }, [location.pathname]);
  useEffect(() => {
    const dismiss = (event) => {
      if (!container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  return (
    <div ref={container} className="relative order-3 w-full pb-3 md:order-none md:max-w-md md:flex-1 md:pb-0"
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); input.current?.focus(); } }}>
      <form role="search" className="flex h-11 items-center gap-2 rounded-2xl border border-brand-border bg-white/90 px-3 text-brand-muted transition-shadow focus-within:border-brand-violet focus-within:ring-4 focus-within:ring-brand-violet/10"
        onSubmit={(event) => {
          event.preventDefault();
          if (term && matches.length && !isError) {
            navigate(`/game/${matches[0].slug}`);
            setOpen(false);
            setQuery("");
          }
        }}>
        <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <input ref={input} type="search" value={query} aria-label="ស្វែងរកហ្គេម" placeholder="ស្វែងរកហ្គេម..."
          aria-controls={visible ? "navbar-search-results" : undefined}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:font-kulen placeholder:text-brand-muted/70 [&::-webkit-search-cancel-button]:hidden"
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} />
        {query && <button type="button" aria-label="Clear search" className="rounded-lg p-1.5 hover:bg-brand-violet/10 focus-visible:outline-brand-violet"
          onClick={() => { setQuery(""); input.current?.focus(); }}><X className="h-4 w-4" /></button>}
      </form>
      {visible && (
        <div id="navbar-search-results" className="absolute inset-x-0 top-full z-50 mt-1 max-h-[min(60dvh,24rem)] overflow-y-auto rounded-2xl border border-brand-border bg-white p-2 shadow-xl">
          {isLoading || isError || !matches.length ? (
            <p role="status" className="px-3 py-4 text-sm text-brand-muted">
              {isLoading ? "កំពុងផ្ទុក..." : isError ? "មិនអាចផ្ទុកហ្គេមបានទេ។ សូមព្យាយាមម្តងទៀត។" : "រកមិនឃើញហ្គេមទេ"}
            </p>
          ) : (
            <ul aria-label="Search results">
              {matches.map((game) => (
                <li key={game.id}>
                  <Link to={`/game/${game.slug}`} onClick={() => { setOpen(false); setQuery(""); }}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-brand-violet/10 focus-visible:bg-brand-violet/10 focus-visible:outline-brand-violet">
                    <img src={game.logoUrl} alt="" className="h-11 w-11 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1 break-words text-sm font-semibold text-brand-text">{game.name}</span>
                    <span aria-hidden="true" className="text-brand-violet">&rarr;</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
