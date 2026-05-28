"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TransactionManagementFlow from "@/components/orders/TransactionManagementFlow";
import { ArrowLeftIcon } from "@/components/Icons";

type Role = "buyer" | "seller";

type NegotiationOrder = {
    conversationId: string;
    sellerId: string;
    createdAt: string;
    items: Array<{ currency: string; name?: string; totalUnits?: number; marketType?: "second_hand" | "zero_km" }>;
    totals: {
        total: number;
        downpayment: number;
        pending: number;
    };
};

export default function TransactionOrderPage({ conversationId, role }: Readonly<{ conversationId: string; role: Role }>) {
    const [order, setOrder] = useState<NegotiationOrder | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/negotiation-orders?role=${role}`, { cache: "no-store" });
                if (!res.ok) {
                    setOrder(null);
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                const found = (data?.orders ?? []).find((o: NegotiationOrder) => o.conversationId === conversationId) ?? null;
                setOrder(found);
            } catch {
                setOrder(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [conversationId, role]);

    if (loading) {
        return <main className="container mx-auto px-4 py-8 text-sm text-gray-500">Loading transaction...</main>;
    }

    if (!order) {
        return (
            <main className="container mx-auto px-4 py-8">
                <div className="rounded-xl border border-stroke-light bg-white p-6">
                    <h1 className="text-xl font-semibold text-brand-blue">Transaction not found</h1>
                    <p className="mt-1 text-sm text-gray-600">This order was not found in your order list.</p>
                    <Link href={role === "buyer" ? "/buyer/orders" : "/seller/orders"} className="mt-4 inline-flex rounded-lg bg-brand-blue px-4 py-2 text-sm text-white">
                        Back to orders
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <>
            <main className="container mx-auto max-w-7xl px-4 pt-6 flex justify-start">
                <Link
                    href={role === "buyer" ? "/buyer/orders" : "/seller/orders"}
                    className="rounded-lg hover:bg-accent md:px-2 hover:text-brand-blue flex items-center justify-center gap-2 text-xs py-2 text-brand-blue">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Orders
                </Link>
            </main>
            <TransactionManagementFlow
                conversationId={order.conversationId}
                role={role}
                sellerName={order.sellerId || "Seller"}
                createdAtLabel={new Date(order.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                currency={order.items?.[0]?.currency || "USD"}
                totals={order.totals}
                orderItems={(order.items || []).map((i, idx) => ({
                    key: `item-${idx}`,
                    label: i.name || `Vehicle Group ${idx + 1}`,
                    totalUnits: Math.max(1, Number(i.totalUnits || 1)),
                    marketType: i.marketType || "second_hand",
                }))}
            />
        </>
    );
}
