"use client";
import Link from "next/link";
import { StoreIcon } from "@/components/Icons";
import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";
import { getClientMarketMode, scopedStorageKey } from "@/lib/marketplace";

export default function CartButton({ initialCount }: Readonly<{ initialCount: number }>) {
    const { count, setCart } = useCart();

    useEffect(() => {
        let isActive = true;
        setCart(initialCount);
        const loadCounts = () => {
            try {
                const mode = getClientMarketMode();
                const key = scopedStorageKey("negotiationCartsByConversation_local", mode);
                const raw = window.localStorage.getItem(key);
                const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
                const negotiationCount = Object.keys(map).length;
                if (isActive) setCart(negotiationCount);
            } catch {
                if (isActive) setCart(initialCount);
            }
        };
        loadCounts();
        window.addEventListener("storage", loadCounts);
        window.addEventListener("quoteBuilderUpdated", loadCounts);
        return () => {
            isActive = false;
            window.removeEventListener("storage", loadCounts);
            window.removeEventListener("quoteBuilderUpdated", loadCounts);
        };
    }, [initialCount, setCart]);

    return (
        <div className="relative">
            <Link className="p-2 hover:bg-gray-100 block rounded-md" href="/my-cart" title="My Cart">
                <StoreIcon className="h-4 w-4" />
            </Link>
            {count > 0 ? (
                <span className="h-4 w-4 rounded-full bg-destructive text-xs absolute -top-0.5 -right-0.5 text-white flex justify-center items-center">
                    {count}
                </span>
            ) : null}
        </div>
    );
}
