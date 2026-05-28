"use client";

import { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = "buyer" | "seller";
type DeliveryPhase = "PREPARING" | "AT_EXPORT_PORT" | "VESSEL_LOADED" | "IN_TRANSIT" | "ARRIVED_AT_DESTINATION" | "DELIVERED";

type TxStatus =
    | "CONTRACT_PENDING"
    | "CONTRACT_UPLOADED"
    | "DEPOSIT_SUBMITTED"
    | "DEPOSIT_REJECTED"
    | "DEPOSIT_VERIFIED"
    | "VIN_SUBMITTED"
    | "INSPECTION_ADDON_OFFER"    // buyer decides to purchase inspection or skip
    | "INSPECTION_ORDERED"        // paid + ordered; seller notified; awaiting report
    | "INSPECTION_REPORT_READY"   // report available; buyer acknowledges; may request cancellation
    | "LOGISTICS_PENDING"
    | "ORDER_PREP_PENDING"
    | "DELIVERY_DETAILS_PENDING"
    | "FINAL_PAYMENT_PENDING"
    | "FINAL_PAYMENT_SUBMITTED"
    | "FINAL_PAYMENT_REJECTED"
    | "SHIPPING_DOCS_PENDING"
    | "RELEASED"
    | "DELIVERED";

type VinDocAttachment = {
    docType: string;
    file: string | null;
};

type VinEntry = {
    id: string;
    bucketLabel: string;
    marketType: "second_hand" | "zero_km";
    vin: string;
    docs: VinDocAttachment[];
    otherDocName: string;
    buyerApproved: boolean;
    removed?: boolean;
};

type VinAmendment = {
    status: "none" | "pending_buyer" | "approved" | "rejected";
    entryId: string | null;
    originalVin: string;
    replacementVin: string;
    replacementImages: string[];
    odometerPhoto: string | null;
    conditionDeclaration: string;
    confirmIdentity: boolean;
    chaboschiEnriched: boolean;
    buyerDecisionReason: string | null;
};

type FlowState = {
    status: TxStatus;
    // Step 1 – Contract & Deposit
    contractTemplate: string | null;
    contractSigned: string | null;
    proformaInvoice: string | null;
    depositProof: string | null;
    depositRejectionReason: string | null;
    // Step 2 – VIN Disclosure
    vinEntries: VinEntry[];
    vinReviewRejectionReason: string | null;
    selectedVinEntryIds: string[];
    vinAmendment: VinAmendment;
    // Step 3 – Inspection add-on (buyer-initiated, second-hand only)
    inspection: {
        // Purchase
        purchased: boolean;
        skipped: boolean;
        linkedVinIds: string[];       // VINs selected by buyer for inspection
        paymentProof: string | null;  // inspection fee receipt (paid separately)
        orderedAt: string | null;
        // Report (uploaded by inspection company / simulated)
        reportFile: string | null;
        reportUploadedAt: string | null;
        // Acknowledgment
        buyerAcknowledged: boolean;
        acknowledgedAt: string | null;
        // Discrepancy & cancellation
        hasMaterialDiscrepancy: boolean;
        discrepancyNotes: string;
        cancellationRequested: boolean;
        cancellationReason: string;
        sellerCancellationResponse: "none" | "agreed" | "disputed";
        sellerDisputeNotes: string;
    };
    // Deal cancellation (resolved after inspection or other reason)
    dealCancelled: boolean;
    dealCancelledReason: string;
    // Step 4 – Logistics
    logistics: {
        provider: "UGR" | "other" | null;
        notes: string;
        confirmed: boolean;
    };
    // Step 5 – Order Prep
    orderPrep: {
        timeline: string;
        packingList: string | null;
        commercialInvoice: string | null;
        certOfOrigin: string | null;
        certOfConformity: string | null;
        deliveryDate: string;
        sellerSubmitted: boolean;
    };
    // Step 5b – Delivery Details
    deliveryDetails: {
        vesselName: string;
        shippingLine: string;
        etd: string;
        eta: string;
        portOfLoading: string;
        deliveryAddress: string;
        pickupLocation: string;
        sellerSharedPickup: boolean;
        buyerConfirmed: boolean;
    };
    // Step 6 – Final Payment
    finalPaymentProof: string | null;
    finalPaymentRejectionReason: string | null;
    // Step 7 – Release
    shippingDoc: {
        type: string;
        file: string | null;
        isUGRMasked: boolean;
    };
    deliveryPhase: DeliveryPhase;
    // Audit
    auditTrail: Array<{
        at: string;
        actor: "buyer" | "seller" | "system";
        action: string;
        details: string;
    }>;
};

type Props = {
    conversationId: string;
    role: Role;
    sellerName: string;
    createdAtLabel: string;
    currency: string;
    incoterm?: string;
    logisticsPartner?: "UGR" | "None";
    totals: { total: number; downpayment: number; pending: number };
    orderItems: Array<{
        key: string;
        label: string;
        totalUnits: number;
        marketType: "second_hand" | "zero_km";
    }>;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_PREFIX = "adpg-transaction-flow";

const SHIPPING_DOC_TYPES = [
    "Bill of Lading (B/L)",
    "Forwarder Cargo Receipt (FCR)",
    "Air Waybill (AWB)",
    "Carrier Receipt",
    "Proof of Delivery (POD)",
    "Terminal Handover Confirmation",
];

const stepMap: Record<TxStatus, number> = {
    CONTRACT_PENDING: 1,
    CONTRACT_UPLOADED: 1,
    DEPOSIT_SUBMITTED: 1,
    DEPOSIT_REJECTED: 1,
    DEPOSIT_VERIFIED: 2,
    VIN_SUBMITTED: 2,
    INSPECTION_ADDON_OFFER: 3,
    INSPECTION_ORDERED: 3,
    INSPECTION_REPORT_READY: 3,
    LOGISTICS_PENDING: 4,
    ORDER_PREP_PENDING: 5,
    DELIVERY_DETAILS_PENDING: 5,
    FINAL_PAYMENT_PENDING: 6,
    FINAL_PAYMENT_SUBMITTED: 6,
    FINAL_PAYMENT_REJECTED: 6,
    SHIPPING_DOCS_PENDING: 7,
    RELEASED: 7,
    DELIVERED: 7,
};

const allDeliveryPhases: DeliveryPhase[] = [
    "PREPARING", "AT_EXPORT_PORT", "VESSEL_LOADED", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "DELIVERED",
];

const deliveryPhaseLabels: Record<DeliveryPhase, string> = {
    PREPARING: "Preparing",
    AT_EXPORT_PORT: "At Export Port",
    VESSEL_LOADED: "Vessel Loaded",
    IN_TRANSIT: "In Transit",
    ARRIVED_AT_DESTINATION: "Arrived at Destination",
    DELIVERED: "Delivered",
};

const vinDocsByMarket = {
    zero_km: ["Traders invoice", "Vehicle license", "Customs entry document"],
    second_hand: ["Registration certificate or title", "Export certificate (where applicable)", "Deregistration proof (if available)"],
};

// ─── Utilities ────────────────────────────────────────────────────────────────

const fm = (v: number, cur: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 }).format(v || 0);

const mockFile = (name: string) => `${name.replace(/\s/g, "_")}_${Date.now().toString(36).toUpperCase()}.pdf`;

// ─── Helper components ────────────────────────────────────────────────────────

function UploadZone({
    title, desc = "", file, onUpload, onRemove, tone = "blue",
}: Readonly<{ title: string; desc?: string; file: string | null; onUpload: () => void; onRemove?: () => void; tone?: "blue" | "green" }>) {
    return (
        <div className={`rounded-xl border p-4 transition-colors ${file ? (tone === "green" ? "border-emerald-300 bg-emerald-50" : "border-blue-300 bg-blue-50") : "border-stroke-light bg-white hover:border-brand-blue/40"}`}>
            <p className="text-sm font-semibold text-[#202C4A]">{title}</p>
            {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
            {file ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="truncate text-xs font-medium text-gray-700">{file}</span>
                    <button type="button" onClick={onUpload} className="shrink-0 text-xs text-brand-blue hover:underline">Replace</button>
                    {onRemove && <button type="button" onClick={onRemove} className="shrink-0 text-xs text-red-600 hover:underline">Remove</button>}
                </div>
            ) : (
                <button type="button" onClick={onUpload} className="mt-2 w-full rounded-lg border border-dashed border-stroke-light px-3 py-2 text-xs text-gray-500 hover:border-brand-blue/40 hover:text-brand-blue">
                    + Upload File
                </button>
            )}
        </div>
    );
}

function WaitingCard({ party, detail }: Readonly<{ party: string; detail?: string }>) {
    return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Waiting for {party}</p>
            {detail && <p className="mt-1 text-xs text-amber-800">{detail}</p>}
        </div>
    );
}

function DocRow({ label, value }: Readonly<{ label: string; value: string | null }>) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-stroke-light bg-white px-3 py-2 text-xs">
            <span className="text-gray-500">{label}</span>
            <span className={`font-semibold truncate max-w-[180px] ${value ? "text-[#202C4A]" : "text-gray-400"}`}>{value || "Not uploaded"}</span>
        </div>
    );
}

function FieldInput({ label, value, onChange, placeholder, type = "text" }: Readonly<{
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}>) {
    return (
        <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-stroke-light px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
        </div>
    );
}

function PrimaryBtn({ label, onClick, disabled = false, color = "blue" }: Readonly<{
    label: string; onClick: () => void; disabled?: boolean; color?: "blue" | "green" | "red";
}>) {
    const cls = color === "green"
        ? "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300"
        : color === "red"
        ? "bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300"
        : "bg-brand-blue text-white hover:bg-primary-hover disabled:bg-gray-300";
    return (
        <button type="button" disabled={disabled} onClick={onClick} className={`w-full rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${cls}`}>
            {label}
        </button>
    );
}

function OutlineBtn({ label, onClick, disabled = false, tone = "default" }: Readonly<{
    label: string; onClick: () => void; disabled?: boolean; tone?: "default" | "red" | "green";
}>) {
    const cls = tone === "red"
        ? "border-red-200 text-red-600 hover:bg-red-50"
        : tone === "green"
        ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        : "border-stroke-light text-[#202C4A] hover:bg-gray-50";
    return (
        <button type="button" disabled={disabled} onClick={onClick} className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}>
            {label}
        </button>
    );
}

