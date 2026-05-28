"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

type NegotiationOrder = {
    conversationId: string;
    buyerId: string;
    sellerId: string;
    logisticsPartner: "UGR" | "None";
    items: Array<{
        bucketKey: string;
        name: string;
        totalUnits: number;
        unitPrice: number;
        currency: string;
        discountPercent: number;
        total: number;
    }>;
    totals: {
        total: number;
        downpayment: number;
        pending: number;
    };
    status: string;
    createdAt: string;
};

type TxStatus =
    | "CONTRACT_PENDING"
    | "CONTRACT_UPLOADED"
    | "DEPOSIT_SUBMITTED"
    | "DEPOSIT_REJECTED"
    | "DEPOSIT_VERIFIED"
    | "VIN_SUBMITTED"
    | "INSPECTION_ADDON_OFFER"
    | "INSPECTION_ORDERED"
    | "INSPECTION_REPORT_READY"
    | "LOGISTICS_PENDING"
    | "ORDER_PREP_PENDING"
    | "DELIVERY_DETAILS_PENDING"
    | "FINAL_PAYMENT_PENDING"
    | "FINAL_PAYMENT_SUBMITTED"
    | "FINAL_PAYMENT_REJECTED"
    | "SHIPPING_DOCS_PENDING"
    | "RELEASED"
    | "DELIVERED"
    // Legacy – kept for backward-compat with old localStorage data
    | "EXPORT_DOCS_UPLOADED";

type ActionOwner = "buyer" | "seller" | "admin" | "none";
type TxFlowSnapshot = { status?: TxStatus };

const OWNER_LABEL: Record<ActionOwner, string> = {
    buyer: "Buyer", seller: "Seller", admin: "Admin", none: "Completed",
};
const OWNER_COLOR: Record<ActionOwner, string> = {
    buyer: "bg-blue-100 text-blue-700",
    seller: "bg-violet-100 text-violet-700",
    admin: "bg-orange-100 text-orange-700",
    none: "bg-emerald-100 text-emerald-700",
};

const STATUS_BADGE: Record<TxStatus, { label: string; tone: string; step: number }> = {
    CONTRACT_PENDING:          { label: "Contract Pending",              tone: "bg-slate-100 text-slate-700 border-slate-200",     step: 1 },
    CONTRACT_UPLOADED:         { label: "Sign & Pay Deposit",            tone: "bg-amber-100 text-amber-800 border-amber-200",     step: 1 },
    DEPOSIT_SUBMITTED:         { label: "Verifying Deposit",             tone: "bg-blue-100 text-blue-800 border-blue-200",        step: 1 },
    DEPOSIT_REJECTED:          { label: "Deposit Rejected",              tone: "bg-red-100 text-red-700 border-red-200",           step: 1 },
    DEPOSIT_VERIFIED:          { label: "VIN Disclosure",                tone: "bg-sky-100 text-sky-700 border-sky-200",           step: 2 },
    VIN_SUBMITTED:             { label: "VIN Confirmation",              tone: "bg-cyan-100 text-cyan-700 border-cyan-200",        step: 2 },
    INSPECTION_ADDON_OFFER:    { label: "Inspection Available",           tone: "bg-purple-100 text-purple-700 border-purple-200",  step: 3 },
    INSPECTION_ORDERED:        { label: "Inspection In Progress",         tone: "bg-violet-100 text-violet-700 border-violet-200",   step: 3 },
    INSPECTION_REPORT_READY:   { label: "Inspection Report Ready",        tone: "bg-indigo-100 text-indigo-700 border-indigo-200",   step: 3 },
    LOGISTICS_PENDING:         { label: "Logistics Setup",               tone: "bg-teal-100 text-teal-700 border-teal-200",        step: 4 },
    ORDER_PREP_PENDING:        { label: "Order Preparation",             tone: "bg-indigo-100 text-indigo-700 border-indigo-200",  step: 5 },
    DELIVERY_DETAILS_PENDING:  { label: "Delivery Details",              tone: "bg-violet-100 text-violet-700 border-violet-200",  step: 5 },
    FINAL_PAYMENT_PENDING:     { label: "Final Payment Due",             tone: "bg-amber-100 text-amber-800 border-amber-200",     step: 6 },
    FINAL_PAYMENT_SUBMITTED:   { label: "Final Payment Under Review",    tone: "bg-blue-100 text-blue-800 border-blue-200",        step: 6 },
    FINAL_PAYMENT_REJECTED:    { label: "Final Payment Rejected",        tone: "bg-red-100 text-red-700 border-red-200",           step: 6 },
    SHIPPING_DOCS_PENDING:     { label: "Shipping Documents",            tone: "bg-orange-100 text-orange-700 border-orange-200",  step: 7 },
    RELEASED:                  { label: "Released / In Transit",         tone: "bg-emerald-100 text-emerald-700 border-emerald-200", step: 7 },
    DELIVERED:                 { label: "Delivered",                     tone: "bg-emerald-100 text-emerald-700 border-emerald-200", step: 7 },
    // Legacy
    EXPORT_DOCS_UPLOADED:      { label: "Order Preparation",             tone: "bg-indigo-100 text-indigo-700 border-indigo-200",  step: 5 },
};

