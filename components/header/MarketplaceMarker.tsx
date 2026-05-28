"use client";

import { MARKET_MODE_COOKIE_KEY, MARKET_MODE_STORAGE_KEY, normalizeMarketMode, setClientMarketMode, type MarketMode } from "@/lib/marketplace";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type MarketplaceMarkerProps = {
    initialMode: MarketMode;
    className?: string;
};

export default function MarketplaceMarker({ initialMode, className }: Readonly<MarketplaceMarkerProps>) {
    const router = useRouter();
    const pathname = usePathname();
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

    const currentMode = normalizeMarketMode(mode);

    const switchMode = (next: MarketMode) => {
        if (next === currentMode) return;
        const sp = new URLSearchParams(searchParams.toString());
        sp.set("market", next);
        setClientMarketMode(next);
        router.push(`${pathname}?${sp.toString()}`);
    };

    if (pathname === "/") return null;

    return (
        <div className={`hidden md:inline-flex items-center rounded-full border border-stroke-light bg-white p-1 ${className ?? ""}`}>
            <button
                type="button"
                onClick={() => switchMode("second_hand")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    currentMode === "second_hand" ? "bg-brand-blue text-white" : "text-brand-blue hover:bg-brand-blue/10"
                }`}>
                Second-Hand
            </button>
            <button
                type="button"
                onClick={() => switchMode("zero_km")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    currentMode === "zero_km" ? "bg-brand-blue text-white" : "text-brand-blue hover:bg-brand-blue/10"
                }`}>
                Zero KM
            </button>
        </div>
    );
}
