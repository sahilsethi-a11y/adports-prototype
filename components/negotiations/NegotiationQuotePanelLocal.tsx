"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { QuoteItem } from "@/components/buyer/QuoteBuilderList";
import Button from "@/elements/Button";
import { scopedStorageKey, type MarketMode } from "@/lib/marketplace";
import type { RfqResponseSummary } from "./NegotiationItemsSection";

export const INCOTERM_OPTIONS = ["FOB", "CIF"] as const;
export const FOB_PORT_OPTIONS = ["Zayed Port", "Khalifa Port"] as const;
export const CIF_PORT_OPTIONS = ["Ningbo", "Yantai"] as const;
export type NegotiationIncoterm = (typeof INCOTERM_OPTIONS)[number];

type Bucket = {
    key: string;
    brand?: string;
    model?: string;
    variant?: string;
    year?: number;
    condition?: string;
    bodyType?: string;
    name: string;
    location: string;
    unitPrice: number;
    currency: string;
    totalUnits: number;
    bucketTotal: number;
    mainImageUrl?: string;
    items: QuoteItem[];
};

export type RfqLineResponse = {
    availability: "full" | "partial" | "unavailable";
    quantity: number;
    unitPrice: string;
};

const getItemKey = (item: QuoteItem) => item.lineKey || `${item.id}-${item.color || "default"}`;
export const getDefaultRfqLineResponse = (item: QuoteItem): RfqLineResponse => ({
    availability: "full",
    quantity: item.quantity,
    unitPrice: item.price ? String(item.price) : "",
});

const buildNegotiationBucketKey = (item: QuoteItem) => {
    if (item.marketType === "zero_km") {
        return [
            item.sellerId || "",
            item.brand || item.name,
            item.model || "",
            item.variant || "",
            item.year || "",
        ].join("|");
    }

    return item.bucketKey || String(item.id || item.name || "");
};

const groupBuckets = (list: QuoteItem[]): Bucket[] => {
    const map = new Map<string, Bucket>();

    for (const item of list) {
        const key = buildNegotiationBucketKey(item);
        const existing = map.get(key);

        if (!existing) {
            map.set(key, {
                key,
                brand: item.brand,
                model: item.model,
                variant: item.variant,
                year: item.year,
                condition: item.condition,
                bodyType: item.bodyType,
                name: item.name,
                location: item.location,
                unitPrice: item.price,
                currency: item.currency,
                totalUnits: item.quantity,
                bucketTotal: item.quantity * item.price,
                mainImageUrl: item.mainImageUrl,
                items: [item],
            });
        } else {
            existing.totalUnits += item.quantity;
            existing.bucketTotal += item.quantity * item.price;
            existing.items.push(item);
        }
    }

    return Array.from(map.values());
};

type Props = {
    sellerName?: string;
    sellerId?: string;
    negotiationStatus?: string;
    bucketDiscounts: Record<string, number>;
    downpaymentPercent: number;
    onDownpaymentChange: (value: number) => void;
    selectedIncoterm: NegotiationIncoterm;
    onIncotermChange: (value: NegotiationIncoterm) => void;
    selectedPort: string;
    onPortChange: (value: string) => void;
    conversationId?: string;
    marketMode: MarketMode;
    onSubmit?: (proposalData: {
        rfqResponse?: boolean;
        quotationCancelled?: boolean;
        cancellationReason?: string;
        discountPercent: number;
        discountAmount: number;
        finalPrice: number;
        incoterm: NegotiationIncoterm;
        downpaymentPercent: number;
        downpaymentAmount: number;
        remainingBalance: number;
        orderPreparationTimeline?: string;
        expectedDeliveryDate?: string;
        offerValidity?: string;
        bucketTotal: number;
        bucketName: string;
        bucketSummaries: Array<{
            key: string;
            name: string;
            total: number;
            discountPercent: number;
            totalUnits: number;
            unitPrice: number;
            currency: string;
            brand?: string;
            model?: string;
            variant?: string;
            color?: string;
            year?: number;
            condition?: string;
            bodyType?: string;
            mainImageUrl?: string;
        }>;
    }) => Promise<void>;
    isSubmitting?: boolean;
    submissionError?: string | null;
    onFinalPriceDoubleTap?: () => void;
    isRequestQuoteMode?: boolean;
    isSellerRfqResponseMode?: boolean;
    submitLabel?: string;
    rfqLineResponses?: Record<string, RfqLineResponse>;
    rfqResponseSummaries?: Record<string, RfqResponseSummary>;
    isPerColorNegotiationMode?: boolean;
};