const TOTAL_STEPS = 7;

const TTL_HOURS: Record<TxStatus, number | null> = {
    CONTRACT_PENDING:         24,
    CONTRACT_UPLOADED:        24,
    DEPOSIT_SUBMITTED:        12,
    DEPOSIT_REJECTED:         24,
    DEPOSIT_VERIFIED:         48,
    VIN_SUBMITTED:            48,
    INSPECTION_ADDON_OFFER:   24,
    INSPECTION_ORDERED:       null,
    INSPECTION_REPORT_READY:  48,
    LOGISTICS_PENDING:        24,
    ORDER_PREP_PENDING:       null,
    DELIVERY_DETAILS_PENDING: 24,
    FINAL_PAYMENT_PENDING:    24,
    FINAL_PAYMENT_SUBMITTED:  12,
    FINAL_PAYMENT_REJECTED:   24,
    SHIPPING_DOCS_PENDING:    48,
    RELEASED:                 null,
    DELIVERED:                null,
    EXPORT_DOCS_UPLOADED:     24,
};

const STATUS_OWNER: Record<TxStatus, ActionOwner> = {
    CONTRACT_PENDING:         "seller",
    CONTRACT_UPLOADED:        "buyer",
    DEPOSIT_SUBMITTED:        "seller",
    DEPOSIT_REJECTED:         "buyer",
    DEPOSIT_VERIFIED:         "seller",
    VIN_SUBMITTED:            "buyer",
    INSPECTION_ADDON_OFFER:   "buyer",
    INSPECTION_ORDERED:       "none",
    INSPECTION_REPORT_READY:  "buyer",
    LOGISTICS_PENDING:        "buyer",
    ORDER_PREP_PENDING:       "seller",
    DELIVERY_DETAILS_PENDING: "buyer",
    FINAL_PAYMENT_PENDING:    "buyer",
    FINAL_PAYMENT_SUBMITTED:  "seller",
    FINAL_PAYMENT_REJECTED:   "buyer",
    SHIPPING_DOCS_PENDING:    "seller",
    RELEASED:                 "seller",
    DELIVERED:                "none",
    EXPORT_DOCS_UPLOADED:     "seller",
};