function StepHeading({ step, title, subtitle }: Readonly<{ step: number; title: string; subtitle?: string }>) {
    return (
        <div className="mb-5 border-b border-stroke-light pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Step {step}</p>
            <h2 className="mt-1 text-xl font-bold text-[#202C4A]">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </div>
    );
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialFlowState: FlowState = {
    status: "CONTRACT_PENDING",
    contractTemplate: "Contract_Template_v1.pdf",
    contractSigned: null,
    proformaInvoice: null,
    depositProof: null,
    depositRejectionReason: null,
    vinEntries: [],
    vinReviewRejectionReason: null,
    selectedVinEntryIds: [],
    vinAmendment: {
        status: "none",
        entryId: null,
        originalVin: "",
        replacementVin: "",
        replacementImages: [],
        odometerPhoto: null,
        conditionDeclaration: "",
        confirmIdentity: false,
        chaboschiEnriched: false,
        buyerDecisionReason: null,
    },
    inspection: {
        purchased: false,
        skipped: false,
        linkedVinIds: [],
        paymentProof: null,
        orderedAt: null,
        reportFile: null,
        reportUploadedAt: null,
        buyerAcknowledged: false,
        acknowledgedAt: null,
        hasMaterialDiscrepancy: false,
        discrepancyNotes: "",
        cancellationRequested: false,
        cancellationReason: "",
        sellerCancellationResponse: "none",
        sellerDisputeNotes: "",
    },
    dealCancelled: false,
    dealCancelledReason: "",
    logistics: { provider: null, notes: "", confirmed: false },
    orderPrep: {
        timeline: "",
        packingList: null,
        commercialInvoice: null,
        certOfOrigin: null,
        certOfConformity: null,
        deliveryDate: "",
        sellerSubmitted: false,
    },
    deliveryDetails: {
        vesselName: "",
        shippingLine: "",
        etd: "",
        eta: "",
        portOfLoading: "",
        deliveryAddress: "",
        pickupLocation: "",
        sellerSharedPickup: false,
        buyerConfirmed: false,
    },
    finalPaymentProof: null,
    finalPaymentRejectionReason: null,
    shippingDoc: { type: "", file: null, isUGRMasked: false },
    deliveryPhase: "PREPARING",
    auditTrail: [],
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TransactionManagementFlow({
    conversationId, role, sellerName, createdAtLabel, currency,
    incoterm = "FOB", logisticsPartner = "None",
    totals, orderItems,
}: Readonly<Props>) {
    const [currentView, setCurrentView] = useState<Role>(role);
    const [state, setState] = useState<FlowState>(initialFlowState);
    const [rejectOpen, setRejectOpen] = useState<"deposit" | "final" | "vin" | "vin_amendment" | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [viewingStep, setViewingStep] = useState<number | null>(null);
    const [viewingDoc, setViewingDoc] = useState<{ label: string; file: string } | null>(null);

    const incotermUpper = incoterm.toUpperCase();
    const hasSecondHand = orderItems.some(i => i.marketType === "second_hand");
    const needsLogistics = ["FOB", "FAS"].includes(incotermUpper);
    const skipDeliveryDetails = incotermUpper === "CIF";

    // Load from localStorage
    useEffect(() => {
        const key = `${STORAGE_PREFIX}:${conversationId}`;
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        if (raw) {
            try {
                const parsed = JSON.parse(raw) as Partial<FlowState>;
                // Migrate legacy statuses
                if ((parsed.status as string) === "EXPORT_DOCS_UPLOADED") parsed.status = "ORDER_PREP_PENDING";
                setState(prev => ({ ...prev, ...parsed }));
                return;
            } catch {}
        }
        // Fresh init with VIN entries
        const entries: VinEntry[] = [];
        for (const item of orderItems) {
            for (let i = 0; i < item.totalUnits; i++) {
                entries.push({
                    id: `${item.key}-${i + 1}`,
                    bucketLabel: item.label,
                    marketType: item.marketType,
                    vin: "",
                    docs: [],
                    otherDocName: "",
                    buyerApproved: false,
                });
            }
        }
        setState({ ...initialFlowState, vinEntries: entries });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    // Init VIN entries if missing after load
    useEffect(() => {
        setState(prev => {
            if (prev.vinEntries.length > 0) return prev;
            const entries: VinEntry[] = [];
            for (const item of orderItems) {
                for (let i = 0; i < item.totalUnits; i++) {
                    entries.push({
                        id: `${item.key}-${i + 1}`,
                        bucketLabel: item.label,
                        marketType: item.marketType,
                        vin: "",
                        docs: [],
                        otherDocName: "",
                        buyerApproved: false,
                    });
                }
            }
            return { ...prev, vinEntries: entries };
        });
    }, [orderItems]);

    // Persist
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(`${STORAGE_PREFIX}:${conversationId}`, JSON.stringify(state));
        }
    }, [conversationId, state]);

    // ─── Derived ──────────────────────────────────────────────────────────────

    const currentStep = stepMap[state.status] ?? 1;

    const turn = useMemo<"buyer" | "seller" | "none">(() => {
        if (state.vinAmendment.status === "pending_buyer") return "buyer";
        switch (state.status) {
            case "CONTRACT_PENDING": return "seller";
            case "CONTRACT_UPLOADED": return "buyer";
            case "DEPOSIT_SUBMITTED": return "seller";
            case "DEPOSIT_REJECTED": return "buyer";
            case "DEPOSIT_VERIFIED": return "seller";
            case "VIN_SUBMITTED": return "buyer";
            case "INSPECTION_ADDON_OFFER": return "buyer";
            case "INSPECTION_ORDERED": return "none"; // waiting for external inspector
            case "INSPECTION_REPORT_READY":
                if (state.inspection.cancellationRequested && state.inspection.sellerCancellationResponse === "none") return "seller";
                return state.inspection.buyerAcknowledged ? "none" : "buyer";
            case "LOGISTICS_PENDING": return "buyer";
            case "ORDER_PREP_PENDING": return "seller";
            case "DELIVERY_DETAILS_PENDING":
                if (incotermUpper === "EXW" && !state.deliveryDetails.sellerSharedPickup) return "seller";
                return "buyer";
            case "FINAL_PAYMENT_PENDING": return "buyer";
            case "FINAL_PAYMENT_SUBMITTED": return "seller";
            case "FINAL_PAYMENT_REJECTED": return "buyer";
            case "SHIPPING_DOCS_PENDING": return "seller";
            case "RELEASED": return "seller";
            case "DELIVERED": return "none";
            default: return "none";
        }
    }, [state.status, state.vinAmendment.status, state.inspection.cancellationRequested, state.inspection.sellerCancellationResponse, state.inspection.buyerAcknowledged, state.deliveryDetails.sellerSharedPickup, incotermUpper]);

    // ─── Transitions ─────────────────────────────────────────────────────────

    const getNextAfterVin = () => hasSecondHand ? "INSPECTION_ADDON_OFFER" : needsLogistics ? "LOGISTICS_PENDING" : "ORDER_PREP_PENDING";
    const getNextAfterInspection = () => needsLogistics ? "LOGISTICS_PENDING" : "ORDER_PREP_PENDING";
    const getNextAfterOrderPrep = () => skipDeliveryDetails ? "FINAL_PAYMENT_PENDING" : "DELIVERY_DETAILS_PENDING";

    // ─── Audit ────────────────────────────────────────────────────────────────

    const addAudit = (actor: "buyer" | "seller" | "system", action: string, details: string) =>
        setState(prev => ({ ...prev, auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor, action, details }] }));

    const transition = (newStatus: TxStatus, actor: "buyer" | "seller" | "system", action: string, details: string) =>
        setState(prev => ({
            ...prev,
            status: newStatus,
            auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor, action, details }],
        }));

    // ─── VIN helpers ─────────────────────────────────────────────────────────

    const activeVinEntries = state.vinEntries.filter(e => !e.removed);
    const allVinSellerReady = activeVinEntries.length > 0 && activeVinEntries.every(e => e.vin.trim().length >= 5 && e.docs.some(d => d.file));
    const allVinBuyerApproved = activeVinEntries.length > 0 && activeVinEntries.every(e => e.buyerApproved);
    const selectedVinEntries = activeVinEntries.filter(e => state.selectedVinEntryIds.includes(e.id));
    const isVinAmendmentPending = state.vinAmendment.status === "pending_buyer";
    const isVinAmendmentRejected = state.vinAmendment.status === "rejected";
    const isVinProgressBlocked = isVinAmendmentPending || isVinAmendmentRejected;

    const vinSections = useMemo(() =>
        orderItems.map((item, idx) => ({
            n: idx + 1,
            key: item.key,
            label: item.label,
            marketType: item.marketType,
            entries: state.vinEntries.filter(e => e.id.startsWith(`${item.key}-`) && !e.removed),
        })),
    [orderItems, state.vinEntries]);

    const updateVinEntry = (id: string, patch: Partial<VinEntry>) =>
        setState(prev => ({ ...prev, vinEntries: prev.vinEntries.map(v => v.id === id ? { ...v, ...patch } : v) }));

    const addVinDoc = (entryId: string, docType: string) => {
        const mockName = mockFile(docType.split(" (")[0].slice(0, 20));
        setState(prev => ({
            ...prev,
            vinEntries: prev.vinEntries.map(v =>
                v.id === entryId
                    ? { ...v, buyerApproved: false, docs: [...v.docs.filter(d => d.docType !== docType), { docType, file: mockName }] }
                    : v
            ),
        }));
    };

    const removeVinDoc = (entryId: string, docType: string) =>
        setState(prev => ({
            ...prev,
            vinEntries: prev.vinEntries.map(v =>
                v.id === entryId ? { ...v, buyerApproved: false, docs: v.docs.filter(d => d.docType !== docType) } : v
            ),
        }));

    const autoCompleteToStep = (stepN: number) => {
        if (stepN < 1 || stepN > 7) return;
        setState(prev => {
            const nowIso = new Date().toISOString();
            const withStep1: FlowState = {
                ...prev,
                contractTemplate: prev.contractTemplate || "Contract_Template_v1.pdf",
                contractSigned: prev.contractSigned || mockFile("Buyer_Signed_Contract"),
                proformaInvoice: prev.proformaInvoice || mockFile("Proforma_Invoice"),
                depositProof: prev.depositProof || mockFile("Deposit_Proof"),
                depositRejectionReason: null,
                status: "DEPOSIT_VERIFIED",
            };

            const withStep2Vins: FlowState = {
                ...withStep1,
                vinEntries: withStep1.vinEntries.map((v, idx) => ({
                    ...v,
                    vin: v.vin || `AUTO${String(idx + 1).padStart(6, "0")}`,
                    docs: v.docs.length ? v.docs : [{ docType: vinDocsByMarket[v.marketType][0], file: mockFile("VIN_Doc") }],
                    buyerApproved: true,
                })),
                selectedVinEntryIds: [],
                vinReviewRejectionReason: null,
                vinAmendment: { ...withStep1.vinAmendment, status: "none", buyerDecisionReason: null },
                status: hasSecondHand ? "INSPECTION_ADDON_OFFER" : needsLogistics ? "LOGISTICS_PENDING" : "ORDER_PREP_PENDING",
            };

            const withStep3Inspection: FlowState = hasSecondHand
                ? {
                      ...withStep2Vins,
                      inspection: {
                          ...withStep2Vins.inspection,
                          purchased: true,
                          skipped: false,
                          linkedVinIds: withStep2Vins.vinEntries.filter(v => !v.removed).map(v => v.id),
                          paymentProof: withStep2Vins.inspection.paymentProof || mockFile("Inspection_Fee"),
                          orderedAt: withStep2Vins.inspection.orderedAt || nowIso,
                          reportFile: withStep2Vins.inspection.reportFile || mockFile("Inspection_Report"),
                          reportUploadedAt: withStep2Vins.inspection.reportUploadedAt || nowIso,
                          buyerAcknowledged: true,
                          acknowledgedAt: withStep2Vins.inspection.acknowledgedAt || nowIso,
                          cancellationRequested: false,
                          cancellationReason: "",
                          sellerCancellationResponse: "none",
                          sellerDisputeNotes: "",
                      },
                      status: needsLogistics ? "LOGISTICS_PENDING" : "ORDER_PREP_PENDING",
                  }
                : withStep2Vins;

            const withStep4Logistics: FlowState = {
                ...withStep3Inspection,
                logistics: {
                    provider: withStep3Inspection.logistics.provider || (logisticsPartner === "UGR" ? "UGR" : "other"),
                    notes: withStep3Inspection.logistics.notes || "Auto-completed logistics setup",
                    confirmed: true,
                },
                status: "ORDER_PREP_PENDING",
            };

            const withStep5OrderPrep: FlowState = {
                ...withStep4Logistics,
                orderPrep: {
                    timeline: withStep4Logistics.orderPrep.timeline || "10 working days",
                    packingList: withStep4Logistics.orderPrep.packingList || mockFile("Packing_List"),
                    commercialInvoice: withStep4Logistics.orderPrep.commercialInvoice || mockFile("Commercial_Invoice"),
                    certOfOrigin: withStep4Logistics.orderPrep.certOfOrigin || mockFile("Certificate_Of_Origin"),
                    certOfConformity: withStep4Logistics.orderPrep.certOfConformity || mockFile("Certificate_Of_Conformity"),
                    deliveryDate: withStep4Logistics.orderPrep.deliveryDate || new Date().toISOString().slice(0, 10),
                    sellerSubmitted: true,
                },
                deliveryDetails: {
                    ...withStep4Logistics.deliveryDetails,
                    vesselName: withStep4Logistics.deliveryDetails.vesselName || "MSC Demo",
                    shippingLine: withStep4Logistics.deliveryDetails.shippingLine || "MSC",
                    etd: withStep4Logistics.deliveryDetails.etd || new Date().toISOString().slice(0, 10),
                    eta: withStep4Logistics.deliveryDetails.eta || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                    portOfLoading: withStep4Logistics.deliveryDetails.portOfLoading || "Shanghai",
                    deliveryAddress: withStep4Logistics.deliveryDetails.deliveryAddress || "Abu Dhabi, UAE",
                    pickupLocation: withStep4Logistics.deliveryDetails.pickupLocation || "Seller Yard A",
                    sellerSharedPickup: true,
                    buyerConfirmed: true,
                },
                status: "FINAL_PAYMENT_PENDING",
            };

            const withStep6FinalPayment: FlowState = {
                ...withStep5OrderPrep,
                finalPaymentProof: withStep5OrderPrep.finalPaymentProof || mockFile("Final_Payment_Proof"),
                finalPaymentRejectionReason: null,
                status: "SHIPPING_DOCS_PENDING",
            };

            const withStep7Release: FlowState = {
                ...withStep6FinalPayment,
                shippingDoc: {
                    type: withStep6FinalPayment.shippingDoc.type || "Bill of Lading (B/L)",
                    file: withStep6FinalPayment.shippingDoc.file || mockFile("Bill_Of_Lading"),
                    isUGRMasked: withStep6FinalPayment.shippingDoc.isUGRMasked || logisticsPartner === "UGR",
                },
                deliveryPhase: "DELIVERED",
                status: "DELIVERED",
            };

            const finalState =
                stepN === 1 ? withStep1 :
                stepN === 2 ? withStep2Vins :
                stepN === 3 ? withStep3Inspection :
                stepN === 4 ? withStep4Logistics :
                stepN === 5 ? withStep5OrderPrep :
                stepN === 6 ? withStep6FinalPayment :
                withStep7Release;

            return {
                ...finalState,
                auditTrail: [
                    ...finalState.auditTrail,
                    { at: nowIso, actor: "system", action: "STEP_AUTOCOMPLETED", details: `Auto-completed flow to step ${stepN}` },
                ],
            };
        });
    };

    const addOtherVinDoc = (entryId: string) => {
        const entry = state.vinEntries.find(v => v.id === entryId);
        if (!entry?.otherDocName.trim()) return;
        const docType = `Other: ${entry.otherDocName.trim()}`;
        const mockName = mockFile(entry.otherDocName.trim().slice(0, 20));
        setState(prev => ({
            ...prev,
            vinEntries: prev.vinEntries.map(v =>
                v.id === entryId
                    ? { ...v, buyerApproved: false, otherDocName: "", docs: [...v.docs, { docType, file: mockName }] }
                    : v
            ),
        }));
    };

    // ─── Financial summary ────────────────────────────────────────────────────

    const financial = [
        { label: "Incoterm", value: incoterm },
        { label: "Logistics", value: logisticsPartner === "UGR" ? "UGR Lines" : "Buyer Arranged" },
        { label: "Deposit (10%)", value: fm(totals.downpayment, currency) },
        { label: "Balance Due", value: fm(totals.pending, currency) },
        { label: "Total Value", value: fm(totals.total, currency) },
    ];

    // ─── Sidebar steps ────────────────────────────────────────────────────────

    const sidebarSteps = [
        { n: 1, title: "Contract & Deposit", skip: false, optional: false },
        { n: 2, title: "VIN Disclosure", skip: false, optional: false },
        { n: 3, title: "Inspection Report", skip: !hasSecondHand, optional: true },
        { n: 4, title: "Logistics Setup", skip: !needsLogistics, optional: true },
        { n: 5, title: "Order Preparation", skip: false, optional: false },
        { n: 6, title: "Final Payment", skip: false, optional: false },
        { n: 7, title: "Release & Delivery", skip: false, optional: false },
    ];

    // ══════════════════════════════════════════════════════════════════════════
    // PANEL RENDERERS
    // ══════════════════════════════════════════════════════════════════════════

    // ─── Step 1: Contract & Deposit ───────────────────────────────────────────

    const renderContractDeposit = () => {
        const st = state.status;

        // Seller: upload contract + proforma
        if (st === "CONTRACT_PENDING") {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={1} title="Contract & Proforma Invoice" subtitle="Download the template, fill in details, and upload the signed contract together with the proforma invoice." />
                    <button type="button" onClick={() => addAudit("seller", "CONTRACT_TEMPLATE_DOWNLOADED", "Contract template downloaded")}
                        className="w-full rounded-xl border border-brand-blue/30 bg-brand-blue/5 px-4 py-3 text-sm font-semibold text-brand-blue hover:bg-brand-blue/10">
                        ↓ Download Contract Template
                    </button>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <UploadZone title="Signed Contract" desc="Your signed version of the contract" file={state.contractSigned} onUpload={() => setState(p => ({ ...p, contractSigned: mockFile("Seller_Contract") }))} onRemove={() => setState(p => ({ ...p, contractSigned: null }))} />
                        <UploadZone title="Proforma Invoice" desc="Itemised proforma for this order" file={state.proformaInvoice} onUpload={() => setState(p => ({ ...p, proformaInvoice: mockFile("Proforma_Invoice") }))} onRemove={() => setState(p => ({ ...p, proformaInvoice: null }))} />
                    </div>
                    <PrimaryBtn label="Notify Buyer to Sign & Pay Deposit" disabled={!state.contractSigned || !state.proformaInvoice}
                        onClick={() => transition("CONTRACT_UPLOADED", "seller", "CONTRACT_UPLOADED", "Seller uploaded contract and proforma invoice")} />
                </div>
            );
            return <WaitingCard party="Seller" detail="Seller is preparing the signed contract and proforma invoice." />;
        }

        // Buyer: sign + pay deposit
        if (st === "CONTRACT_UPLOADED") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={1} title="Sign Contract & Pay Deposit" subtitle="Review the seller's contract, sign it, and upload your deposit payment proof." />
                    <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
                        <p className="text-sm font-semibold text-[#202C4A]">Contract from Seller</p>
                        <p className="mt-1 text-xs text-gray-600">{state.contractSigned || "Seller_Contract.pdf"}</p>
                        <p className="mt-1 text-xs text-gray-600">Proforma Invoice: {state.proformaInvoice || "Proforma_Invoice.pdf"}</p>
                        <button type="button" onClick={() => addAudit("buyer", "CONTRACT_DOWNLOADED", "Buyer downloaded contract")} className="mt-3 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
                            Download Contract
                        </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <UploadZone title="Signed Contract (Buyer Copy)" desc="Your countersigned version" file={state.contractSigned} onUpload={() => setState(p => ({ ...p, contractSigned: mockFile("Buyer_Signed_Contract") }))} onRemove={() => setState(p => ({ ...p, contractSigned: null }))} />
                        <UploadZone title="Deposit Payment Proof" desc="Bank transfer confirmation or receipt" file={state.depositProof} onUpload={() => setState(p => ({ ...p, depositProof: mockFile("Deposit_Proof") }))} onRemove={() => setState(p => ({ ...p, depositProof: null }))} tone="green" />
                    </div>
                    {state.depositRejectionReason && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                            <p className="font-semibold">Previous submission rejected:</p>
                            <p className="mt-1">{state.depositRejectionReason}</p>
                        </div>
                    )}
                    <PrimaryBtn label="Submit for Deposit Verification" disabled={!state.contractSigned || !state.depositProof}
                        onClick={() => transition("DEPOSIT_SUBMITTED", "buyer", "DEPOSIT_SUBMITTED", "Buyer submitted signed contract and deposit proof")} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is reviewing the contract and processing the deposit payment." />;
        }

        // Seller verifies deposit
        if (st === "DEPOSIT_SUBMITTED") {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={1} title="Verify Deposit & Documents" subtitle="Review the buyer's signed contract and deposit payment proof, then confirm or reject." />
                    <div className="space-y-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <DocRow label="Buyer Signed Contract" value={state.contractSigned} />
                        <DocRow label="Deposit Payment Proof" value={state.depositProof} />
                    </div>
                    <PrimaryBtn label="Approve — Deposit Verified" color="green"
                        onClick={() => transition("DEPOSIT_VERIFIED", "seller", "DEPOSIT_VERIFIED", "Seller verified deposit and documents")} />
                    <OutlineBtn label="Reject Submission" tone="red" onClick={() => setRejectOpen("deposit")} />
                </div>
            );
            return (
                <div className="space-y-4">
                    <WaitingCard party="Seller" detail="Seller is verifying your contract signature and deposit payment." />
                    <div className="space-y-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <DocRow label="Signed Contract" value={state.contractSigned} />
                        <DocRow label="Deposit Proof" value={state.depositProof} />
                    </div>
                </div>
            );
        }

        // Deposit rejected – buyer resubmits
        if (st === "DEPOSIT_REJECTED") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={1} title="Re-submit Deposit" subtitle="Your deposit submission was rejected. Please review the reason and re-upload." />
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                        <p className="font-semibold">Rejection reason:</p>
                        <p className="mt-1">{state.depositRejectionReason || "No reason provided."}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <UploadZone title="Signed Contract" file={state.contractSigned} onUpload={() => setState(p => ({ ...p, contractSigned: mockFile("Buyer_Signed_Contract") }))} onRemove={() => setState(p => ({ ...p, contractSigned: null }))} />
                        <UploadZone title="Deposit Payment Proof" file={state.depositProof} onUpload={() => setState(p => ({ ...p, depositProof: mockFile("Deposit_Proof") }))} onRemove={() => setState(p => ({ ...p, depositProof: null }))} tone="green" />
                    </div>
                    <PrimaryBtn label="Re-submit for Verification" disabled={!state.contractSigned || !state.depositProof}
                        onClick={() => transition("DEPOSIT_SUBMITTED", "buyer", "DEPOSIT_RESUBMITTED", "Buyer resubmitted deposit after rejection")} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is correcting and resubmitting their deposit documents." />;
        }

        return null;
    };

    // ─── Step 2: VIN Disclosure ───────────────────────────────────────────────

    const renderVINAmendment = () => {
        if (!isVinAmendmentPending && !isVinAmendmentRejected) return null;

        // Buyer decision panel
        if (isVinAmendmentPending && currentView === "buyer") return (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-4">
                <div>
                    <p className="text-sm font-semibold text-amber-900">VIN Amendment Request — Action Required</p>
                    <p className="mt-1 text-xs text-amber-800">Transaction is frozen until you approve or reject this change.</p>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-lg border border-stroke-light bg-white p-3">
                        <p className="text-gray-500">Original VIN</p>
                        <p className="mt-1 font-semibold text-[#202C4A]">{state.vinAmendment.originalVin || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-stroke-light bg-white p-3">
                        <p className="text-gray-500">Replacement VIN</p>
                        <p className="mt-1 font-semibold text-[#202C4A]">{state.vinAmendment.replacementVin || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-stroke-light bg-white p-3">
                        <p className="text-gray-500">Condition Declaration</p>
                        <p className="mt-1 font-medium text-[#202C4A]">{state.vinAmendment.conditionDeclaration || "—"}</p>
                    </div>
                    <div className="rounded-lg border border-stroke-light bg-white p-3">
                        <p className="text-gray-500">Replacement Images / Odometer</p>
                        <p className="mt-1 font-medium text-[#202C4A]">{state.vinAmendment.replacementImages.length} images · {state.vinAmendment.odometerPhoto ? "Odometer ✓" : "No odometer"}</p>
                    </div>
                </div>
                {state.vinAmendment.chaboschiEnriched && <p className="text-xs font-medium text-emerald-700">✓ Chabosch enrichment completed for replacement VIN</p>}
                <div className="flex gap-3">
                    <OutlineBtn label="Approve VIN Change" tone="green" onClick={() => setState(prev => ({
                        ...prev,
                        vinEntries: prev.vinEntries.map(v => v.id === prev.vinAmendment.entryId ? { ...v, vin: prev.vinAmendment.replacementVin, buyerApproved: true } : v),
                        vinAmendment: { ...prev.vinAmendment, status: "approved", buyerDecisionReason: null },
                        auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor: "buyer", action: "VIN_AMENDMENT_APPROVED", details: `Approved replacement to ${prev.vinAmendment.replacementVin}` }],
                    }))} />
                    <OutlineBtn label="Reject VIN Change" tone="red" onClick={() => setRejectOpen("vin_amendment")} />
                </div>
            </div>
        );

        // Seller rejection handling
        if (isVinAmendmentRejected && currentView === "seller") return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-800">Buyer rejected VIN amendment</p>
                <p className="text-xs text-red-700">Reason: {state.vinAmendment.buyerDecisionReason || "No reason provided"}</p>
                <OutlineBtn label="Restore original VIN" onClick={() => setState(prev => ({
                    ...prev,
                    vinEntries: prev.vinEntries.map(v => v.id === prev.vinAmendment.entryId ? { ...v, vin: prev.vinAmendment.originalVin, buyerApproved: false } : v),
                    vinAmendment: { ...initialFlowState.vinAmendment },
                    auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "VIN_RESTORED_ORIGINAL", details: "Original VIN restored after rejection" }],
                }))} />
                <OutlineBtn label="Remove this vehicle from deal" tone="red" onClick={() => setState(prev => {
                    const remaining = prev.vinEntries.filter(v => !v.removed);
                    if (remaining.length <= 1) return prev;
                    return {
                        ...prev,
                        vinEntries: prev.vinEntries.map(v => v.id === prev.vinAmendment.entryId ? { ...v, removed: true, buyerApproved: true } : v),
                        vinAmendment: { ...initialFlowState.vinAmendment },
                        auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "VIN_REMOVED_FROM_DEAL", details: "Vehicle removed; contract update and partial refund may be required" }],
                    };
                })} />
                <OutlineBtn label="Cancel entire deal" tone="red" onClick={() => transition("DEPOSIT_REJECTED", "seller", "DEAL_CANCELLED", "Seller cancelled deal after VIN amendment rejection")} />
            </div>
        );

        return null;
    };

    const canOpenVinAmendment = hasSecondHand && allVinBuyerApproved;

    const renderVinAmendmentRequestForm = () => {
        if (!canOpenVinAmendment || isVinAmendmentPending || isVinAmendmentRejected || !activeVinEntries.some(e => e.vin.trim())) return null;
        return (
            <details className="rounded-xl border border-stroke-light bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#202C4A]">Request VIN Amendment</summary>
                <div className="border-t border-stroke-light p-4 space-y-4">
                    <p className="text-xs text-gray-600">Use this for post-deposit VIN changes. The buyer must approve all amendments. Chabosch enrichment is triggered automatically on submit.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-gray-600">VIN to replace</label>
                            <select
                                value={state.vinAmendment.entryId || ""}
                                onChange={e => {
                                    const target = state.vinEntries.find(v => v.id === e.target.value);
                                    setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, entryId: e.target.value || null, originalVin: target?.vin || "" } }));
                                }}
                                className="w-full rounded-lg border border-stroke-light px-3 py-2 text-xs">
                                <option value="">Select vehicle</option>
                                {activeVinEntries.map(e => <option key={e.id} value={e.id}>{e.id} — {e.vin || "No VIN yet"}</option>)}
                            </select>
                        </div>
                        <FieldInput label="Replacement VIN" value={state.vinAmendment.replacementVin}
                            onChange={v => setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, replacementVin: v } }))} placeholder="New VIN" />
                        <FieldInput label="Updated Condition Declaration" value={state.vinAmendment.conditionDeclaration}
                            onChange={v => setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, conditionDeclaration: v } }))} placeholder="Describe condition" />
                        <div className="space-y-2">
                            <button type="button" onClick={() => setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, replacementImages: [...prev.vinAmendment.replacementImages, mockFile("Replacement_Photo")] } }))}
                                className="w-full rounded-lg border border-dashed border-stroke-light px-3 py-2 text-xs text-brand-blue hover:border-brand-blue/40">
                                + Upload Replacement Vehicle Photo ({state.vinAmendment.replacementImages.length})
                            </button>
                            <button type="button" onClick={() => setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, odometerPhoto: mockFile("Odometer") } }))}
                                className={`w-full rounded-lg border border-dashed border-stroke-light px-3 py-2 text-xs hover:border-brand-blue/40 ${state.vinAmendment.odometerPhoto ? "text-emerald-700" : "text-brand-blue"}`}>
                                {state.vinAmendment.odometerPhoto ? `✓ ${state.vinAmendment.odometerPhoto}` : "+ Upload Odometer Photo (Second-hand required)"}
                            </button>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700">
                        <input type="checkbox" checked={state.vinAmendment.confirmIdentity}
                            onChange={e => setState(prev => ({ ...prev, vinAmendment: { ...prev.vinAmendment, confirmIdentity: e.target.checked } }))} />
                        I confirm identical Make, Model, Variant, Year, Color, and condition grading
                    </label>
                    <PrimaryBtn label="Submit VIN Amendment for Buyer Approval" color="blue"
                        disabled={!state.vinAmendment.entryId || !state.vinAmendment.replacementVin.trim() || state.vinAmendment.replacementImages.length < 1 || !state.vinAmendment.conditionDeclaration.trim() || !state.vinAmendment.confirmIdentity}
                        onClick={() => setState(prev => ({
                            ...prev,
                            vinAmendment: { ...prev.vinAmendment, status: "pending_buyer", chaboschiEnriched: true, buyerDecisionReason: null },
                            vinEntries: prev.vinEntries.map(v => v.id === prev.vinAmendment.entryId ? { ...v, buyerApproved: false } : v),
                            auditTrail: [...prev.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "VIN_AMENDMENT_REQUESTED", details: `Requested ${prev.vinAmendment.originalVin} → ${prev.vinAmendment.replacementVin}` }],
                        }))} />
                </div>
            </details>
        );
    };

