"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuoteItem } from "@/components/buyer/QuoteBuilderList";
import NegotiationBucketCard from "./NegotiationBucketCard";
import { getDefaultRfqLineResponse, type RfqLineResponse } from "./NegotiationQuotePanelLocal";
import { scopedStorageKey, type MarketMode } from "@/lib/marketplace";

export type RfqResponseSummary = {
  totalUnits: number;
  unitPrice: number;
  total: number;
  currency?: string;
};

type NegotiationBucket = {
  key: string;
  brand?: string;
  model?: string;
  variant?: string;
  color?: string;
  year?: number;
  condition?: string;
  bodyType?: string;
  sellerCompany: string;
  sellerId?: string;
  unitCount: number;
  unitPrice: number;
  currency: string;
  bucketTotal: number;
  mainImageUrl: string;
  location: string;
  items: QuoteItem[];
};

type Props = {
  sellerName?: string;
  sellerId?: string;
  isBuyer?: boolean;
  canEditDiscounts?: boolean;
  bucketDiscounts: Record<string, number>;
  onBucketDiscountChange: (bucketKey: string, value: number) => void;
  isLocked?: boolean;
  conversationId?: string;
  marketMode: MarketMode;
  isSellerRfqResponseMode?: boolean;
  rfqLineResponses?: Record<string, RfqLineResponse>;
  onRfqLineResponsesChange?: (value: Record<string, RfqLineResponse>) => void;
  rfqResponseSummaries?: Record<string, RfqResponseSummary>;
  isPerColorNegotiationMode?: boolean;
};

// One card per car (brand + model + variant + year + seller).
// Color is intentionally excluded from the key — different colors of the
// same car belong in the same card and appear as sub-cards inside it.
//
// NOTE: We group by car identity whenever brand+model are present, regardless
// of marketType. Seller-side items are injected from proposal bucketSummaries
// (NegotiationClientWrapper line ~355) with brand/model/variant/year set but
// without marketType, so we cannot rely solely on the zero_km branch.
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

// Bucket grouping function - groups items by car identity, preserving each
// color entry individually so sub-cards can render them separately.
const buildBucketGroups = (items: QuoteItem[]): NegotiationBucket[] => {
  const map = new Map<string, NegotiationBucket>();

  for (const item of items) {
    const key = buildNegotiationBucketKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        key,
        brand: item.brand,
        model: item.model,
        variant: item.variant,
        color: item.color,
        year: item.year,
        condition: item.condition,
        bodyType: item.bodyType,
        sellerCompany: item.sellerCompany,
        sellerId: item.sellerId,
        unitCount: item.quantity,
        unitPrice: item.price,
        currency: item.currency,
        bucketTotal: item.quantity * item.price,
        mainImageUrl: item.mainImageUrl,
        location: item.location,
        items: [item],
      });
    } else {
      // Aggregate totals across all color variants
      existing.unitCount += item.quantity;
      existing.bucketTotal += item.quantity * item.price;
      existing.items.push(item); // each color stays as its own entry for sub-cards
      existing.unitPrice = existing.bucketTotal / existing.unitCount;
    }
  }

  return Array.from(map.values());
};

export default function NegotiationItemsSection({
  sellerName,
  sellerId,
  isBuyer,
  canEditDiscounts,
  bucketDiscounts,
  onBucketDiscountChange,
  isLocked,
  conversationId,
  marketMode,
  isSellerRfqResponseMode,
  rfqLineResponses,
  onRfqLineResponsesChange,
  rfqResponseSummaries,
  isPerColorNegotiationMode,
}: Props) {
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const loadItems = () => {
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
    };

    loadItems();

    // Listen to storage changes from other tabs
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === scopedStorageKey("quoteBuilderItems", marketMode) ||
        e.key === (conversationId ? `negotiationItems_${conversationId}` : "")
      ) {
        loadItems();
      }
    };

    // Listen to custom events from same tab
    const onQuoteUpdate = () => loadItems();

    window.addEventListener("storage", onStorage);
    window.addEventListener("quoteBuilderUpdated", onQuoteUpdate);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("quoteBuilderUpdated", onQuoteUpdate);
    };
  }, [conversationId, marketMode]);

  // Filter by seller
  const sellerItems = useMemo(() => {
    if (sellerId) return items.filter((i) => i.sellerId === sellerId);
    if (sellerName) return items.filter((i) => i.sellerCompany === sellerName);
    return items;
  }, [items, sellerId, sellerName]);

  // Group into buckets
  const buckets = useMemo(() => buildBucketGroups(sellerItems), [sellerItems]);

  // Don't render if no items
  if (buckets.length === 0) return null;

  return (
    <section className="border border-stroke-light rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Negotiation Items</h3>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
          {buckets.length} {buckets.length === 1 ? "group" : "groups"}
        </span>
      </div>

      <div className="space-y-2">
        {buckets.map((bucket) => (
          <NegotiationBucketCard
            key={bucket.key}
            bucket={bucket}
            discountPercent={bucketDiscounts[bucket.key] ?? 0}
            discountPercents={bucketDiscounts}
            showDiscountControls={canEditDiscounts ?? isBuyer === true}
            onDiscountChange={(value) => onBucketDiscountChange(bucket.key, value)}
            onItemDiscountChange={(itemKey, value) => onBucketDiscountChange(itemKey, value)}
            isLocked={isLocked}
            isSellerRfqResponseMode={isSellerRfqResponseMode}
            rfqLineResponses={rfqLineResponses}
            rfqResponseSummaries={rfqResponseSummaries}
            isPerColorNegotiationMode={isPerColorNegotiationMode}
            onRfqLineResponseChange={(item, next) => {
              onRfqLineResponsesChange?.({
                ...(rfqLineResponses || {}),
                [item.lineKey || `${item.id}-${item.color || "default"}`]:
                  typeof next === "function"
                    ? next(
                        (rfqLineResponses || {})[
                          item.lineKey || `${item.id}-${item.color || "default"}`
                        ] || getDefaultRfqLineResponse(item)
                      )
                    : next,
              });
            }}
          />
        ))}
      </div>
    </section>
  );
}