const RESPONSIBILITY_DETAIL: Record<TxStatus, { role: string; actions: string[] }> = {
    CONTRACT_PENDING:         { role: "Seller",        actions: ["Download contract template", "Upload signed contract and proforma invoice"] },
    CONTRACT_UPLOADED:        { role: "Buyer",         actions: ["Download and review seller's contract", "Sign contract and upload deposit payment proof"] },
    DEPOSIT_SUBMITTED:        { role: "Seller",        actions: ["Review signed contract and deposit proof", "Approve or reject the submission"] },
    DEPOSIT_REJECTED:         { role: "Buyer",         actions: ["Review the rejection reason", "Re-upload corrected deposit proof and signed contract"] },
    DEPOSIT_VERIFIED:         { role: "Seller",        actions: ["Enter VINs for each vehicle", "Upload at least one authorization document per VIN"] },
    VIN_SUBMITTED:            { role: "Buyer",         actions: ["Review each submitted VIN and authorization document", "Approve or reject individual VINs"] },
    INSPECTION_ADDON_OFFER:   { role: "Buyer",         actions: ["Optionally purchase an independent pre-shipment inspection", "Select vehicles and upload inspection fee payment"] },
    INSPECTION_ORDERED:       { role: "Inspector",     actions: ["Independent inspector coordinating with seller for vehicle access", "Awaiting inspection report upload"] },
    INSPECTION_REPORT_READY:  { role: "Buyer",         actions: ["Download and review the inspection report", "Acknowledge receipt to unlock final payment", "Optionally request cancellation if material discrepancy found"] },
    LOGISTICS_PENDING:        { role: "Buyer",         actions: ["Select logistics provider: UGR Lines or self-arranged", "Confirm logistics arrangement to proceed"] },
    ORDER_PREP_PENDING:       { role: "Seller",        actions: ["Confirm preparation timeline and delivery date", "Upload packing list, commercial invoice, certificate of origin, certificate of conformity"] },
    DELIVERY_DETAILS_PENDING: { role: "Buyer / Seller", actions: ["FOB/FAS: Buyer provides vessel details", "DDP/DPU: Buyer confirms delivery address", "EXW: Seller shares pickup location, buyer confirms"] },
    FINAL_PAYMENT_PENDING:    { role: "Buyer",         actions: ["Process final balance payment", "Upload payment confirmation proof"] },
    FINAL_PAYMENT_SUBMITTED:  { role: "Seller",        actions: ["Verify final payment receipt", "Approve to release asset or reject with reason"] },
    FINAL_PAYMENT_REJECTED:   { role: "Buyer",         actions: ["Review rejection reason", "Re-submit corrected payment proof"] },
    SHIPPING_DOCS_PENDING:    { role: "Seller",        actions: ["Select shipping document type (B/L, FCR, AWB, etc.)", "Upload and authorize asset release"] },
    RELEASED:                 { role: "Seller",        actions: ["Update shipment progress phases", "Upload delivery confirmation when delivered"] },
    DELIVERED:                { role: "—",             actions: ["Transaction complete — no further actions required"] },
    EXPORT_DOCS_UPLOADED:     { role: "Seller",        actions: ["Upload preparation documents and confirm delivery date"] },
};

function getDefaultTxStatus(_orderStatus?: string): TxStatus {
    return "CONTRACT_PENDING";
}

function normalizeStatus(raw: string): TxStatus {
    const known: Record<string, TxStatus> = {
        EXPORT_DOCS_UPLOADED: "EXPORT_DOCS_UPLOADED",
    };
    return (known[raw] ?? raw) as TxStatus;
}