export default function NegotiationQuotePanelLocal({
    sellerName,
    sellerId,
    negotiationStatus,
    bucketDiscounts,
    downpaymentPercent,
    onDownpaymentChange,
    selectedIncoterm,
    onIncotermChange,
    selectedPort,
    onPortChange,
    conversationId,
    marketMode,
    onSubmit,
    isSubmitting,
    submissionError,
    onFinalPriceDoubleTap,
    isRequestQuoteMode = false,
    isSellerRfqResponseMode = false,
    submitLabel = "Submit Proposal",
    rfqLineResponses = {},
    rfqResponseSummaries,
    isPerColorNegotiationMode = false,
}: Readonly<Props>) {
    const [items, setItems] = useState<QuoteItem[]>([]);
    const lastTapRef = useRef(0);
    const portOptions = selectedIncoterm === "CIF" ? CIF_PORT_OPTIONS : FOB_PORT_OPTIONS;
    const portLabel = selectedIncoterm === "CIF" ? "Port of Destination" : "Port of Loading";

    const [quotationCancelled, setQuotationCancelled] = useState(false);
    const [cancellationReason, setCancellationReason] = useState("");
    const [orderPreparationTimeline, setOrderPreparationTimeline] = useState("");
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
    const [offerValidity, setOfferValidity] = useState("");
    const [localValidationError, setLocalValidationError] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const scopedKey = conversationId ? `negotiationItems_${conversationId}` : "";
            const quoteItemsStorageKey = scopedStorageKey("quoteBuilderItems", marketMode);
            const raw =
                (scopedKey && window.localStorage.getItem(scopedKey)) ||
                window.localStorage.getItem(quoteItemsStorageKey);

            const parsed = raw ? (JSON.parse(raw) as QuoteItem[]) : [];
            setItems(parsed);
        } catch {
            setItems([]);
        }
    }, [conversationId, marketMode]);

    const sellerItems = useMemo(() => {
        if (sellerId) return items.filter((i) => i.sellerId === sellerId);
        if (sellerName) return items.filter((i) => i.sellerCompany === sellerName);
        return items;
    }, [items, sellerId, sellerName]);

    const buckets = useMemo(() => groupBuckets(sellerItems), [sellerItems]);
    const hasRfqResponseSummaries = Boolean(rfqResponseSummaries && Object.keys(rfqResponseSummaries).length > 0);

    const currency = buckets?.[0]?.currency;

    const perColorNegotiationBase = useMemo(() => {
        if (!isPerColorNegotiationMode || !hasRfqResponseSummaries) return null;

        return buckets.flatMap((bucket) =>
            bucket.items.map((item) => {
                const itemKey = getItemKey(item);
                const summary = rfqResponseSummaries?.[itemKey];
                const totalUnits = Number(summary?.totalUnits) || 0;
                const unitPrice = Number(summary?.unitPrice) || 0;
                const total = Number(summary?.total) || totalUnits * unitPrice;
                return { item, itemKey, totalUnits, unitPrice, total };
            })
        );
    }, [buckets, hasRfqResponseSummaries, isPerColorNegotiationMode, rfqResponseSummaries]);

    const { originalTotal, discountedTotal, discountAmount, effectiveDiscountPercent } = useMemo(() => {
        if (perColorNegotiationBase) {
            const original = perColorNegotiationBase.reduce((acc, line) => acc + line.total, 0);
            const discountedPrice = perColorNegotiationBase.reduce((acc, line) => {
                const lineDiscount = bucketDiscounts[line.itemKey] ?? 0;
                return acc + line.total * (1 - lineDiscount / 100);
            }, 0);
            const discountAmt = original - discountedPrice;
            const effectiveDiscount = original > 0 ? (discountAmt / original) * 100 : 0;

            return {
                originalTotal: original,
                discountedTotal: discountedPrice,
                discountAmount: discountAmt,
                effectiveDiscountPercent: effectiveDiscount,
            };
        }

        const original = buckets.reduce((acc, b) => acc + b.bucketTotal, 0);

        const discountedPrice = buckets.reduce((acc, b) => {
            const bucketDiscount = bucketDiscounts[b.key] ?? 0;
            const bucketDiscounted = b.bucketTotal * (1 - bucketDiscount / 100);
            return acc + bucketDiscounted;
        }, 0);

        const discountAmt = original - discountedPrice;
        const effectiveDiscount = original > 0 ? (discountAmt / original) * 100 : 0;

        return {
            originalTotal: original,
            discountedTotal: discountedPrice,
            discountAmount: discountAmt,
            effectiveDiscountPercent: effectiveDiscount,
        };
    }, [buckets, bucketDiscounts, perColorNegotiationBase]);

    const { downpaymentAmount, remainingBalance } = useMemo(() => {
        const baseTotal = isSellerRfqResponseMode ? 0 : discountedTotal;
        const downpayment = Math.max(0, baseTotal * (downpaymentPercent / 100));
        const remaining = Math.max(0, baseTotal - downpayment);

        return {
            downpaymentAmount: downpayment,
            remainingBalance: remaining,
        };
    }, [discountedTotal, downpaymentPercent, isSellerRfqResponseMode]);

    const rfqQuotedTotal = useMemo(() => {
        if (!isSellerRfqResponseMode) return discountedTotal;

        let total = 0;

        for (const bucket of buckets) {
            for (const item of bucket.items) {
                const itemKey = getItemKey(item);
                const response = rfqLineResponses[itemKey] || getDefaultRfqLineResponse(item);

                if (response && response.availability !== "unavailable") {
                    total += (Number(response.quantity) || 0) * (Number(response.unitPrice) || 0);
                }
            }
        }

        return total;
    }, [buckets, discountedTotal, isSellerRfqResponseMode, rfqLineResponses]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        try {
            const quoteOfferStorageKey = scopedStorageKey("quoteBuilderOfferAmount", marketMode);
            const nextOfferAmount = isSellerRfqResponseMode ? rfqQuotedTotal : discountedTotal;
            window.localStorage.setItem(quoteOfferStorageKey, String(Math.round(nextOfferAmount)));
            window.dispatchEvent(new Event("quoteOfferUpdated"));
        } catch {}
    }, [discountedTotal, isSellerRfqResponseMode, marketMode, rfqQuotedTotal]);

    const isDisabled =
        negotiationStatus?.toLowerCase() === "agreed" ||
        negotiationStatus?.toLowerCase() === "rejected";

    const handleSubmit = async () => {
        setLocalValidationError(null);

        if (!onSubmit || buckets.length < 1) return;

        if (effectiveDiscountPercent < 0 || effectiveDiscountPercent > 100) {
            setLocalValidationError("Discount percentage is invalid.");
            return;
        }

        if (!isRequestQuoteMode && (downpaymentPercent < 10 || downpaymentPercent > 100)) {
            setLocalValidationError("Downpayment percentage must be between 10 and 100.");
            return;
        }

        if (!selectedPort) {
            setLocalValidationError("Select a port before continuing.");
            return;
        }

        if (!isRequestQuoteMode && !isSellerRfqResponseMode && (originalTotal <= 0 || discountedTotal <= 0)) {
            setLocalValidationError("Proposal total must be greater than zero.");
            return;
        }

        if (isSellerRfqResponseMode) {
            if (quotationCancelled) {
                if (!cancellationReason) {
                    setLocalValidationError("Select a cancellation reason.");
                    return;
                }
            } else {
                for (const bucket of buckets) {
                    for (const item of bucket.items) {
                        const itemKey = getItemKey(item);
                        const response = rfqLineResponses[itemKey] || getDefaultRfqLineResponse(item);

                        if (!response) {
                            setLocalValidationError("Missing response for one or more vehicle colors.");
                            return;
                        }

                        if (response.availability !== "unavailable") {
                            if ((Number(response.quantity) || 0) < 1) {
                                setLocalValidationError(
                                    `Enter a valid quoted quantity for ${item.color || item.name}.`
                                );
                                return;
                            }
                            if ((Number(response.unitPrice) || 0) <= 0) {
                                setLocalValidationError(
                                    `Enter a valid quoted unit price for ${item.color || item.name}.`
                                );
                                return;
                            }
                        }
                    }
                }

                if (!orderPreparationTimeline.trim()) {
                    setLocalValidationError("Add an order preparation timeline.");
                    return;
                }
                if (!expectedDeliveryDate) {
                    setLocalValidationError("Select an expected delivery date.");
                    return;
                }
                if (!offerValidity.trim()) {
                    setLocalValidationError("Add an offer validity period.");
                    return;
                }
            }
        }

        const nextBucketSummaries = isSellerRfqResponseMode
    ? buckets.flatMap((b) =>
          b.items.map((item) => {
              const itemKey = getItemKey(item);
              const response = rfqLineResponses[itemKey] || getDefaultRfqLineResponse(item);
              const totalUnits = response?.availability === "unavailable" ? 0 : Number(response?.quantity) || 0;
              const unitPrice = response?.availability === "unavailable" ? 0 : Number(response?.unitPrice) || 0;

              return {
                  key: itemKey,
                  name: item.name,
                  total: totalUnits * unitPrice,
                  discountPercent: 0,
                  totalUnits,
                  unitPrice,
                  currency: item.currency,
                  brand: item.brand,
                  model: item.model,
                  variant: item.variant,
                  color: item.color,
                  year: item.year,
                  condition: item.condition,
                  bodyType: item.bodyType,
                  mainImageUrl: item.mainImageUrl,
              };
          })
      )
    : perColorNegotiationBase
      ? perColorNegotiationBase.map((line) => {
            const lineDiscount = bucketDiscounts[line.itemKey] ?? 0;
            const discountedTotalForLine = line.total * (1 - lineDiscount / 100);
            const discountedUnitPrice =
                line.totalUnits > 0 ? discountedTotalForLine / line.totalUnits : 0;

            return {
                key: line.itemKey,
                name: line.item.name,
                total: discountedTotalForLine,
                discountPercent: lineDiscount,
                totalUnits: line.totalUnits,
                unitPrice: discountedUnitPrice,
                currency: line.item.currency,
                brand: line.item.brand,
                model: line.item.model,
                variant: line.item.variant,
                color: line.item.color,
                year: line.item.year,
                condition: line.item.condition,
                bodyType: line.item.bodyType,
                mainImageUrl: line.item.mainImageUrl,
            };
        })
    : isRequestQuoteMode
      ? buckets.flatMap((b) =>
            b.items.map((item) => {
                const itemKey = getItemKey(item);

                return {
                    key: itemKey,
                    name: item.name,
                    total: item.quantity * item.price,
                    discountPercent: 0,
                    totalUnits: item.quantity,
                    unitPrice: item.price,
                    currency: item.currency,
                    brand: item.brand,
                    model: item.model,
                    variant: item.variant,
                    color: item.color,
                    year: item.year,
                    condition: item.condition,
                    bodyType: item.bodyType,
                    mainImageUrl: item.mainImageUrl,
                };
            })
        )
      : buckets.map((b) => ({
            key: b.key,
            name: b.name,
            total: b.bucketTotal,
            discountPercent: bucketDiscounts[b.key] ?? 0,
            totalUnits: b.totalUnits,
            unitPrice: b.unitPrice,
            currency: b.currency,
            brand: b.brand,
            model: b.model,
            variant: b.variant,
            color: undefined,
            year: b.year,
            condition: b.condition,
            bodyType: b.bodyType,
            mainImageUrl: b.mainImageUrl,
        }));

        const requestQuoteBasis = perColorNegotiationBase
            ? perColorNegotiationBase.reduce((sum, line) => sum + Math.max(0, line.total), 0)
            : buckets.reduce((sum, bucket) => sum + Math.max(0, bucket.bucketTotal), 0);

        await onSubmit({
            rfqResponse: isSellerRfqResponseMode,
            quotationCancelled: isSellerRfqResponseMode ? quotationCancelled : false,
            cancellationReason: isSellerRfqResponseMode ? cancellationReason : undefined,
            discountPercent:
                isRequestQuoteMode || isSellerRfqResponseMode ? 0 : Number(effectiveDiscountPercent.toFixed(2)),
            discountAmount: isRequestQuoteMode || isSellerRfqResponseMode ? 0 : discountAmount,
            finalPrice: isSellerRfqResponseMode
                ? rfqQuotedTotal
                : isRequestQuoteMode
                  ? requestQuoteBasis
                  : discountedTotal,
            incoterm: selectedIncoterm,
            downpaymentPercent: isRequestQuoteMode || quotationCancelled ? 0 : downpaymentPercent,
            downpaymentAmount:
                isRequestQuoteMode || quotationCancelled
                    ? 0
                    : isSellerRfqResponseMode
                      ? rfqQuotedTotal * (downpaymentPercent / 100)
                      : downpaymentAmount,
            remainingBalance: isRequestQuoteMode
                ? requestQuoteBasis
                : isSellerRfqResponseMode
                  ? rfqQuotedTotal - rfqQuotedTotal * (downpaymentPercent / 100)
                  : remainingBalance,
            orderPreparationTimeline: isSellerRfqResponseMode ? orderPreparationTimeline : undefined,
            expectedDeliveryDate: isSellerRfqResponseMode ? expectedDeliveryDate : undefined,
            offerValidity: isSellerRfqResponseMode ? offerValidity : undefined,
            bucketTotal: isSellerRfqResponseMode ? originalTotal : requestQuoteBasis,
            bucketName: buckets[0]?.name || "Negotiation Items",
            bucketSummaries: nextBucketSummaries,
        });

        setLocalValidationError(null);
    };

    if (buckets.length < 1) return null;

    return (
        <div className="border border-stroke-light rounded-lg p-5 bg-white">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {isRequestQuoteMode
                    ? "Request a Quote"
                    : isSellerRfqResponseMode
                      ? "Respond to RFQ"
                      : "Make a Proposal"}
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Original Price:</span>
                    <span className="font-medium text-gray-900">{formatPrice(originalTotal, currency)}</span>
                </div>

                {!isRequestQuoteMode && !isSellerRfqResponseMode ? (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Discount Amount:</span>
                        <span className="font-medium text-red-600">
                            -${Math.round(discountAmount).toLocaleString()}
                        </span>
                    </div>
                ) : null}

                <div className="border-t border-blue-200 pt-2 flex justify-between text-sm font-semibold">
                    <span className="text-gray-900">
                        {isRequestQuoteMode
                            ? "Requested Quote Basis:"
                            : isSellerRfqResponseMode
                              ? "Quoted Total:"
                              : "Final Price:"}
                    </span>
                    <span
                        className="text-brand-blue text-lg"
                        onDoubleClick={onFinalPriceDoubleTap}
                        onTouchEnd={() => {
                            if (!onFinalPriceDoubleTap) return;
                            const now = Date.now();
                            if (now - lastTapRef.current < 300) {
                                onFinalPriceDoubleTap();
                            }
                            lastTapRef.current = now;
                        }}
                    >
                        {formatPrice(
                            isSellerRfqResponseMode
                                ? rfqQuotedTotal
                                : isRequestQuoteMode
                                  ? originalTotal
                                  : discountedTotal,
                            currency
                        )}
                    </span>
                </div>
            </div>

            {isSellerRfqResponseMode ? (
                <div className="mb-5 space-y-4">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={quotationCancelled}
                            onChange={(e) => setQuotationCancelled(e.target.checked)}
                        />
                        Cancel quotation
                    </label>

                    {quotationCancelled ? (
                        <div>
                            <label className="text-xs font-medium text-gray-700 block mb-2">
                                Cancellation reason
                            </label>
                            <select
                                value={cancellationReason}
                                onChange={(e) => setCancellationReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                            >
                                <option value="">Select reason</option>
                                <option value="Vehicle cannot be fulfilled">Vehicle cannot be fulfilled</option>
                                <option value="Incoterm is not feasible">Incoterm is not feasible</option>
                            </select>
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-2">
                                        Order preparation timeline
                                    </label>
                                    <input
                                        type="text"
                                        value={orderPreparationTimeline}
                                        onChange={(e) => setOrderPreparationTimeline(e.target.value)}
                                        placeholder="e.g. 14 days"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-2">
                                        Expected delivery date
                                    </label>
                                    <input
                                        type="date"
                                        value={expectedDeliveryDate}
                                        onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-gray-700 block mb-2">
                                        Offer validity
                                    </label>
                                    <input
                                        type="text"
                                        value={offerValidity}
                                        onChange={(e) => setOfferValidity(e.target.value)}
                                        placeholder="e.g. 7 days"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            ) : null}

            {!isRequestQuoteMode && !isSellerRfqResponseMode && !quotationCancelled ? (
                <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">Downpayment %</label>
                        <span className="text-sm font-semibold text-brand-blue">
                            {downpaymentPercent}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min={10}
                        max={100}
                        value={downpaymentPercent}
                        onChange={(e) => onDownpaymentChange(Number(e.target.value))}
                        disabled={isDisabled}
                        className="w-full accent-brand-blue disabled:opacity-50"
                    />
                    <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
                        <span>Downpayment Amount:</span>
                        <span className="font-semibold text-gray-900">
                            ${Math.round(
                                isSellerRfqResponseMode
                                    ? rfqQuotedTotal * (downpaymentPercent / 100)
                                    : downpaymentAmount
                            ).toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                        <span>Remaining Balance:</span>
                        <span className="font-semibold text-gray-900">
                            ${Math.round(
                                isSellerRfqResponseMode
                                    ? rfqQuotedTotal - rfqQuotedTotal * (downpaymentPercent / 100)
                                    : remainingBalance
                            ).toLocaleString()}
                        </span>
                    </div>
                </div>
            ) : null}

            <div className="mb-6">
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-700">Incoterm</label>
                    </div>
                    <select
                        value={selectedIncoterm}
                        onChange={(e) => onIncotermChange(e.target.value as NegotiationIncoterm)}
                        disabled={isDisabled}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:opacity-50"
                    >
                        {INCOTERM_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-700">{portLabel}</label>
                </div>
                <select
                    value={selectedPort}
                    onChange={(e) => onPortChange(e.target.value)}
                    disabled={isDisabled}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:opacity-50"
                >
                    {portOptions.map((opt) => (
                        <option key={opt} value={opt}>
                            {opt}
                        </option>
                    ))}
                </select>
            </div>

            {(submissionError || localValidationError) && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{localValidationError || submissionError}</p>
                </div>
            )}

            <Button
                onClick={handleSubmit}
                disabled={isDisabled || isSubmitting}
                className="w-full bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-60"
            >
                {isSubmitting
                    ? "Submitting..."
                    : isSellerRfqResponseMode
                      ? quotationCancelled
                        ? "Send Cancellation"
                        : "Send Quotation"
                      : submitLabel}
            </Button>
        </div>
    );
}
