import React from "react";
import { Check } from "lucide-react";

export const ProductCard = ({ product, isSelected, onSelect }) => {
  const priceUsd = Number(product?.finalPriceUsd ?? product?.priceUsd ?? 0).toFixed(2);
  const nameLower = (product?.name || "").toLowerCase();
  const isPass = nameLower.includes("pass") || nameLower.includes("weekly") || nameLower.includes("membership");

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={`relative w-full rounded-xl sm:rounded-2xl p-2 sm:p-3.5 transition-all duration-200 cursor-pointer border overflow-hidden select-none group flex flex-col justify-between items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left gap-1 sm:gap-2 min-h-[84px] sm:min-h-0 ${
        isSelected
          ? "bg-[#6777DE] border-2 border-[#C95A6E] ring-2 ring-[#C95A6E]/40 shadow-lg scale-[1.02]"
          : "bg-[#7E8FEF] border-[#6D7EE8] hover:bg-[#7283E6] hover:border-white/60 hover:scale-[1.01] shadow-xs"
      }`}
    >
      {/* Top Right Corner Selected Badge with Checkmark */}
      {isSelected && (
        <div className="absolute top-0 right-0 w-4 h-4 sm:w-6 sm:h-6 bg-[#C95A6E] text-white rounded-bl-lg sm:rounded-bl-xl flex items-center justify-center shadow-xs z-10 animate-in zoom-in-75 duration-150">
          <Check className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 stroke-[3]" />
        </div>
      )}

      {/* Diamond Amount / Name + Price */}
      <div className="min-w-0 flex-1 w-full sm:w-auto sm:pr-1 order-2 sm:order-1 flex flex-col justify-center">
        {/* Name in Bold White - Never truncated with ellipsis */}
        <div className="font-heading font-extrabold text-[10px] sm:text-sm text-white tracking-tight sm:tracking-wide leading-tight break-words drop-shadow-xs">
          {product.name}
        </div>

        {/* Price in Bright Yellow */}
        <div className="font-heading font-black text-[11px] sm:text-sm text-[#FFF089] tracking-tight mt-0.5 sm:mt-1 drop-shadow-xs">
          ${priceUsd}
        </div>
      </div>

      {/* Graphic Artwork */}
      <div className="w-7 h-7 sm:w-11 sm:h-11 flex items-center justify-center flex-shrink-0 order-1 sm:order-2 my-0.5 sm:my-0">
        {isPass ? (
          <img
            src="/mlbb-weekly-pass.png"
            alt={product.name}
            className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.src = "https://webstorages.sgp1.cdn.digitaloceanspaces.com/web/01KWEJ5KK6VD7R7GRETYDVKW6P.png";
            }}
          />
        ) : (
          <img
            src="/mlbb-diamond-clean.png"
            alt={product.name}
            className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
            onError={(e) => {
              e.currentTarget.src = "/mlbb-diamond.png";
            }}
          />
        )}
      </div>
    </button>
  );
};