function formatTtl(msLeft: number): string {
    if (msLeft <= 0) return "Expired";
    const totalMinutes = Math.floor(msLeft / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function shortOrderId(id: string): string {
    if (!id) return "—";
    if (id.length <= 18) return id;
    return `${id.slice(0, 8)}…${id.slice(-6)}`;
}

// ─── Icons ─────────────────────────────────────────────────────────────────────

function IconClock({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5V8.5L10.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconUser({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconAlert({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2L14.5 13H1.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M8 6.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.75" fill="currentColor" />
        </svg>
    );
}

function IconCheck({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconArrow({ className = "" }: { className?: string }) {
    return (
        <svg className={className} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function StepProgress({ step, total, isDelivered }: { step: number; total: number; isDelivered: boolean }) {
    const pct = Math.round((step / total) * 100);
    return (
        <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${isDelivered ? "bg-emerald-500" : "bg-brand-blue"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] font-semibold text-gray-400 shrink-0">Step {step}/{total}</span>
        </div>
    );
}

// ─── Single Order Card ────────────────────────────────────────────────────────

type RowData = {
    order: NegotiationOrder;
    txStatus: TxStatus;
    owner: ActionOwner;
    requiresMyAction: boolean;
    blockedReason: string;
    isUrgent: boolean;
    isExpired: boolean;
    msLeft: number | null;
    role: "buyer" | "seller";
    priority: number;
};

function OrderCard({ row }: { row: RowData }) {
    const { order, txStatus, owner, requiresMyAction, blockedReason, isUrgent, isExpired, msLeft, role } = row;
    const badge = STATUS_BADGE[txStatus] ?? STATUS_BADGE.CONTRACT_PENDING;
    const resp = RESPONSIBILITY_DETAIL[txStatus] ?? RESPONSIBILITY_DETAIL.CONTRACT_PENDING;
    const isDelivered = txStatus === "DELIVERED";
    const counterparty = role === "buyer" ? order.sellerId || "Seller" : order.buyerId || "Buyer";
    const counterpartyLabel = role === "buyer" ? "Seller" : "Buyer";

    const accentBorder = isExpired ? "border-l-red-500" : isUrgent ? "border-l-amber-400" : requiresMyAction ? "border-l-brand-blue" : isDelivered ? "border-l-emerald-400" : "border-l-transparent";
    const cardRing = requiresMyAction && !isDelivered ? isExpired ? "ring-1 ring-red-200" : isUrgent ? "ring-1 ring-amber-200" : "ring-1 ring-blue-100" : "";

    const href = role === "buyer" ? `/buyer/orders/${order.conversationId}` : `/seller/orders/${order.conversationId}`;

    return (
        <article className={`overflow-hidden rounded-2xl border-l-4 border border-stroke-light bg-white shadow-[0_12px_28px_-24px_rgba(14,30,56,0.45)] transition-shadow hover:shadow-[0_16px_36px_-24px_rgba(14,30,56,0.55)] ${accentBorder} ${cardRing}`}>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke-light bg-[#f9fafb] px-5 py-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className="font-mono font-semibold tracking-tight text-[#202C4A]">#{shortOrderId(order.conversationId)}</span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400">
                        {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="hidden sm:flex items-center gap-1.5 ml-2">
                        <StepProgress step={badge.step} total={TOTAL_STEPS} isDelivered={isDelivered} />
                    </span>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.tone}`}>{badge.label}</span>
            </div>

            <div className="p-5">
                {/* Vehicles */}
                <div className="mb-4">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Vehicles</p>
                    <div className="flex flex-wrap gap-2">
                        {order.items.map(item => (
                            <span key={item.bucketKey} className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f3f8] px-3 py-1 text-xs font-semibold text-[#202C4A]">
                                {item.name}
                                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500 shadow-sm">×{item.totalUnits}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f8f9fc] p-4 text-xs sm:grid-cols-4">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">{counterpartyLabel}</p>
                        <p className="mt-0.5 truncate font-semibold text-[#202C4A]">{counterparty}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Order Value</p>
                        <p className="mt-0.5 text-sm font-bold text-[#202C4A]">{formatPrice(order.totals.total, order.items[0]?.currency)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Action Owner</p>
                        <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${OWNER_COLOR[owner]}`}>
                            <IconUser />{OWNER_LABEL[owner]}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">SLA Countdown</p>
                        <p className={`mt-0.5 flex items-center gap-1 text-sm font-bold ${isExpired ? "text-red-600" : isUrgent ? "text-amber-600" : msLeft === null ? "text-gray-400" : "text-[#202C4A]"}`}>
                            {msLeft !== null && <IconClock />}
                            {msLeft === null ? "—" : formatTtl(msLeft)}
                        </p>
                    </div>
                </div>

                {/* Responsibility block */}
                <div className="mt-3 rounded-xl border border-stroke-light overflow-hidden">
                    <div className="flex items-start gap-3 px-4 py-3">
                        <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${OWNER_COLOR[owner]}`}>
                            {resp.role.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                                Next Required Action · <span className="text-[#202C4A]">{resp.role}</span>
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {resp.actions.map((action, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-[#202C4A]">
                                        <span className="mt-0.5 shrink-0 text-gray-400"><IconArrow /></span>
                                        {action}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {requiresMyAction && !isDelivered && (
                            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${isExpired ? "bg-red-100 text-red-700" : isUrgent ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                <IconAlert />{isExpired ? "Overdue" : isUrgent ? "Urgent" : "Your Turn"}
                            </span>
                        )}
                    </div>
                </div>

                {/* State banner */}
                {blockedReason ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        <IconAlert className="shrink-0 text-amber-500" />{blockedReason}
                    </div>
                ) : isDelivered ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                        <IconCheck className="shrink-0 text-emerald-500" />Order completed successfully
                    </div>
                ) : null}

                {/* CTA */}
                <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex-1 sm:hidden">
                        <StepProgress step={badge.step} total={TOTAL_STEPS} isDelivered={isDelivered} />
                    </div>
                    <Link href={href} className={`ml-auto inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                        requiresMyAction && !isDelivered
                            ? isExpired ? "bg-red-600 text-white hover:bg-red-700" : isUrgent ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-brand-blue text-white hover:bg-primary-hover"
                            : "bg-[#f1f3f8] text-[#202C4A] hover:bg-[#e8eaf2]"
                    }`}>
                        {requiresMyAction && !isDelivered ? "Take Action" : isDelivered ? "View Summary" : "View Order"}
                        <IconArrow className={requiresMyAction && !isDelivered ? "text-white/80" : "text-gray-400"} />
                    </Link>
                </div>
            </div>
        </article>
    );
}

// ─── Section ──────────────────────────────────────────────────────────────────

export default function NegotiationOrdersSection({ role }: Readonly<{ role: "buyer" | "seller" }>) {
    const [orders, setOrders] = useState<NegotiationOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [flowByConversation, setFlowByConversation] = useState<Record<string, TxFlowSnapshot>>({});

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/negotiation-orders?role=${role}`, { cache: "no-store" });
                if (!res.ok) { setOrders([]); return; }
                const data = await res.json();
                setOrders(data?.orders ?? []);
            } catch {
                setOrders([]);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [role]);

    useEffect(() => {
        if (!orders.length || typeof window === "undefined") return;
        const next: Record<string, TxFlowSnapshot> = {};
        for (const order of orders) {
            const raw = window.localStorage.getItem(`adpg-transaction-flow:${order.conversationId}`);
            if (!raw) continue;
            try { next[order.conversationId] = JSON.parse(raw) as TxFlowSnapshot; } catch {}
        }
        setFlowByConversation(next);
    }, [orders]);

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 60000);
        return () => window.clearInterval(id);
    }, []);

    const rows = useMemo<RowData[]>(() => {
        const enriched = orders.map(order => {
            const rawStatus = flowByConversation[order.conversationId]?.status ?? getDefaultTxStatus(order.status);
            const txStatus = normalizeStatus(rawStatus as string);
            const badge = STATUS_BADGE[txStatus] ?? STATUS_BADGE.CONTRACT_PENDING;
            const owner = STATUS_OWNER[txStatus] ?? "none";
            const ttlHours = TTL_HOURS[txStatus] ?? null;
            const expiresAt = ttlHours ? new Date(order.createdAt).getTime() + ttlHours * 60 * 60 * 1000 : null;
            const msLeft = expiresAt ? expiresAt - now : null;
            const isExpired = msLeft !== null && msLeft <= 0;
            const isUrgent = msLeft !== null && msLeft > 0 && msLeft <= 6 * 60 * 60 * 1000;
            const requiresMyAction = owner === role;
            const blockedReason =
                owner === "none" ? ""
                : owner !== role ? `Pending ${OWNER_LABEL[owner]} action`
                : isExpired ? "SLA expired — immediate action required"
                : "";
            const priority = requiresMyAction ? (isExpired ? 0 : isUrgent ? 1 : 2) : 3;
            return { order, txStatus, owner, requiresMyAction, blockedReason, isUrgent, isExpired, msLeft, role, priority, badge };
        });
        return enriched.sort((a, b) => a.priority - b.priority || new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime()) as RowData[];
    }, [flowByConversation, now, orders, role]);

    const actionNeeded = rows.filter(r => r.requiresMyAction && r.txStatus !== "DELIVERED").length;
    const urgent = rows.filter(r => r.isUrgent || r.isExpired).length;

    if (!orders.length && !loading) {
        return (
            <div className="mt-6 rounded-2xl border border-stroke-light bg-white p-8 text-center shadow-sm">
                <p className="text-sm text-gray-400">No orders yet. Confirmed negotiations will appear here.</p>
            </div>
        );
    }

    return (
        <div>
            {/* Summary strip */}
            {orders.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                    <div className="inline-flex items-center gap-2 rounded-xl border border-stroke-light bg-white px-4 py-2.5 shadow-sm">
                        <span className="text-lg font-bold text-[#202C4A]">{orders.length}</span>
                        <span className="text-xs text-gray-500">Total Orders</span>
                    </div>
                    {actionNeeded > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
                            <span className="text-lg font-bold text-blue-700">{actionNeeded}</span>
                            <span className="text-xs text-blue-600">Action Required</span>
                        </div>
                    )}
                    {urgent > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                            <IconAlert className="text-red-500" />
                            <span className="text-lg font-bold text-red-600">{urgent}</span>
                            <span className="text-xs text-red-500">Urgent / Overdue</span>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {[0, 1].map(i => <div key={i} className="h-64 animate-pulse rounded-2xl border border-stroke-light bg-gray-50" />)}
                </div>
            ) : (
                <div className="space-y-4">
                    {rows.map(row => <OrderCard key={row.order.conversationId} row={row} />)}
                </div>
            )}
        </div>
    );
}
