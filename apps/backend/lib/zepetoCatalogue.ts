const ZEPETO_ICON_ROOT = "/packages/zepeto";

function packageAmount(name: string) {
  const match = name.replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

export function getZepetoIconUrl(name: string) {
  const normalized = name.trim().toLowerCase();

  if (normalized.includes("monthly") || normalized.includes("premium")) {
    return `${ZEPETO_ICON_ROOT}/monthly.png`;
  }
  if (normalized.includes("weekly")) return `${ZEPETO_ICON_ROOT}/weekly.png`;
  if (normalized.includes("pass")) return `${ZEPETO_ICON_ROOT}/pass.png`;
  if (normalized.includes("crate")) return `${ZEPETO_ICON_ROOT}/crate.png`;
  if (normalized.includes("pack")) return `${ZEPETO_ICON_ROOT}/pack.png`;

  const amount = packageAmount(normalized);
  if (normalized.includes("coin")) {
    if (amount <= 4_680) return `${ZEPETO_ICON_ROOT}/zems-coins-single.png`;
    if (amount <= 10_200) return `${ZEPETO_ICON_ROOT}/zems-coins-double.png`;
    if (amount <= 21_000) return `${ZEPETO_ICON_ROOT}/pack.png`;
    if (amount <= 38_900) return `${ZEPETO_ICON_ROOT}/zems-coins-triple.png`;
    if (amount <= 62_800) return `${ZEPETO_ICON_ROOT}/crate.png`;
    return `${ZEPETO_ICON_ROOT}/zems-coins-triple.png`;
  }

  if (amount <= 7) return `${ZEPETO_ICON_ROOT}/zems-coins-single.png`;
  if (amount <= 14) return `${ZEPETO_ICON_ROOT}/zems-coins-double.png`;
  if (amount <= 29) return `${ZEPETO_ICON_ROOT}/zems-coins-triple.png`;
  if (amount <= 60) return `${ZEPETO_ICON_ROOT}/pack.png`;
  if (amount <= 125) return `${ZEPETO_ICON_ROOT}/crate.png`;
  if (amount <= 196) return `${ZEPETO_ICON_ROOT}/pass.png`;
  return `${ZEPETO_ICON_ROOT}/zems-coins-triple.png`;
}
