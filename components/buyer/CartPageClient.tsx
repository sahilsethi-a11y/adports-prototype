"use client";

import { useEffect, useState } from "react";
import CartList, { type Cart, type NegotiationOrder } from "@/components/buyer/CartList";
import message from "@/elements/message";
import { useRouter } from "next/navigation";
import { scopedStorageKey, type MarketMode } from "@/lib/marketplace";

type NegotiationCart = NegotiationOrder;

export default function CartPageClient({ list, marketMode }: Readonly<{ list: Cart[]; marketMode: MarketMode }>) {
    const router = useRouter();
    const NEGOTIATION_CARTS_LOCAL_KEY = scopedStorageKey("negotiationCartsByConversation_local", marketMode);
    const [negotiationOrders, setNegotiationOrders] = useState<NegotiationCart[]>([]);
    const [selectedNegotiations, setSelectedNegotiations] = useState<Record<string, boolean>>({});
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    useEffect(() => {
        const load = () => {
            try {
                if (typeof window === "undefined") return;
                const raw = window.localStorage.getItem(NEGOTIATION_CARTS_LOCAL_KEY);
                const map = raw ? (JSON.parse(raw) as Record<string, NegotiationCart>) : {};
                const carts = Object.values(map);
                setNegotiationOrders(carts);
                setSelectedNegotiations((prev) => {
                    const next: Record<string, boolean> = { ...prev };
                    for (const c of carts) {
                        if (typeof next[c.conversationId] !== "boolean") next[c.conversationId] = true;
                    }
                    return next;
                });
            } catch {}
        };
        load();
    }, [NEGOTIATION_CARTS_LOCAL_KEY]);

    const toggleNegotiation = (id: string) => {
        setSelectedNegotiations((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const removeNegotiation = async (id: string) => {
        try {
            if (typeof window === "undefined") return;
            const raw = window.localStorage.getItem(NEGOTIATION_CARTS_LOCAL_KEY);
            const map = raw ? (JSON.parse(raw) as Record<string, NegotiationCart>) : {};
            delete map[id];
            window.localStorage.setItem(NEGOTIATION_CARTS_LOCAL_KEY, JSON.stringify(map));
            setNegotiationOrders((prev) => prev.filter((c) => c.conversationId !== id));
            setSelectedNegotiations((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
        } catch {}
    };

    const selectAllNegotiations = (value: boolean) => {
        setSelectedNegotiations((prev) => {
            const next = { ...prev };
            for (const o of negotiationOrders) {
                next[o.conversationId] = value;
            }
            return next;
        });
    };

    const handleCheckout = async (payload: {
        items: Cart[];
        negotiationOrders: NegotiationCart[];
        totals: {
            fobTotal: number;
            logisticsFees: number;
            negotiatedTotal: number;
            total: number;
        };
        currency?: string;
    }) => {
        try {
            setCheckoutLoading(true);
            if (typeof window !== "undefined") {
                const raw = window.localStorage.getItem(NEGOTIATION_CARTS_LOCAL_KEY);
                const map = raw ? (JSON.parse(raw) as Record<string, NegotiationCart>) : {};
                for (const order of payload.negotiationOrders) {
                    delete map[order.conversationId];
                }
                window.localStorage.setItem(NEGOTIATION_CARTS_LOCAL_KEY, JSON.stringify(map));
            }
            message.success("Local checkout completed.");
            setNegotiationOrders((prev) =>
                prev.filter((o) => !payload.negotiationOrders.some((x) => x.conversationId === o.conversationId))
            );
            router.push("/buyer/orders");
        } catch {
            message.error("Local checkout failed.");
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <CartList
            list={list}
            negotiationOrders={negotiationOrders}
            selectedNegotiations={selectedNegotiations}
            onToggleNegotiation={toggleNegotiation}
            onRemoveNegotiation={removeNegotiation}
            onSelectAllNegotiations={selectAllNegotiations}
            onCheckout={handleCheckout}
            isCheckingOut={checkoutLoading}
        />
    );
}
