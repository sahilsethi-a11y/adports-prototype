"use client";

import QuoteBuilderList, { type QuoteItem } from "@/components/buyer/QuoteBuilderList";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LOCAL_AUTH_STORAGE_KEY, type LocalAuthUser } from "@/lib/localAuth";
import { getClientMarketMode, MARKET_MODE_STORAGE_KEY, normalizeMarketMode, scopedStorageKey, type MarketMode } from "@/lib/marketplace";
import MarketplaceSwitch from "@/components/MarketplaceSwitch";

export default function QuoteBuilderPage() {
    return (
        <Suspense fallback={<QuoteBuilderFallback />}>
            <QuoteBuilderPageContent />
        </Suspense>
    );
}

function QuoteBuilderPageContent() {
    const searchParams = useSearchParams();
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [isBuyer, setIsBuyer] = useState<boolean | null>(null);
    const [marketMode, setMarketMode] = useState<MarketMode>("second_hand");

    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const raw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
            const localUser = raw ? (JSON.parse(raw) as LocalAuthUser) : null;
            setIsBuyer(localUser?.roleType === "buyer");
        } catch {
            setIsBuyer(false);
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        setMarketMode(getClientMarketMode());
        const onStorage = (e: StorageEvent) => {
            if (e.key === MARKET_MODE_STORAGE_KEY) setMarketMode(getClientMarketMode());
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    useEffect(() => {
        const marketFromQuery = searchParams.get("market");
        if (marketFromQuery) {
            setMarketMode(normalizeMarketMode(marketFromQuery));
            return;
        }
        if (typeof window !== "undefined") setMarketMode(getClientMarketMode());
    }, [searchParams]);

    useEffect(() => {
        if (!isBuyer || typeof window === "undefined") {
            setItems([]);
            return;
        }

        const quoteItemsStorageKey = scopedStorageKey("quoteBuilderItems", marketMode);
        try {
            const raw = window.localStorage.getItem(quoteItemsStorageKey);
            const parsed = raw ? (JSON.parse(raw) as QuoteItem[]) : [];
            setItems(parsed);
        } catch {
            setItems([]);
        }

        const onStorage = (e: StorageEvent) => {
            if (e.key !== quoteItemsStorageKey) return;
            try {
                const parsed = e.newValue ? (JSON.parse(e.newValue) as QuoteItem[]) : [];
                setItems(parsed);
            } catch {}
        };
        const onQuoteUpdate = () => {
            try {
                const raw = window.localStorage.getItem(quoteItemsStorageKey);
                const parsed = raw ? (JSON.parse(raw) as QuoteItem[]) : [];
                setItems(parsed);
            } catch {}
        };
        window.addEventListener("storage", onStorage);
        window.addEventListener("quoteBuilderUpdated", onQuoteUpdate);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("quoteBuilderUpdated", onQuoteUpdate);
        };
    }, [isBuyer, marketMode]);

    if (isBuyer === false) {
        return (
            <main className="container mx-auto px-4 lg:px-6 py-8">
                <div className="mb-4">
                    <h1 className="text-3xl text-brand-blue">Quote Builder</h1>
                </div>
                <MarketplaceSwitch mode={marketMode} compact className="mb-6 max-w-sm" />
                <div className="flex justify-center">
                    <div className="p-4 border rounded-2xl border-stroke-light">
                        Quote Builder is available for logged-in buyers only.
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="container mx-auto px-4 lg:px-6 py-8">
            <div className="mb-4">
                <h1 className="text-3xl text-brand-blue">
                    Quote Builder ({marketMode === "zero_km" ? "Zero KM" : "Second-Hand"})
                </h1>
            </div>
            <MarketplaceSwitch mode={marketMode} compact className="mb-6 max-w-sm" />
            <QuoteBuilderList list={items} marketMode={marketMode} />
        </main>
    );
}

function QuoteBuilderFallback() {
    return (
        <main className="container mx-auto px-4 lg:px-6 py-8">
            <div className="mb-4">
                <h1 className="text-3xl text-brand-blue">Quote Builder</h1>
            </div>
            <div className="p-4 border rounded-2xl border-stroke-light">Loading quote builder...</div>
        </main>
    );
}