const renderVIN = () => {
        const st = state.status;

        if (st === "DEPOSIT_VERIFIED") {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={2} title="VIN Disclosure & Authorization Documents" subtitle="Enter each vehicle's VIN and upload at least one authorization document per vehicle." />
                    {isVinProgressBlocked && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                            Transaction progression is frozen while a VIN amendment is under review.
                        </div>
                    )}
                    {renderVINAmendment()}

                    {/* Amendment form (for post-initial VINs) */}
                    {renderVinAmendmentRequestForm()}

                    {/* Per-vehicle VIN entry */}
                    <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                        {vinSections.map(section => {
                            const docOptions = vinDocsByMarket[section.marketType];
                            return (
                                <div key={section.key} className="rounded-xl border border-stroke-light bg-white overflow-hidden">
                                    <div className="border-b border-stroke-light bg-[#f8fafc] px-4 py-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Vehicle Group {section.n}</p>
                                        <p className="mt-0.5 font-semibold text-[#202C4A]">{section.label}</p>
                                        <p className="text-xs text-gray-500">{section.marketType === "second_hand" ? "Second-hand" : "Zero KM"} · {section.entries.length} vehicles</p>
                                    </div>
                                    <div className="p-3 space-y-4">
                                        {section.entries.map((entry, idx) => (
                                            <div key={entry.id} className="rounded-lg border border-stroke-light p-3 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs font-semibold text-gray-600">Vehicle #{idx + 1}</p>
                                                    {entry.docs.some(d => d.file) && entry.vin.trim() && (
                                                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Ready</span>
                                                    )}
                                                </div>
                                                <input
                                                    value={entry.vin}
                                                    onChange={e => updateVinEntry(entry.id, { vin: e.target.value, buyerApproved: false })}
                                                    placeholder="Enter VIN (min 5 characters)"
                                                    className="w-full rounded-lg border border-stroke-light px-3 py-2 text-sm font-mono focus:border-brand-blue focus:outline-none"
                                                />
                                                <div>
                                                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400">Authorization Documents (upload at least one)</p>
                                                    <div className="space-y-1.5">
                                                        {docOptions.map(docType => {
                                                            const uploaded = entry.docs.find(d => d.docType === docType);
                                                            return (
                                                                <div key={docType} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${uploaded?.file ? "border-emerald-200 bg-emerald-50" : "border-stroke-light bg-white"}`}>
                                                                    <span className={`flex-1 truncate ${uploaded?.file ? "font-medium text-emerald-800" : "text-gray-600"}`}>
                                                                        {uploaded?.file ? `✓ ${uploaded.file}` : docType}
                                                                    </span>
                                                                    {uploaded?.file
                                                                        ? <button type="button" onClick={() => removeVinDoc(entry.id, docType)} className="shrink-0 text-red-600 hover:underline">Remove</button>
                                                                        : <button type="button" onClick={() => addVinDoc(entry.id, docType)} className="shrink-0 font-semibold text-brand-blue hover:underline">Upload</button>
                                                                    }
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Other docs */}
                                                        {entry.docs.filter(d => d.docType.startsWith("Other:")).map(d => (
                                                            <div key={d.docType} className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                                                                <span className="flex-1 truncate font-medium text-emerald-800">✓ {d.file} <span className="text-gray-500">({d.docType})</span></span>
                                                                <button type="button" onClick={() => removeVinDoc(entry.id, d.docType)} className="shrink-0 text-red-600">Remove</button>
                                                            </div>
                                                        ))}
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                value={entry.otherDocName}
                                                                onChange={e => updateVinEntry(entry.id, { otherDocName: e.target.value })}
                                                                placeholder="Other document name…"
                                                                className="flex-1 rounded-lg border border-dashed border-stroke-light px-3 py-1.5 text-xs focus:border-brand-blue focus:outline-none"
                                                            />
                                                            <button type="button" disabled={!entry.otherDocName.trim()} onClick={() => addOtherVinDoc(entry.id)}
                                                                className="shrink-0 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-3 py-1.5 text-xs font-medium text-brand-blue disabled:opacity-40 hover:bg-brand-blue/10">
                                                                + Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <PrimaryBtn label="Submit VINs for Buyer Confirmation" disabled={!allVinSellerReady || isVinProgressBlocked}
                        onClick={() => transition("VIN_SUBMITTED", "seller", "VIN_SUBMITTED", `Seller submitted ${activeVinEntries.length} VINs with authorization documents`)} />
                </div>
            );
            return <WaitingCard party="Seller" detail="Seller is disclosing VINs and uploading authorization documents for each vehicle." />;
        }

        if (st === "VIN_SUBMITTED") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={2} title="Confirm VINs & Authorization Documents" subtitle="Review each vehicle's VIN and uploaded documents. Approve or reject individually." />
                    {isVinAmendmentPending && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                            A VIN amendment request is pending your decision. Transaction progression is frozen.
                        </div>
                    )}
                    {renderVINAmendment()}
                    {state.vinReviewRejectionReason && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            Previous rejection: {state.vinReviewRejectionReason}
                        </div>
                    )}

                    {/* Select all / clear */}
                    <div className="flex gap-3">
                        <OutlineBtn label="Select All" onClick={() => setState(p => ({ ...p, selectedVinEntryIds: activeVinEntries.map(v => v.id) }))} />
                        <OutlineBtn label="Clear Selection" onClick={() => setState(p => ({ ...p, selectedVinEntryIds: [] }))} />
                    </div>

                    <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
                        {vinSections.map(section => (
                            <div key={section.key} className="rounded-xl border border-stroke-light bg-white overflow-hidden">
                                <div className="border-b border-stroke-light bg-[#f8fafc] px-4 py-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Vehicle Group {section.n}</p>
                                    <p className="mt-0.5 font-semibold text-[#202C4A]">{section.label}</p>
                                    <p className="text-xs text-gray-500">{section.entries.length} vehicles</p>
                                </div>
                                <div className="p-3 space-y-3">
                                    {section.entries.map((entry, idx) => (
                                        <div key={entry.id} className={`rounded-lg border p-3 ${entry.buyerApproved ? "border-emerald-200 bg-emerald-50/30" : "border-stroke-light"}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                                                    <input type="checkbox" checked={state.selectedVinEntryIds.includes(entry.id)}
                                                        onChange={e => setState(prev => ({ ...prev, selectedVinEntryIds: e.target.checked ? [...prev.selectedVinEntryIds, entry.id] : prev.selectedVinEntryIds.filter(id => id !== entry.id) }))} />
                                                    Vehicle #{idx + 1}
                                                </label>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.buyerApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                                    {entry.buyerApproved ? "Approved" : "Pending"}
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="text-gray-500">VIN</span>
                                                    <span className="font-mono font-semibold text-[#202C4A]">{entry.vin || "—"}</span>
                                                </div>
                                                {entry.docs.map(d => (
                                                    <div key={d.docType} className="flex items-center justify-between text-xs">
                                                        <span className="text-gray-500">{d.docType.replace("Other: ", "Other — ")}</span>
                                                        <button type="button" className="text-brand-blue hover:underline truncate max-w-[150px]">{d.file}</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3">
                        <OutlineBtn label="Approve Selected" tone="green"
                            disabled={selectedVinEntries.length === 0 || isVinProgressBlocked}
                            onClick={() => setState(p => ({
                                ...p,
                                vinEntries: p.vinEntries.map(v => p.selectedVinEntryIds.includes(v.id) ? { ...v, buyerApproved: true } : v),
                                selectedVinEntryIds: [],
                                vinReviewRejectionReason: null,
                            }))} />
                        <OutlineBtn label="Reject Selected" tone="red"
                            disabled={selectedVinEntries.length === 0 || isVinProgressBlocked}
                            onClick={() => setRejectOpen("vin")} />
                    </div>

                    <PrimaryBtn label="Confirm All VINs & Proceed" disabled={!allVinBuyerApproved || isVinProgressBlocked}
                        onClick={() => transition(getNextAfterVin() as TxStatus, "buyer", "VIN_CONFIRMED", `Buyer confirmed all ${activeVinEntries.length} VINs`)} />
                </div>
            );
            if (currentView === "seller") {
                return (
                    <div className="space-y-5">
                        <StepHeading step={2} title="VIN Disclosure" subtitle="Buyer is reviewing submitted VINs. You can still initiate VIN amendment from this stage." />
                        {isVinProgressBlocked && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                Transaction progression is frozen while a VIN amendment is under review.
                            </div>
                        )}
                        {renderVINAmendment()}
                        {renderVinAmendmentRequestForm()}
                        <div className="text-xs text-gray-500 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                            <p className="mb-2 font-semibold text-[#202C4A]">{activeVinEntries.length} VINs submitted</p>
                            {activeVinEntries.slice(0, 6).map(e => (
                                <div key={e.id} className="flex items-center justify-between py-0.5">
                                    <span className="font-mono">{e.vin || "—"}</span>
                                    <span className={e.buyerApproved ? "text-emerald-700" : "text-amber-700"}>{e.buyerApproved ? "Approved" : "Pending"}</span>
                                </div>
                            ))}
                        </div>
                        <WaitingCard party="Buyer" detail="Buyer is reviewing the submitted VINs and authorization documents." />
                    </div>
                );
            }
            return <WaitingCard party="Buyer" detail="Buyer is reviewing the submitted VINs and authorization documents." />;
        }

        return null;
    };

    // ─── Step 3: Inspection Add-on (buyer-initiated, second-hand only) ───────────

    const INSPECTION_FEE_PER_VEHICLE = 150; // USD (or order currency)

    const renderInspection = () => {
        const { inspection } = state;
        const inspectableVins = activeVinEntries.filter(e => e.marketType === "second_hand");
        const selectedCount = inspection.linkedVinIds.length;
        const totalFee = selectedCount * INSPECTION_FEE_PER_VEHICLE;

        // ── Phase 1: Offer ─────────────────────────────────────────────────────
        if (state.status === "INSPECTION_ADDON_OFFER") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={3} title="Inspection Add-on" subtitle="Optionally purchase an independent pre-shipment inspection before final payment. Not mandatory." />

                    {/* What's included */}
                    <div className="rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4 space-y-2">
                        <p className="text-sm font-semibold text-[#202C4A]">What&apos;s included</p>
                        <ul className="space-y-1 text-xs text-gray-600">
                            {["Physical vehicle condition assessment", "Mileage & odometer verification", "Documentation cross-check against VIN", "Discrepancy report (if any) shared with both parties"].map(item => (
                                <li key={item} className="flex items-start gap-2">
                                    <span className="mt-0.5 text-brand-blue">✓</span>{item}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2 text-xs font-semibold text-gray-500">Fee: {fm(INSPECTION_FEE_PER_VEHICLE, currency)} per vehicle · Paid separately · 2–5 business days</p>
                    </div>

                    {/* VIN selection */}
                    <div>
                        <p className="mb-2 text-sm font-semibold text-[#202C4A]">Select vehicles for inspection</p>
                        <div className="space-y-2">
                            {inspectableVins.map(entry => (
                                <label key={entry.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${inspection.linkedVinIds.includes(entry.id) ? "border-brand-blue bg-brand-blue/5" : "border-stroke-light bg-white hover:border-brand-blue/30"}`}>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" className="h-4 w-4 accent-brand-blue"
                                            checked={inspection.linkedVinIds.includes(entry.id)}
                                            onChange={e => setState(p => ({
                                                ...p,
                                                inspection: {
                                                    ...p.inspection,
                                                    linkedVinIds: e.target.checked
                                                        ? [...p.inspection.linkedVinIds, entry.id]
                                                        : p.inspection.linkedVinIds.filter(id => id !== entry.id),
                                                },
                                            }))} />
                                        <div>
                                            <p className="text-sm font-semibold text-[#202C4A]">{entry.bucketLabel}</p>
                                            <p className="text-xs font-mono text-gray-500">{entry.vin || "VIN pending"}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold text-gray-600">{fm(INSPECTION_FEE_PER_VEHICLE, currency)}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Fee summary + payment */}
                    {selectedCount > 0 && (
                        <div className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">{selectedCount} vehicle{selectedCount > 1 ? "s" : ""} × {fm(INSPECTION_FEE_PER_VEHICLE, currency)}</span>
                                <span className="text-base font-bold text-[#202C4A]">{fm(totalFee, currency)}</span>
                            </div>
                            <UploadZone title="Inspection Fee Payment Receipt"
                                desc="Upload proof of payment for the inspection fee (paid to the inspection provider)"
                                file={inspection.paymentProof}
                                onUpload={() => setState(p => ({ ...p, inspection: { ...p.inspection, paymentProof: mockFile("Inspection_Fee_Receipt") } }))}
                                onRemove={() => setState(p => ({ ...p, inspection: { ...p.inspection, paymentProof: null } }))}
                                tone="green" />
                        </div>
                    )}

                    <PrimaryBtn label={`Purchase Inspection for ${selectedCount} Vehicle${selectedCount !== 1 ? "s" : ""} — ${fm(totalFee, currency)}`}
                        disabled={selectedCount === 0 || !inspection.paymentProof}
                        onClick={() => {
                            const now = new Date().toISOString();
                            setState(p => ({ ...p, status: "INSPECTION_ORDERED", inspection: { ...p.inspection, purchased: true, orderedAt: now } }));
                            addAudit("buyer", "INSPECTION_ORDERED", `Inspection purchased for ${selectedCount} VIN(s). Fee: ${fm(totalFee, currency)}`);
                        }} />
                    <OutlineBtn label="Skip — Proceed without Inspection"
                        onClick={() => {
                            setState(p => ({ ...p, status: getNextAfterInspection() as TxStatus, inspection: { ...p.inspection, skipped: true } }));
                            addAudit("buyer", "INSPECTION_SKIPPED", "Buyer chose to proceed without inspection");
                        }} />
                </div>
            );
            // Seller waiting view
            return (
                <div className="space-y-4">
                    <WaitingCard party="Buyer" detail="Buyer is deciding whether to purchase a pre-shipment inspection add-on." />
                    <div className="rounded-xl border border-stroke-light bg-[#f8fafc] px-4 py-3 text-xs text-gray-600">
                        <p className="font-semibold text-[#202C4A]">What this means for you</p>
                        <p className="mt-1">If the buyer orders an inspection, an independent inspector will contact you to arrange vehicle access. This does not affect your preparation timeline.</p>
                    </div>
                </div>
            );
        }

        // ── Phase 2: Ordered — waiting for report ──────────────────────────────
        if (state.status === "INSPECTION_ORDERED") {
            const inspectedVinLabels = activeVinEntries
                .filter(e => inspection.linkedVinIds.includes(e.id))
                .map(e => `${e.bucketLabel} (${e.vin || "VIN TBC"})`);

            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={3} title="Inspection Ordered" subtitle="Your inspection has been paid and ordered. The inspector will coordinate with the seller." />
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <span className="text-emerald-700">●</span>
                            <p className="text-sm font-semibold text-emerald-900">Inspection In Progress</p>
                        </div>
                        <div className="grid gap-2 text-xs">
                            <div className="flex justify-between"><span className="text-gray-500">Ordered on</span><span className="font-semibold text-[#202C4A]">{inspection.orderedAt ? new Date(inspection.orderedAt).toLocaleDateString() : "—"}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Fee paid</span><span className="font-semibold text-emerald-700">{fm(selectedCount * INSPECTION_FEE_PER_VEHICLE, currency)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Vehicles</span><span className="font-semibold text-[#202C4A]">{selectedCount}</span></div>
                        </div>
                        <div className="text-xs text-gray-600">
                            <p className="font-semibold mb-1">VINs under inspection:</p>
                            <ul className="space-y-0.5 list-disc list-inside">{inspectedVinLabels.map(v => <li key={v}>{v}</li>)}</ul>
                        </div>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                        The seller has been notified to provide inspector access. You will be notified when the report is ready.
                    </div>
                    {/* Simulate report arrival (demo only) */}
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                        <p className="text-xs text-gray-400 mb-2">⚙ Demo: Simulate inspector uploading the report</p>
                        <button type="button"
                            onClick={() => {
                                const now = new Date().toISOString();
                                setState(p => ({ ...p, status: "INSPECTION_REPORT_READY", inspection: { ...p.inspection, reportFile: mockFile("Inspection_Report_Official"), reportUploadedAt: now } }));
                                addAudit("system", "INSPECTION_REPORT_UPLOADED", "Inspection report uploaded by inspector");
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100">
                            Mark Report as Ready
                        </button>
                    </div>
                </div>
            );

            // Seller view: notification
            return (
                <div className="space-y-5">
                    <StepHeading step={3} title="Inspection Notice" subtitle="The buyer has ordered a pre-shipment inspection for the following vehicles." />
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-900">⚠ Inspection Access Required</p>
                        <p className="text-xs text-amber-800">An independent inspector will contact you to arrange access to the vehicles listed below. Please ensure they are accessible and match the agreed specification.</p>
                        <div className="rounded-lg border border-stroke-light bg-white p-3 space-y-1 text-xs">
                            <p className="font-semibold text-gray-600 mb-1">Vehicles under inspection:</p>
                            <ul className="space-y-1 list-disc list-inside text-[#202C4A]">{inspectedVinLabels.map(v => <li key={v}>{v}</li>)}</ul>
                        </div>
                    </div>
                    <div className="rounded-xl border border-stroke-light bg-[#f8fafc] px-4 py-3 text-xs text-gray-600">
                        The final payment is locked until the buyer acknowledges the inspection report. This does not affect your preparation timeline.
                    </div>
                </div>
            );
        }

        // ── Phase 3: Report ready ──────────────────────────────────────────────
        if (state.status === "INSPECTION_REPORT_READY") {
            const inspectedVinLabels = activeVinEntries
                .filter(e => inspection.linkedVinIds.includes(e.id))
                .map(e => `${e.bucketLabel} — ${e.vin || "VIN TBC"}`);

            // Seller view: can download report + respond to cancellation
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={3} title="Inspection Report — Seller Access" />
                    <div className="space-y-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <DocRow label="Inspection Report" value={inspection.reportFile} />
                        <DocRow label="Report Date" value={inspection.reportUploadedAt ? new Date(inspection.reportUploadedAt).toLocaleDateString() : null} />
                        {inspection.reportFile && (
                            <button type="button" className="mt-2 rounded-lg bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
                                ↓ Download Report
                            </button>
                        )}
                    </div>
                    {inspection.cancellationRequested && inspection.sellerCancellationResponse === "none" && (
                        <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                            <p className="text-sm font-semibold text-red-800">Buyer Requested Cancellation</p>
                            <div className="rounded-lg border border-stroke-light bg-white p-3 text-xs">
                                <p className="font-semibold text-gray-600">Buyer&apos;s discrepancy notes:</p>
                                <p className="mt-1 text-[#202C4A]">{inspection.discrepancyNotes || "No notes provided."}</p>
                                <p className="mt-1 font-semibold text-gray-600">Cancellation reason:</p>
                                <p className="mt-1 text-[#202C4A]">{inspection.cancellationReason}</p>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">Your response / dispute notes (optional)</label>
                                <textarea value={inspection.sellerDisputeNotes}
                                    onChange={e => setState(p => ({ ...p, inspection: { ...p.inspection, sellerDisputeNotes: e.target.value } }))}
                                    placeholder="Provide your assessment of the buyer's claims…"
                                    className="w-full rounded-lg border border-stroke-light px-3 py-2 text-sm focus:border-brand-blue focus:outline-none" rows={3} />
                            </div>
                            <OutlineBtn label="Agree — Cancel the Deal" tone="red"
                                onClick={() => {
                                    setState(p => ({
                                        ...p,
                                        dealCancelled: true,
                                        dealCancelledReason: `Buyer cancellation approved. Discrepancy: ${p.inspection.discrepancyNotes}`,
                                        inspection: { ...p.inspection, sellerCancellationResponse: "agreed" },
                                    }));
                                    addAudit("seller", "DEAL_CANCELLED_AGREED", "Seller agreed to buyer's cancellation request");
                                }} />
                            <OutlineBtn label="Dispute — Proceed to Final Payment" tone="default"
                                onClick={() => {
                                    setState(p => ({ ...p, inspection: { ...p.inspection, sellerCancellationResponse: "disputed" } }));
                                    addAudit("seller", "CANCELLATION_DISPUTED", `Seller disputed cancellation. Notes: ${inspection.sellerDisputeNotes || "none"}`);
                                }} />
                        </div>
                    )}
                    {inspection.sellerCancellationResponse === "disputed" && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                            You have disputed the cancellation request. The buyer may now proceed to final payment or escalate to platform support.
                        </div>
                    )}
                    {!inspection.cancellationRequested && !inspection.buyerAcknowledged && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                            Final payment is locked until the buyer acknowledges this inspection report.
                        </div>
                    )}
                    {inspection.buyerAcknowledged && !inspection.cancellationRequested && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                            ✓ Buyer acknowledged the report. Final payment step is now unlocked.
                        </div>
                    )}
                </div>
            );

            // Buyer view: download + acknowledge + optional cancellation request
            return (
                <div className="space-y-5">
                    <StepHeading step={3} title="Inspection Report Ready" subtitle="Download and review the inspection report. You must acknowledge receipt before making final payment." />

                    {/* Disputed notice */}
                    {inspection.sellerCancellationResponse === "disputed" && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                            <p className="font-semibold">Seller disputed your cancellation request</p>
                            <p className="mt-1 text-xs">{inspection.sellerDisputeNotes || "No additional notes."}</p>
                            <p className="mt-2 text-xs">You may now proceed to final payment or contact platform support.</p>
                        </div>
                    )}

                    {/* Cancellation pending */}
                    {inspection.cancellationRequested && inspection.sellerCancellationResponse === "none" && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">Cancellation request sent</p>
                            <p className="mt-1 text-xs">Waiting for seller to respond. Final payment remains locked.</p>
                        </div>
                    )}

                    {/* Report card */}
                    <div className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Inspection Report</p>
                                <p className="mt-0.5 text-sm font-semibold text-[#202C4A]">{inspection.reportFile}</p>
                                <p className="text-xs text-gray-500">Uploaded {inspection.reportUploadedAt ? new Date(inspection.reportUploadedAt).toLocaleDateString() : "—"}</p>
                            </div>
                            <button type="button" className="rounded-xl bg-brand-blue px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
                                ↓ Download
                            </button>
                        </div>
                        <div className="text-xs">
                            <p className="font-semibold text-gray-600 mb-1">Inspected vehicles:</p>
                            <ul className="space-y-0.5 list-disc list-inside text-[#202C4A]">{inspectedVinLabels.map(v => <li key={v}>{v}</li>)}</ul>
                        </div>
                    </div>

                    {/* Acknowledge */}
                    {!inspection.buyerAcknowledged && !inspection.cancellationRequested && (
                        <>
                            <PrimaryBtn label="Acknowledge Receipt of Report — Proceed" color="green"
                                onClick={() => {
                                    const now = new Date().toISOString();
                                    setState(p => ({ ...p, status: getNextAfterInspection() as TxStatus, inspection: { ...p.inspection, buyerAcknowledged: true, acknowledgedAt: now } }));
                                    addAudit("buyer", "INSPECTION_ACKNOWLEDGED", "Buyer acknowledged receipt of inspection report");
                                }} />

                            {/* Discrepancy / cancellation section */}
                            <details className="rounded-xl border border-red-200 bg-red-50">
                                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-red-700">
                                    Report reveals a material discrepancy? — Request cancellation
                                </summary>
                                <div className="border-t border-red-200 p-4 space-y-3">
                                    <p className="text-xs text-red-700">If the inspection reveals a material difference from the original listing (condition, mileage, damage), you may request order cancellation before final payment. The seller will review the report and your claim.</p>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-red-700">Describe the discrepancy</label>
                                        <textarea value={inspection.discrepancyNotes}
                                            onChange={e => setState(p => ({ ...p, inspection: { ...p.inspection, discrepancyNotes: e.target.value } }))}
                                            placeholder="Describe how the vehicle differs from the original listing…"
                                            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none" rows={3} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-red-700">Cancellation reason</label>
                                        <textarea value={inspection.cancellationReason}
                                            onChange={e => setState(p => ({ ...p, inspection: { ...p.inspection, cancellationReason: e.target.value } }))}
                                            placeholder="State your grounds for cancellation…"
                                            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none" rows={2} />
                                    </div>
                                    <PrimaryBtn label="Submit Cancellation Request" color="red"
                                        disabled={!inspection.discrepancyNotes.trim() || !inspection.cancellationReason.trim()}
                                        onClick={() => {
                                            setState(p => ({ ...p, inspection: { ...p.inspection, hasMaterialDiscrepancy: true, cancellationRequested: true } }));
                                            addAudit("buyer", "CANCELLATION_REQUESTED", `Material discrepancy: ${inspection.discrepancyNotes}`);
                                        }} />
                                </div>
                            </details>
                        </>
                    )}

                    {/* Already acknowledged + no cancellation */}
                    {inspection.buyerAcknowledged && !inspection.cancellationRequested && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
                            ✓ You acknowledged this report on {inspection.acknowledgedAt ? new Date(inspection.acknowledgedAt).toLocaleDateString() : "—"}. Proceeding to next step…
                        </div>
                    )}

                    {/* Proceed after dispute */}
                    {inspection.sellerCancellationResponse === "disputed" && (
                        <PrimaryBtn label="Proceed to Final Payment" color="blue"
                            onClick={() => transition(getNextAfterInspection() as TxStatus, "buyer", "INSPECTION_DISPUTE_BYPASS", "Buyer proceeded after seller disputed cancellation")} />
                    )}
                </div>
            );
        }

        return null;
    };

    // ─── Step 4: Logistics ────────────────────────────────────────────────────

    const renderLogistics = () => {
        if (currentView === "buyer") return (
            <div className="space-y-5">
                <StepHeading step={4} title="Logistics Setup" subtitle={`Your deal is ${incotermUpper}. Select a logistics provider for the ocean freight leg.`} />
                <div className="grid gap-4 sm:grid-cols-2">
                    {(["UGR", "other"] as const).map(provider => (
                        <button key={provider} type="button"
                            onClick={() => setState(p => ({ ...p, logistics: { ...p.logistics, provider } }))}
                            className={`rounded-xl border-2 p-4 text-left transition-colors ${state.logistics.provider === provider ? "border-brand-blue bg-brand-blue/5" : "border-stroke-light bg-white hover:border-brand-blue/30"}`}>
                            <p className="font-semibold text-[#202C4A]">{provider === "UGR" ? "UGR Lines" : "Self-Arranged"}</p>
                            <p className="mt-1 text-xs text-gray-500">{provider === "UGR" ? "Platform-integrated logistics. B/L will be shared directly with the platform." : "You will arrange shipping independently. Provide your logistics details."}</p>
                        </button>
                    ))}
                </div>
                {state.logistics.provider === "other" && (
                    <FieldInput label="Your logistics provider / notes" value={state.logistics.notes}
                        onChange={v => setState(p => ({ ...p, logistics: { ...p.logistics, notes: v } }))} placeholder="e.g., Kuehne+Nagel, booking ref, contact…" />
                )}
                {state.logistics.provider === "UGR" && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                        <p className="font-semibold">UGR Lines selected</p>
                        <p className="mt-1">The Bill of Lading will be shared with the platform and restricted from direct buyer view per platform policy.</p>
                    </div>
                )}
                <PrimaryBtn label="Confirm Logistics" disabled={!state.logistics.provider || (state.logistics.provider === "other" && !state.logistics.notes.trim())}
                    onClick={() => {
                        setState(p => ({ ...p, logistics: { ...p.logistics, confirmed: true } }));
                        transition("ORDER_PREP_PENDING", "buyer", "LOGISTICS_CONFIRMED", `Buyer selected logistics: ${state.logistics.provider === "UGR" ? "UGR Lines" : "Self-arranged"}`);
                    }} />
            </div>
        );

        return <WaitingCard party="Buyer" detail="Buyer is selecting the logistics provider for this shipment." />;
    };

    // ─── Step 5a: Order Preparation ───────────────────────────────────────────

    const renderOrderPrep = () => {
        const { orderPrep } = state;
        const primaryMarketType = orderItems[0]?.marketType;
        const timelineLabel = primaryMarketType === "second_hand"
            ? "Preparation Timeline (confirmed with buyer in negotiation)"
            : "Order Preparation Timeline (from negotiation module)";
        const allDocsUploaded = orderPrep.packingList && orderPrep.commercialInvoice && orderPrep.certOfOrigin && orderPrep.certOfConformity;

        if (currentView === "seller") return (
            <div className="space-y-5">
                <StepHeading step={5} title="Order Preparation" subtitle="Upload all required shipping preparation documents and confirm the delivery date." />
                <div className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4 space-y-3">
                    <FieldInput label={timelineLabel} value={orderPrep.timeline} onChange={v => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, timeline: v } }))} placeholder={primaryMarketType === "second_hand" ? "e.g., 10 working days from order confirmation" : "e.g., 45 days from production confirmation"} />
                    <FieldInput label="Confirmed Delivery Date" value={orderPrep.deliveryDate} type="date" onChange={v => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, deliveryDate: v } }))} />
                </div>
                <div>
                    <p className="mb-3 text-sm font-semibold text-[#202C4A]">Required Preparation Documents</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <UploadZone title="Packing List" file={orderPrep.packingList} onUpload={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, packingList: mockFile("Packing_List") } }))} onRemove={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, packingList: null } }))} />
                        <UploadZone title="Commercial Invoice" file={orderPrep.commercialInvoice} onUpload={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, commercialInvoice: mockFile("Commercial_Invoice") } }))} onRemove={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, commercialInvoice: null } }))} />
                        <UploadZone title="Certificate of Origin" file={orderPrep.certOfOrigin} onUpload={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, certOfOrigin: mockFile("Cert_of_Origin") } }))} onRemove={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, certOfOrigin: null } }))} />
                        <UploadZone title="Certificate of Conformity" file={orderPrep.certOfConformity} onUpload={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, certOfConformity: mockFile("Cert_of_Conformity") } }))} onRemove={() => setState(p => ({ ...p, orderPrep: { ...p.orderPrep, certOfConformity: null } }))} />
                    </div>
                </div>
                <PrimaryBtn label="Submit Preparation Documents" disabled={!allDocsUploaded || !orderPrep.deliveryDate || !orderPrep.timeline}
                    onClick={() => {
                        setState(p => ({ ...p, orderPrep: { ...p.orderPrep, sellerSubmitted: true } }));
                        transition(getNextAfterOrderPrep() as TxStatus, "seller", "ORDER_PREP_SUBMITTED", `Seller submitted preparation documents. Delivery: ${orderPrep.deliveryDate}`);
                    }} />
            </div>
        );

        return (
            <div className="space-y-4">
                <WaitingCard party="Seller" detail="Seller is preparing and uploading shipping documents (packing list, commercial invoice, certificates)." />
                <div className="grid gap-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4 text-xs sm:grid-cols-2">
                    <DocRow label="Packing List" value={orderPrep.packingList} />
                    <DocRow label="Commercial Invoice" value={orderPrep.commercialInvoice} />
                    <DocRow label="Certificate of Origin" value={orderPrep.certOfOrigin} />
                    <DocRow label="Certificate of Conformity" value={orderPrep.certOfConformity} />
                </div>
            </div>
        );
    };

    // ─── Step 5b: Delivery Details ────────────────────────────────────────────

    const renderDeliveryDetails = () => {
        const { deliveryDetails } = state;

        const isFobFas = ["FOB", "FAS"].includes(incotermUpper);
        const isDdpDpu = ["DDP", "DPU"].includes(incotermUpper);
        const isExw = incotermUpper === "EXW";

        // EXW seller phase
        if (isExw && !deliveryDetails.sellerSharedPickup) {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={5} title="Delivery Details — Pickup Location" subtitle={`Incoterm: ${incoterm} — Share the pickup location address with the buyer.`} />
                    <FieldInput label="Pickup Location / Address" value={deliveryDetails.pickupLocation}
                        onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, pickupLocation: v } }))}
                        placeholder="Full address including postcode, country…" />
                    <PrimaryBtn label="Share Pickup Location with Buyer" disabled={!deliveryDetails.pickupLocation.trim()}
                        onClick={() => {
                            setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, sellerSharedPickup: true } }));
                            addAudit("seller", "PICKUP_LOCATION_SHARED", `EXW pickup: ${deliveryDetails.pickupLocation}`);
                        }} />
                </div>
            );
            return <WaitingCard party="Seller" detail="Seller is sharing the EXW pickup location address." />;
        }

        // EXW buyer confirmation phase
        if (isExw && deliveryDetails.sellerSharedPickup && !deliveryDetails.buyerConfirmed) {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={5} title="Delivery Details — Confirm Pickup" subtitle={`Incoterm: ${incoterm} — The seller has shared the pickup location. Confirm you acknowledge it.`} />
                    <div className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Pickup Location</p>
                        <p className="text-sm font-semibold text-[#202C4A]">{deliveryDetails.pickupLocation}</p>
                    </div>
                    <PrimaryBtn label="Acknowledge Pickup Location — Proceed" color="green"
                        onClick={() => transition("FINAL_PAYMENT_PENDING", "buyer", "DELIVERY_DETAILS_CONFIRMED", `Buyer acknowledged EXW pickup: ${deliveryDetails.pickupLocation}`)} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is reviewing the pickup location provided." />;
        }

        // FOB/FAS buyer provides vessel details
        if (isFobFas) {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={5} title={`Delivery Details — Vessel Information (${incoterm})`} subtitle="Provide the nominated vessel details for the ocean freight shipment." />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <FieldInput label="Vessel Name" value={deliveryDetails.vesselName} onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, vesselName: v } }))} placeholder="e.g., MSC Mediterranean" />
                        <FieldInput label="Shipping Line" value={deliveryDetails.shippingLine} onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, shippingLine: v } }))} placeholder="e.g., MSC, Maersk, CMA CGM" />
                        <FieldInput label="Port of Loading" value={deliveryDetails.portOfLoading} onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, portOfLoading: v } }))} placeholder="e.g., Port of Shanghai" />
                        <FieldInput label="ETD (Est. Departure)" value={deliveryDetails.etd} type="date" onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, etd: v } }))} />
                        <FieldInput label="ETA (Est. Arrival)" value={deliveryDetails.eta} type="date" onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, eta: v } }))} />
                    </div>
                    <PrimaryBtn label="Confirm Vessel Details — Proceed to Final Payment"
                        disabled={!deliveryDetails.vesselName.trim() || !deliveryDetails.shippingLine.trim() || !deliveryDetails.etd || !deliveryDetails.eta}
                        onClick={() => transition("FINAL_PAYMENT_PENDING", "buyer", "DELIVERY_DETAILS_CONFIRMED", `Vessel: ${deliveryDetails.vesselName} via ${deliveryDetails.shippingLine}`)} />
                </div>
            );
            return (
                <div className="space-y-4">
                    <WaitingCard party="Buyer" detail="Buyer is providing vessel details for the ocean freight shipment." />
                    <div className="space-y-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <DocRow label="Vessel Name" value={deliveryDetails.vesselName || null} />
                        <DocRow label="Shipping Line" value={deliveryDetails.shippingLine || null} />
                        <DocRow label="ETD" value={deliveryDetails.etd || null} />
                        <DocRow label="ETA" value={deliveryDetails.eta || null} />
                    </div>
                </div>
            );
        }

        // DDP/DPU buyer confirms address
        if (isDdpDpu) {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={5} title={`Delivery Details — Delivery Address (${incoterm})`} subtitle="Confirm the exact delivery address for final-mile delivery." />
                    <FieldInput label="Exact Delivery Address" value={deliveryDetails.deliveryAddress}
                        onChange={v => setState(p => ({ ...p, deliveryDetails: { ...p.deliveryDetails, deliveryAddress: v } }))}
                        placeholder="Full address including city, postcode, country…" />
                    <PrimaryBtn label="Confirm Delivery Address — Proceed"
                        disabled={!deliveryDetails.deliveryAddress.trim()}
                        onClick={() => transition("FINAL_PAYMENT_PENDING", "buyer", "DELIVERY_DETAILS_CONFIRMED", `Delivery address: ${deliveryDetails.deliveryAddress}`)} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is confirming the final delivery address." />;
        }

        return null;
    };

    // ─── Step 6: Final Payment ────────────────────────────────────────────────

    const renderFinalPayment = () => {
        const st = state.status;

        // Guard: inspection acknowledgment required
        if (st === "FINAL_PAYMENT_PENDING" && hasSecondHand && state.inspection.purchased && !state.inspection.buyerAcknowledged && currentView === "buyer") {
            return (
                <div className="space-y-4">
                    <StepHeading step={6} title="Final Payment — Locked" />
                    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center space-y-3">
                        <p className="text-sm font-semibold text-red-800">🔒 Final payment is locked</p>
                        <p className="text-xs text-red-700">You must acknowledge receipt of the inspection report before making the final payment. Go back to Step 3 to download and acknowledge the report.</p>
                    </div>
                </div>
            );
        }

        // Guard: cancellation pending resolution
        if (st === "FINAL_PAYMENT_PENDING" && state.inspection.cancellationRequested && state.inspection.sellerCancellationResponse === "none" && currentView === "buyer") {
            return (
                <div className="space-y-4">
                    <StepHeading step={6} title="Final Payment — Locked" />
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-2">
                        <p className="text-sm font-semibold text-amber-900">⏳ Cancellation request pending</p>
                        <p className="text-xs text-amber-800">Your cancellation request is awaiting the seller&apos;s response. Final payment is locked until this is resolved.</p>
                    </div>
                </div>
            );
        }

        if (st === "FINAL_PAYMENT_PENDING") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={6} title="Final Payment" subtitle={`Pay the outstanding balance of ${fm(totals.pending, currency)}.`} />
                    {state.finalPaymentRejectionReason && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                            <p className="font-semibold">Previous payment rejected:</p>
                            <p className="mt-1">{state.finalPaymentRejectionReason}</p>
                        </div>
                    )}
                    <div className="grid gap-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Deposit Paid</span><span className="font-semibold text-[#202C4A]">{fm(totals.downpayment, currency)}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Balance Due</span><span className="text-lg font-bold text-[#202C4A]">{fm(totals.pending, currency)}</span></div>
                    </div>
                    <UploadZone title="Final Payment Proof" desc="Bank transfer confirmation for the balance payment" file={state.finalPaymentProof}
                        onUpload={() => setState(p => ({ ...p, finalPaymentProof: mockFile("Final_Payment_Proof") }))}
                        onRemove={() => setState(p => ({ ...p, finalPaymentProof: null }))} tone="green" />
                    <PrimaryBtn label="Submit Final Payment" disabled={!state.finalPaymentProof}
                        onClick={() => transition("FINAL_PAYMENT_SUBMITTED", "buyer", "FINAL_PAYMENT_SUBMITTED", "Buyer submitted final payment proof")} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is processing the final balance payment." />;
        }

        if (st === "FINAL_PAYMENT_SUBMITTED") {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={6} title="Verify Final Payment" subtitle="Review the buyer's final payment proof and approve to release the asset." />
                    <DocRow label="Final Payment Proof" value={state.finalPaymentProof} />
                    <PrimaryBtn label="Approve Payment — Release Asset" color="green"
                        onClick={() => transition("SHIPPING_DOCS_PENDING", "seller", "FINAL_PAYMENT_APPROVED", "Seller approved final payment")} />
                    <OutlineBtn label="Reject Final Payment" tone="red" onClick={() => setRejectOpen("final")} />
                </div>
            );
            return <WaitingCard party="Seller" detail="Seller is verifying your final payment submission." />;
        }

        if (st === "FINAL_PAYMENT_REJECTED") {
            if (currentView === "buyer") return (
                <div className="space-y-5">
                    <StepHeading step={6} title="Re-submit Final Payment" />
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
                        <p className="font-semibold">Rejection reason:</p>
                        <p className="mt-1">{state.finalPaymentRejectionReason || "No reason provided."}</p>
                    </div>
                    <UploadZone title="Final Payment Proof (Updated)" file={state.finalPaymentProof}
                        onUpload={() => setState(p => ({ ...p, finalPaymentProof: mockFile("Final_Payment_Resubmit") }))}
                        onRemove={() => setState(p => ({ ...p, finalPaymentProof: null }))} tone="green" />
                    <PrimaryBtn label="Re-submit Final Payment" disabled={!state.finalPaymentProof}
                        onClick={() => transition("FINAL_PAYMENT_SUBMITTED", "buyer", "FINAL_PAYMENT_RESUBMITTED", "Buyer resubmitted final payment")} />
                </div>
            );
            return <WaitingCard party="Buyer" detail="Buyer is correcting and resubmitting the final payment." />;
        }

        return null;
    };

    // ─── Step 7: Release & Delivery ───────────────────────────────────────────

    const renderRelease = () => {
        const st = state.status;
        const isUGR = state.logistics.provider === "UGR" || logisticsPartner === "UGR";
        const phaseIdx = allDeliveryPhases.indexOf(state.deliveryPhase);

        if (st === "SHIPPING_DOCS_PENDING") {
            if (currentView === "seller") return (
                <div className="space-y-5">
                    <StepHeading step={7} title="Upload Shipping Document & Release" subtitle="Select and upload the appropriate shipping document, then authorize the asset release." />
                    {isUGR && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
                            <p className="font-semibold">UGR Lines — B/L Masking</p>
                            <p className="mt-1">If you upload a Bill of Lading, UGR Lines will share it with the platform. Buyer access to the B/L will be restricted per platform policy.</p>
                        </div>
                    )}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600">Document Type</label>
                        <select value={state.shippingDoc.type}
                            onChange={e => setState(p => ({ ...p, shippingDoc: { ...p.shippingDoc, type: e.target.value, file: null } }))}
                            className="w-full rounded-lg border border-stroke-light px-3 py-2 text-sm focus:border-brand-blue focus:outline-none">
                            <option value="">Select document type…</option>
                            {SHIPPING_DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    {state.shippingDoc.type && (
                        <UploadZone title={state.shippingDoc.type} file={state.shippingDoc.file}
                            onUpload={() => setState(p => ({ ...p, shippingDoc: { ...p.shippingDoc, file: mockFile(p.shippingDoc.type.split(" ")[0]), isUGRMasked: isUGR && p.shippingDoc.type.includes("Bill of Lading") } }))}
                            onRemove={() => setState(p => ({ ...p, shippingDoc: { ...p.shippingDoc, file: null } }))} />
                    )}
                    <PrimaryBtn label="Authorize Release & Share Document" color="green"
                        disabled={!state.shippingDoc.file}
                        onClick={() => transition("RELEASED", "seller", "ASSET_RELEASED", `Seller released asset with ${state.shippingDoc.type}`)} />
                </div>
            );
            return <WaitingCard party="Seller" detail="Seller is uploading the shipping document and authorizing release." />;
        }

        if (st === "RELEASED" || st === "DELIVERED") {
            const shippingDocDisplay = isUGR && state.shippingDoc.isUGRMasked && currentView === "buyer"
                ? "Document shared via UGR Lines — access restricted per platform policy"
                : state.shippingDoc.file;

            return (
                <div className="space-y-5">
                    <StepHeading step={7} title={st === "DELIVERED" ? "Transaction Complete" : "Asset Released — Shipment Tracking"}
                        subtitle={st === "DELIVERED" ? "All steps completed. The transaction is closed." : "Track shipment progress and update delivery phases."} />

                    {/* Shipping doc */}
                    <div className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">{state.shippingDoc.type || "Shipping Document"}</span>
                            <span className={`font-semibold ${state.shippingDoc.isUGRMasked && currentView === "buyer" ? "text-gray-400" : "text-brand-blue"}`}>
                                {shippingDocDisplay}
                            </span>
                        </div>
                    </div>

                    {/* Phase tracker */}
                    <div className="rounded-xl border border-stroke-light bg-white p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Shipment Progress</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {allDeliveryPhases.map((phase, idx) => {
                                const done = idx < phaseIdx;
                                const active = idx === phaseIdx;
                                const next = idx === phaseIdx + 1;
                                return (
                                    <button key={phase} type="button"
                                        disabled={!next || currentView !== "seller"}
                                        onClick={() => {
                                            if (!next || currentView !== "seller") return;
                                            const newPhase = phase;
                                            const newStatus: TxStatus = newPhase === "DELIVERED" ? "DELIVERED" : "RELEASED";
                                            setState(p => ({ ...p, deliveryPhase: newPhase, status: newStatus, auditTrail: [...p.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "DELIVERY_PHASE_UPDATED", details: `Phase advanced to ${phase}` }] }));
                                        }}
                                        className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-colors ${done ? "bg-emerald-100 text-emerald-700" : active ? "bg-brand-blue text-white" : next && currentView === "seller" ? "border border-brand-blue text-brand-blue hover:bg-brand-blue/5" : "bg-gray-100 text-gray-400"}`}>
                                        {deliveryPhaseLabels[phase]}
                                    </button>
                                );
                            })}
                        </div>
                        {currentView !== "seller" && state.status !== "DELIVERED" && (
                            <p className="mt-3 text-xs text-gray-500">The seller updates shipment phases as the vehicle progresses.</p>
                        )}
                    </div>

                    {st === "DELIVERED" && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                            <p className="text-sm font-semibold text-emerald-800">✓ Transaction successfully completed</p>
                            <p className="mt-1 text-xs text-emerald-700">All documents are on record. The buyer has received the asset.</p>
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    // ─── Past-step read-only view ─────────────────────────────────────────────

    // Kept for potential future reintroduction of historical read-only panel.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderPastStepView = (stepN: number) => {
        const isUGRBuyer = state.shippingDoc.isUGRMasked && currentView === "buyer";

        const DocCard = ({ label, file }: { label: string; file: string | null }) => (
            <div className="flex items-center justify-between rounded-xl border border-stroke-light bg-[#f8fafc] px-4 py-3 gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#202C4A]">{label}</p>
                    {file && <p className="mt-0.5 text-xs text-gray-400 truncate">{file}</p>}
                </div>
                {file ? (
                    <button type="button"
                        onClick={() => setViewingDoc({ label, file })}
                        className="shrink-0 rounded-lg bg-brand-blue/10 px-3 py-1.5 text-xs font-semibold text-brand-blue hover:bg-brand-blue/20">
                        View
                    </button>
                ) : (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-400">Not uploaded</span>
                )}
            </div>
        );

        const stepTitles: Record<number, string> = {
            1: "Contract & Deposit",
            2: "VIN Disclosure",
            3: "Inspection",
            4: "Logistics Setup",
            5: "Order Preparation",
            6: "Final Payment",
            7: "Release & Delivery",
        };

        let content: React.ReactNode = null;

        if (stepN === 1) {
            content = (
                <div className="space-y-3">
                    <DocCard label="Seller Contract" file={state.contractSigned} />
                    <DocCard label="Proforma Invoice" file={state.proformaInvoice} />
                    <DocCard label="Deposit Payment Proof" file={state.depositProof} />
                </div>
            );
        } else if (stepN === 2) {
            const vinDocs = activeVinEntries.flatMap(e =>
                e.docs.map(d => ({
                    label: `${e.bucketLabel} · ${e.vin || "TBD"} — ${d.docType}`,
                    file: d.file,
                }))
            );
            content = vinDocs.length ? (
                <div className="space-y-3">
                    {vinDocs.map((d, i) => <DocCard key={i} label={d.label} file={d.file} />)}
                </div>
            ) : <p className="text-sm text-gray-400">No VIN documents on record.</p>;
        } else if (stepN === 3) {
            content = (
                <div className="space-y-3">
                    {state.inspection.purchased ? (
                        <>
                            <DocCard label="Inspection Payment Receipt" file={state.inspection.paymentProof} />
                            <DocCard label="Inspection Report" file={state.inspection.reportFile} />
                        </>
                    ) : (
                        <p className="text-sm text-gray-400">{state.inspection.skipped ? "Inspection was skipped for this order." : "No inspection was purchased."}</p>
                    )}
                </div>
            );
        } else if (stepN === 4) {
            content = (
                <div className="rounded-xl border border-stroke-light bg-[#f8fafc] px-4 py-3 text-sm">
                    {state.logistics.confirmed ? (
                        <div className="space-y-1">
                            <p><span className="font-medium text-[#202C4A]">Provider:</span> <span className="text-gray-600">{state.logistics.provider === "UGR" ? "UGR Lines" : "Buyer Arranged"}</span></p>
                            {state.logistics.notes && <p><span className="font-medium text-[#202C4A]">Notes:</span> <span className="text-gray-600">{state.logistics.notes}</span></p>}
                        </div>
                    ) : (
                        <p className="text-gray-400">Logistics not yet confirmed.</p>
                    )}
                </div>
            );
        } else if (stepN === 5) {
            content = (
                <div className="space-y-3">
                    <DocCard label="Packing List" file={state.orderPrep.packingList} />
                    <DocCard label="Commercial Invoice" file={state.orderPrep.commercialInvoice} />
                    <DocCard label="Certificate of Origin" file={state.orderPrep.certOfOrigin} />
                    <DocCard label="Certificate of Conformity" file={state.orderPrep.certOfConformity} />
                </div>
            );
        } else if (stepN === 6) {
            content = (
                <div className="space-y-3">
                    <DocCard label="Final Payment Proof" file={state.finalPaymentProof} />
                </div>
            );
        } else if (stepN === 7) {
            const shippingLabel = state.shippingDoc.type || "Shipping Document";
            const shippingFile = isUGRBuyer ? null : state.shippingDoc.file;
            content = (
                <div className="space-y-3">
                    {isUGRBuyer ? (
                        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 gap-3">
                            <div>
                                <p className="text-sm font-medium text-amber-800">{shippingLabel}</p>
                                <p className="mt-0.5 text-xs text-amber-700">Document shared via UGR Lines — access restricted per platform policy</p>
                            </div>
                            <span className="shrink-0 text-lg">🔒</span>
                        </div>
                    ) : (
                        <DocCard label={shippingLabel} file={shippingFile} />
                    )}
                </div>
            );
        }

        return (
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <button type="button"
                        onClick={() => setViewingStep(null)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-brand-blue/5">
                        ← Back to current step
                    </button>
                </div>
                <StepHeading step={stepN} title={stepTitles[stepN] ?? ""} subtitle="Read-only view — this step has been completed." />
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-700">
                    ✓ Step completed
                </div>
                {content}
            </div>
        );
    };

    // ─── Panel switch ─────────────────────────────────────────────────────────

    const renderCurrentPanel = () => {
        // Deal cancelled — takes full-screen priority
        if (state.dealCancelled) {
            return (
                <div className="space-y-5">
                    <StepHeading step={0} title="Deal Cancelled" />
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
                        <p className="text-2xl">❌</p>
                        <p className="text-base font-semibold text-red-800">This transaction has been cancelled</p>
                        <p className="text-xs text-red-700 max-w-sm mx-auto">{state.dealCancelledReason}</p>
                        <p className="text-xs text-gray-500 mt-2">Deposit refund terms apply as per the signed contract. Please contact platform support for settlement.</p>
                    </div>
                    <div className="space-y-2 rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Cancellation record</p>
                        <DocRow label="Reason" value={state.dealCancelledReason || null} />
                        {state.inspection.reportFile && <DocRow label="Inspection Report" value={state.inspection.reportFile} />}
                    </div>
                </div>
            );
        }

        const s = state.status;
        if (["CONTRACT_PENDING", "CONTRACT_UPLOADED", "DEPOSIT_SUBMITTED", "DEPOSIT_REJECTED"].includes(s)) return renderContractDeposit();
        if (["DEPOSIT_VERIFIED", "VIN_SUBMITTED"].includes(s)) return renderVIN();
        if (["INSPECTION_ADDON_OFFER", "INSPECTION_ORDERED", "INSPECTION_REPORT_READY"].includes(s)) return renderInspection();
        if (s === "LOGISTICS_PENDING") return renderLogistics();
        if (s === "ORDER_PREP_PENDING") return renderOrderPrep();
        if (s === "DELIVERY_DETAILS_PENDING") return renderDeliveryDetails();
        if (["FINAL_PAYMENT_PENDING", "FINAL_PAYMENT_SUBMITTED", "FINAL_PAYMENT_REJECTED"].includes(s)) return renderFinalPayment();
        if (["SHIPPING_DOCS_PENDING", "RELEASED", "DELIVERED"].includes(s)) return renderRelease();
        return null;
    };

    // ════════════════════════════════════════════════════════════════════════════
    // RENDER
    // ════════════════════════════════════════════════════════════════════════════

    return (
        <div className="container mx-auto max-w-7xl px-4 py-8">
            {/* Header */}
            <div className="mb-6 overflow-hidden rounded-2xl border border-stroke-light bg-white shadow-[0_24px_45px_-35px_rgba(14,30,56,0.7)]">
                <div className="bg-gradient-to-r from-[#1f2d4d] via-[#26365c] to-[#30426d] px-6 py-5 text-white">
                    <h1 className="text-xl font-bold md:text-2xl">Transaction Management</h1>
                    <p className="mt-1 text-sm text-white/80">Order #{conversationId.slice(0, 8)}…{conversationId.slice(-6)} · Created {createdAtLabel} · {sellerName}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stroke-light px-6 py-4">
                    <div className="inline-flex items-center rounded-full border border-stroke-light bg-gray-50 p-1">
                        {(["buyer", "seller"] as Role[]).map(r => (
                            <button key={r} type="button" onClick={() => setCurrentView(r)}
                                className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition-colors ${currentView === r ? "bg-brand-blue text-white" : "text-gray-700 hover:bg-white"}`}>
                                {r} View
                            </button>
                        ))}
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${turn === "buyer" ? "border-amber-200 bg-amber-100 text-amber-700" : turn === "seller" ? "border-emerald-200 bg-emerald-100 text-emerald-700" : "border-sky-200 bg-sky-100 text-sky-700"}`}>
                        {turn === "none" ? "COMPLETED" : `${turn.toUpperCase()} ACTION REQUIRED`}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
                {/* Sidebar */}
                <aside className="col-span-12 space-y-4 lg:col-span-4">
                    {/* Steps */}
                    <div className="rounded-2xl border border-stroke-light bg-white p-5">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">Transaction Steps</p>
                        <div className="space-y-1">
                            {sidebarSteps.map(step => {
                                const isActive = step.n === currentStep;
                                const isDone = step.n < currentStep && !step.skip;
                                const isSkipped = step.skip;
                                const isClickable = !isSkipped;
                                return (
                                    <div
                                        key={step.n}
                                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${
                                            isActive ? "bg-brand-blue/5" : ""
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            disabled={!isClickable}
                                            onClick={() => autoCompleteToStep(step.n)}
                                            title="Auto-complete to this step"
                                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                                isSkipped ? "bg-gray-100 text-gray-300"
                                                : isDone ? "bg-emerald-500 text-white"
                                                : isActive ? "bg-brand-blue text-white"
                                                : "bg-gray-100 text-gray-400"
                                            } ${isClickable ? "hover:opacity-90" : ""}`}
                                        >
                                            {isDone ? "✓" : step.n}
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm ${isActive ? "font-semibold text-brand-blue" : isSkipped ? "text-gray-300" : isDone ? "text-gray-700" : "text-gray-400"}`}>
                                                {step.title}
                                            </p>
                                            {!isSkipped ? (
                                                <button
                                                    type="button"
                                                    onClick={() => autoCompleteToStep(step.n)}
                                                    className="text-[10px] text-emerald-600 hover:underline"
                                                >
                                                    View documents
                                                </button>
                                            ) : step.optional ? (
                                                <p className="text-[10px] text-gray-300">N/A for this order</p>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Financial summary */}
                    <div className="rounded-2xl bg-gradient-to-br from-[#202C4A] to-[#2d3e66] p-5 text-white">
                        <p className="mb-3 text-sm font-semibold">Financial Summary</p>
                        <div className="space-y-2">
                            {financial.map(f => (
                                <div key={f.label} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm">
                                    <span className="text-white/75">{f.label}</span>
                                    <span className="font-semibold">{f.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Audit trail */}
                    <div className="rounded-2xl border border-stroke-light bg-white p-5">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Audit Trail</p>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {state.auditTrail.length ? (
                                [...state.auditTrail].reverse().slice(0, 12).map((log, idx) => (
                                    <div key={`${log.at}-${idx}`} className="rounded-lg border border-stroke-light bg-[#f8fafc] p-2 text-xs">
                                        <p className="font-semibold text-[#202C4A]">{log.action.replace(/_/g, " ")}</p>
                                        <p className="mt-0.5 text-gray-600">{log.details}</p>
                                        <p className="mt-0.5 text-gray-400">{new Date(log.at).toLocaleString()} · {log.actor}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400">No events yet.</p>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Main panel */}
                <section className="col-span-12 rounded-2xl border border-stroke-light bg-white p-6 shadow-[0_24px_45px_-35px_rgba(14,30,56,0.5)] lg:col-span-8">
                            {currentView === "seller" && canOpenVinAmendment && !state.vinAmendment.status.startsWith("pending") ? (
                                <div className="mb-5 rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3 text-xs text-brand-blue font-medium">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <span>✓ VINs approved. You can submit a VIN amendment now.</span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setState(prev => ({
                                                    ...prev,
                                                    status: "VIN_SUBMITTED",
                                                }))
                                            }
                                            className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-hover"
                                        >
                                            Open VIN Amendment
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                    {turn !== "none" && turn !== currentView && (
                        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            Currently waiting for {turn === "seller" ? "Seller" : "Buyer"} — you can monitor progress but cannot take action.
                        </div>
                    )}
                    {renderCurrentPanel()}
                </section>
            </div>

            {/* Document viewer modal */}
            {viewingDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewingDoc(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-stroke-light px-6 py-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Document Preview</p>
                                <p className="mt-0.5 text-sm font-semibold text-[#202C4A] truncate">{viewingDoc.label}</p>
                            </div>
                            <button type="button" onClick={() => setViewingDoc(null)} className="ml-4 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                ✕
                            </button>
                        </div>
                        {/* Mock preview area */}
                        <div className="flex flex-col items-center justify-center gap-3 bg-[#f8fafc] px-6 py-10 text-center">
                            <div className="flex h-20 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
                                <span className="text-3xl">📄</span>
                            </div>
                            <p className="text-sm font-medium text-[#202C4A]">{viewingDoc.file}</p>
                            <p className="text-xs text-gray-400">Preview not available in prototype mode</p>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 border-t border-stroke-light px-6 py-4">
                            <button type="button" onClick={() => setViewingDoc(null)}
                                className="rounded-xl border border-stroke-light px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                Close
                            </button>
                            <button type="button"
                                onClick={() => {
                                    addAudit(currentView, "DOCUMENT_DOWNLOADED", `Downloaded: ${viewingDoc.label} (${viewingDoc.file})`);
                                    setViewingDoc(null);
                                }}
                                className="rounded-xl bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
                                ↓ Download
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject modal */}
            {rejectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-[#202C4A]">
                            {rejectOpen === "deposit" && "Reject Deposit Submission"}
                            {rejectOpen === "final" && "Reject Final Payment"}
                            {rejectOpen === "vin" && "Reject Selected VINs"}
                            {rejectOpen === "vin_amendment" && "Reject VIN Amendment"}
                        </h3>
                        <p className="mt-1 text-sm text-gray-600">
                            {rejectOpen === "vin" && "Selected VINs will be returned to the seller for correction."}
                            {rejectOpen === "vin_amendment" && "The seller must use the original VIN, remove the vehicle, or cancel the deal."}
                            {(rejectOpen === "deposit" || rejectOpen === "final") && "The buyer will be asked to correct and resubmit."}
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Provide a clear rejection reason…"
                            className="mt-4 w-full rounded-xl border border-stroke-light px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
                            rows={3}
                        />
                        <div className="mt-4 flex gap-3">
                            <OutlineBtn label="Cancel" onClick={() => { setRejectReason(""); setRejectOpen(null); }} />
                            <button type="button" disabled={!rejectReason.trim()}
                                onClick={() => {
                                    if (!rejectReason.trim()) return;
                                    setState(prev => {
                                        let next = { ...prev };
                                        if (rejectOpen === "deposit") {
                                            next = { ...next, status: "DEPOSIT_REJECTED", depositRejectionReason: rejectReason.trim(), contractSigned: null, depositProof: null };
                                            next.auditTrail = [...next.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "DEPOSIT_REJECTED", details: rejectReason.trim() }];
                                        } else if (rejectOpen === "final") {
                                            next = { ...next, status: "FINAL_PAYMENT_REJECTED", finalPaymentRejectionReason: rejectReason.trim(), finalPaymentProof: null };
                                            next.auditTrail = [...next.auditTrail, { at: new Date().toISOString(), actor: "seller", action: "FINAL_PAYMENT_REJECTED", details: rejectReason.trim() }];
                                        } else if (rejectOpen === "vin") {
                                            next = {
                                                ...next,
                                                vinEntries: next.vinEntries.map(v => prev.selectedVinEntryIds.includes(v.id) ? { ...v, buyerApproved: false } : v),
                                                vinReviewRejectionReason: rejectReason.trim(),
                                                selectedVinEntryIds: [],
                                            };
                                            next.auditTrail = [...next.auditTrail, { at: new Date().toISOString(), actor: "buyer", action: "VIN_REJECTED", details: rejectReason.trim() }];
                                        } else if (rejectOpen === "vin_amendment") {
                                            next = { ...next, vinAmendment: { ...next.vinAmendment, status: "rejected", buyerDecisionReason: rejectReason.trim() } };
                                            next.auditTrail = [...next.auditTrail, { at: new Date().toISOString(), actor: "buyer", action: "VIN_AMENDMENT_REJECTED", details: rejectReason.trim() }];
                                        }
                                        return next;
                                    });
                                    setRejectReason("");
                                    setRejectOpen(null);
                                }}
                                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
