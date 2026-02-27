"use client";

import { MARKET_MODE_COOKIE_KEY, MARKET_MODE_STORAGE_KEY, normalizeMarketMode, type MarketMode } from "@/lib/marketplace";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type MarketplaceMarkerProps = {
    initialMode: MarketMode;
    className?: string;
};

export default function MarketplaceMarker({ initialMode, className }: Readonly<MarketplaceMarkerProps>) {
    const searchParams = useSearchParams();
    const queryMode = searchParams.get("market");
    const [mode, setMode] = useState<MarketMode>(initialMode);

    useEffect(() => {
        const resolveMode = (): MarketMode => {
            if (queryMode === "second_hand" || queryMode === "zero_km") return queryMode;
            if (typeof window !== "undefined") {
                const localMode = window.localStorage.getItem(MARKET_MODE_STORAGE_KEY);
                if (localMode === "second_hand" || localMode === "zero_km") return localMode;
                const cookieMode = document.cookie
                    .split("; ")
                    .find((item) => item.startsWith(`${MARKET_MODE_COOKIE_KEY}=`))
                    ?.split("=")[1];
                if (cookieMode === "second_hand" || cookieMode === "zero_km") return cookieMode;
            }
            return initialMode;
        };

        const sync = () => setMode(resolveMode());
        sync();
        window.addEventListener("storage", sync);
        window.addEventListener("adpg-market-changed", sync as EventListener);

        return () => {
            window.removeEventListener("storage", sync);
            window.removeEventListener("adpg-market-changed", sync as EventListener);
        };
    }, [queryMode, initialMode]);

    const marketLabel = normalizeMarketMode(mode) === "zero_km" ? "Zero KM" : "Second-Hand";

    return (
        <span className={`hidden md:inline-flex items-center rounded-full border border-brand-blue/20 bg-brand-blue/5 px-3 py-1 text-xs font-medium text-brand-blue whitespace-nowrap ${className ?? ""}`}>
            Marketplace: {marketLabel}
        </span>
    );
}
