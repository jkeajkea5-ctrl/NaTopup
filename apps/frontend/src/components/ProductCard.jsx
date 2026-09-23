import React from "react";
import { CalendarClock, Check } from "lucide-react";

export const ProductCard = ({ product, isSelected, onSelect }) => {
  const priceUsd = Number(product?.finalPriceUsd ?? product?.priceUsd ?? 0).toFixed(2);
  const nameLower = (product?.name || "").toLowerCase();
  const iconUrlLower = (product?.iconUrl || "").toLowerCase();
  const isPass = nameLower.includes("pass") || nameLower.includes("weekly") || nameLower.includes("membership");
  const isWeeklyElitePack = nameLower.trim() === "weekly elite pack" || iconUrlLower.includes("weekly-elite");
  const isMonthlyElitePack = nameLower.trim() === "monthly elite pack" || iconUrlLower.includes("monthly-elite");
  const purchaseLimit = isWeeklyElitePack
    ? { period: "មួយអាទិត្យ", restriction: "ដាក់បានម្តង", label: "មួយអាទិត្យដាក់បានម្តង" }
    : isMonthlyElitePack
      ? { period: "30ថ្ងៃ", restriction: "ដាក់បានម្តង", label: "30ថ្ងៃដាក់បានម្តង" }
      : null;
  const displayName = purchaseLimit
    ? (product.name.replace(/[\u1780-\u17ff].*$/u, "").trim() || product.name)
    : product.name;

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className={`relative w-full rounded-xl sm:rounded-2xl p-2 sm:p-3 transition-all duration-200 cursor-pointer border overflow-hidden select-none group flex flex-col justify-between items-center text-center gap-1.5 min-h-[84px] ${
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
      {product.customBadge && <span className="absolute left-1.5 top-1.5 max-w-[70%] truncate rounded-md bg-[#FFF089] px-1.5 py-0.5 text-[7px] font-black text-[#493754] shadow-xs">{product.customBadge}</span>}

      {/* Diamond Amount / Name + Price */}
      <div className="min-w-0 flex-1 w-full order-2 flex flex-col justify-center">
        {/* Name in Bold White - Never truncated with ellipsis */}
        <div className="font-heading font-extrabold text-[9px] sm:text-xs text-white tracking-tight leading-tight break-words drop-shadow-xs">
          {displayName}
        </div>

        {purchaseLimit && (
          <div
            className="mx-auto mt-1.5 inline-flex max-w-[96%] items-center justify-center gap-1.5 rounded-lg border border-[#FFF089] bg-white/95 px-2 py-1 text-[#342A50] shadow-[0_3px_8px_rgba(34,29,71,0.2)] sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-1.5"
            aria-label={purchaseLimit.label}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FFF089] text-[#C95A6E] shadow-xs sm:h-5 sm:w-5">
              <CalendarClock className="h-2.5 w-2.5 stroke-[2.7] sm:h-3 sm:w-3" aria-hidden="true" />
            </span>
            <span className="min-w-0 font-sans font-normal leading-none" aria-hidden="true">
              <span className="block whitespace-nowrap text-[7px] text-[#8E78D8] sm:text-[9px]">{purchaseLimit.period}</span>
              <span className="mt-0.5 block whitespace-nowrap text-[6px] text-[#493754] sm:text-[8px]">{purchaseLimit.restriction}</span>
            </span>
          </div>
        )}

        {/* Price in Bright Yellow */}
        <div className="font-heading font-black text-[11px] sm:text-sm text-[#FFF089] tracking-tight mt-0.5 sm:mt-1 drop-shadow-xs">
          ${priceUsd}
        </div>
      </div>

      {/* Graphic Artwork */}
      <div className="w-9 h-9 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 order-1 my-0.5">
        <img
          src={product.iconUrl || (isPass ? "/mlbb-weekly-pass.png" : "/mlbb-diamond-clean.png")}
          alt={product.name}
          className="w-full h-full object-contain filter drop-shadow-sm transition-transform duration-200 group-hover:scale-110"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = isPass ? "/mlbb-weekly-pass.png" : "/mlbb-diamond-clean.png";
          }}
        />
      </div>
    </button>
  );
};
