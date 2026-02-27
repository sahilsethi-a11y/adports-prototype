export type MarketMode = "second_hand" | "zero_km";

export const DEFAULT_MARKET_MODE: MarketMode = "second_hand";
export const MARKET_MODE_STORAGE_KEY = "adpg_market_mode";
export const MARKET_MODE_COOKIE_KEY = "adpg_market_mode";

export const normalizeMarketMode = (value?: string | null): MarketMode =>
    value === "zero_km" ? "zero_km" : "second_hand";

export const scopedStorageKey = (base: string, mode: MarketMode) => `${base}__${mode}`;

export const getClientMarketMode = (): MarketMode => {
    if (typeof window === "undefined") return DEFAULT_MARKET_MODE;
    const raw = window.localStorage.getItem(MARKET_MODE_STORAGE_KEY);
    return normalizeMarketMode(raw);
};

export const setClientMarketMode = (mode: MarketMode) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MARKET_MODE_STORAGE_KEY, mode);
    document.cookie = `${MARKET_MODE_COOKIE_KEY}=${mode}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    window.dispatchEvent(new CustomEvent("adpg-market-changed", { detail: { mode } }));
};
