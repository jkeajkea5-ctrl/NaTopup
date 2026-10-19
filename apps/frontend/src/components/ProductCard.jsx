import React from "react";
import { Check } from "lucide-react";

export const ProductCard = ({ product, isSelected, onSelect }) => {
  const priceUsd = Number(product?.finalPriceUsd ?? product?.priceUsd ?? 0).toFixed(2);
  const nameLower = (product?.name || "").toLowerCase();
  const iconUrlLower = (product?.iconUrl || "").toLowerCase();
  const isPass = nameLower.includes("pass") || nameLower.includes("weekly") || nameLower.includes("membership");
  const isSuperValuePass = nameLower.includes("super value pass") || nameLower.includes("supper value pass");
  const productIconUrl = isSuperValuePass
    ? "/packages/mlbb/super-value-pass.png"
    : product.iconUrl || (isPass ? "/mlbb-weekly-pass.png" : "/mlbb-diamond-clean.png");
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
      aria-pressed={isSelected}
      className={`product-card ${isSelected ? "is-selected" : ""} ${product.customBadge ? "has-badge" : ""}`}
    >
      {product.customBadge && (
        <span className="product-card-badge" title={product.customBadge}>
          <span>{product.customBadge}</span>
        </span>
      )}

      {isSelected && (
        <span className="product-card-check" aria-hidden="true">
          <Check />
        </span>
      )}

      <span className="product-card-artwork" aria-hidden="true">
        <img
          src={productIconUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src = isPass ? "/mlbb-weekly-pass.png" : "/mlbb-diamond-clean.png";
          }}
        />
      </span>

      <span className="product-card-copy">
        <span className="product-card-price">${priceUsd}</span>
        <strong className="product-card-name">{displayName}</strong>
      </span>
    </button>
  );
};
