"use client";

import { useState } from "react";
import Image from "@/elements/Image";
import { formatPrice } from "@/lib/utils";
import type { QuoteItem } from "@/components/buyer/QuoteBuilderList";
import { getDefaultRfqLineResponse, type RfqLineResponse } from "./NegotiationQuotePanelLocal";
import type { RfqResponseSummary } from "./NegotiationItemsSection";

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
  bucket: NegotiationBucket;
  discountPercent: number;
  discountPercents?: Record<string, number>;
  showDiscountControls?: boolean;
  onDiscountChange?: (value: number) => void;
  onItemDiscountChange?: (itemKey: string, value: number) => void;
  isLocked?: boolean;
  isSellerRfqResponseMode?: boolean;
  isPerColorNegotiationMode?: boolean;
  rfqLineResponses?: Record<string, RfqLineResponse>;
  rfqResponseSummaries?: Record<string, RfqResponseSummary>;
  onRfqLineResponseChange?: (
    item: QuoteItem,
    next: RfqLineResponse | ((current: RfqLineResponse) => RfqLineResponse)
  ) => void;
};
type ZeroKmQuantityAction = "approve" | "reject";

const getItemKey = (item: QuoteItem) => item.lineKey || `${item.id}-${item.color || "default"}`;
const getZeroKmQuantityAction = (item: QuoteItem, response: RfqLineResponse): ZeroKmQuantityAction =>
  response.availability === "unavailable" || response.quantity === 0 ? "reject" : "approve";
const getHighlightMeta = (
  requestedQuantity: number,
  requestedUnitPrice: number,
  quotedQuantity: number,
  quotedUnitPrice: number,
  isRejected: boolean
) => ({
  isRejected,
  quantityChanged: !isRejected && quotedQuantity !== requestedQuantity,
  priceChanged: !isRejected && quotedUnitPrice !== requestedUnitPrice,
});

export default function NegotiationBucketCard({
  bucket,
  discountPercent,
  discountPercents,
  showDiscountControls,
  onDiscountChange,
  onItemDiscountChange,
  isLocked,
  isSellerRfqResponseMode,
  isPerColorNegotiationMode,
  rfqLineResponses,
  rfqResponseSummaries,
  onRfqLineResponseChange,
}: Readonly<Props>) {
  const [isOpen, setIsOpen] = useState(Boolean(isSellerRfqResponseMode));
  const [imageLoaded, setImageLoaded] = useState(false);
  const isExpanded = isOpen;
  const distinctColors = Array.from(new Set(bucket.items.map((item) => item.color).filter(Boolean)));
  const hasRfqResponseSummaries = Boolean(rfqResponseSummaries && Object.keys(rfqResponseSummaries).length > 0);
  const liveBucketSummary = bucket.items.reduce(
    (acc, item) => {
      const itemKey = getItemKey(item);
      const sellerResponse = rfqLineResponses?.[itemKey] || getDefaultRfqLineResponse(item);
      const buyerResponse = rfqResponseSummaries?.[itemKey];
      const itemDiscountPercent = discountPercents?.[itemKey] ?? 0;

      const totalUnits = isSellerRfqResponseMode
        ? sellerResponse.availability === "unavailable"
          ? 0
          : Number(sellerResponse.quantity) || 0
        : buyerResponse
          ? Number(buyerResponse.totalUnits) || 0
          : item.quantity;
      const unitPrice = isSellerRfqResponseMode
        ? sellerResponse.availability === "unavailable"
          ? 0
          : Number(sellerResponse.unitPrice) || 0
        : buyerResponse
          ? Number(buyerResponse.unitPrice) || 0
          : item.price;
      const lineTotal = totalUnits * unitPrice;
      const adjustedLineTotal = isPerColorNegotiationMode
        ? lineTotal * (1 - itemDiscountPercent / 100)
        : lineTotal;

      if (totalUnits > 0) {
        acc.activeColors += 1;
      }

      acc.totalUnits += totalUnits;
      acc.totalPrice += adjustedLineTotal;

      return acc;
    },
    { totalUnits: 0, activeColors: 0, totalPrice: 0 }
  );
  const displayUnits = isSellerRfqResponseMode || hasRfqResponseSummaries ? liveBucketSummary.totalUnits : bucket.unitCount;
  const displayColors = isSellerRfqResponseMode || hasRfqResponseSummaries ? liveBucketSummary.activeColors : distinctColors.length;
  // Calculate discounted price
  const originalPrice = bucket.bucketTotal;
  const discountAmount = originalPrice * (discountPercent / 100);
  const finalPrice = originalPrice - discountAmount;
  const displayPrice = isSellerRfqResponseMode || hasRfqResponseSummaries
    ? liveBucketSummary.totalPrice
    : discountPercent > 0
      ? finalPrice
      : originalPrice;
  const showDiscount = discountPercent > 0;

  return (
    <div className={`border border-gray-200 rounded-lg bg-white transition-all ${isLocked ? "opacity-75" : ""}`}> {/* isLocked only affects opacity, not pointer events */}
      {/* Group Header Row - Accordion Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 px-3 py-2 transition-colors cursor-pointer hover:bg-gray-50"
      >
        {/* Left Section: Thumbnail + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Thumbnail */}
          <div className="relative h-10 w-14 bg-gray-100 rounded overflow-hidden flex-shrink-0">
            {!imageLoaded ? <div className="absolute inset-0 bg-gray-200" aria-hidden="true" /> : null}
            <Image
              src={bucket.mainImageUrl}
              alt={`${bucket.brand} ${bucket.model}`}
              fill
              onLoadingComplete={() => setImageLoaded(true)}
              className={`object-cover transition-opacity ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            />
          </div>

          {/* Vehicle Info */}
          <div className="min-w-0 flex-1">
            {/* Title + Unit Badge */}
            <div className="flex items-center gap-2 mb-0.5">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {bucket.items?.[0]?.name || [bucket.brand, bucket.model].filter(Boolean).join(" ")}
              </h4>
              <span className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-[10px] font-medium text-gray-700 px-2 py-0.5 whitespace-nowrap">
                {displayUnits} unit{displayUnits === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {bucket.variant ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Variant: {bucket.variant}
                </span>
              ) : null}
              {bucket.color && distinctColors.length <= 1 ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Color: {bucket.color}
                </span>
              ) : null}
              {isSellerRfqResponseMode || hasRfqResponseSummaries ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Colors: {displayColors}
                </span>
              ) : displayColors > 1 ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Colors: {displayColors}
                </span>
              ) : null}
              {bucket.condition ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Grade: {bucket.condition}
                </span>
              ) : null}
              {bucket.year ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Year: {bucket.year}
                </span>
              ) : null}
              {bucket.bodyType ? (
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-medium w-fit whitespace-nowrap bg-gray-50 text-gray-600 border-gray-300">
                  Body: {bucket.bodyType}
                </span>
              ) : null}
            </div>

            {/* Seller Name */}
            <p className="text-xs text-gray-600 truncate mt-0.5">{bucket.sellerCompany}</p>
          </div>
        </div>

        {/* Right Section: Price + Chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Price */}
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">
              {formatPrice(displayPrice, bucket.currency)}
            </p>
            {!isSellerRfqResponseMode && !hasRfqResponseSummaries && showDiscount && (
              <p className="text-[10px] text-gray-400 line-through">
                {formatPrice(originalPrice, bucket.currency)}
              </p>
            )}
          </div>
        </div>

        {/* Chevron Icon */}
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "transform rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>

      {/* Discount Controls */}
      {showDiscountControls && !isLocked && !isPerColorNegotiationMode && (
        <div className="border-t border-gray-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Discount</span>
            <span className="text-xs font-semibold text-brand-blue">{discountPercent}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={30}
            value={discountPercent}
            onChange={(e) => onDiscountChange?.(Number(e.target.value))}
            disabled={isLocked}
            className="w-full accent-brand-blue disabled:opacity-50"
          />
        </div>
      )}

      {/* Expanded Content - Individual Units */}
      {isExpanded && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 space-y-1">
          {bucket.items.map((item) => {
            const itemKey = getItemKey(item);
            const itemDiscountPercent = discountPercents?.[itemKey] ?? 0;
            const response = rfqLineResponses?.[itemKey] || getDefaultRfqLineResponse(item);
            const rfqResponseSummary = rfqResponseSummaries?.[itemKey];
            const originalColorTotal = item.quantity * item.price;
            const currentQuotedTotal =
              response.availability === "unavailable"
                ? 0
                : (Number(response.unitPrice) || 0) * (Number(response.quantity) || 0);
            const baseNegotiationTotal = rfqResponseSummary?.total ?? originalColorTotal;
            const adjustedNegotiationTotal = baseNegotiationTotal * (1 - itemDiscountPercent / 100);
            const sellerHighlightMeta = getHighlightMeta(
              item.quantity,
              item.price,
              Number(response.quantity) || 0,
              Number(response.unitPrice) || 0,
              response.availability === "unavailable"
            );
            const buyerHighlightMeta = getHighlightMeta(
              item.quantity,
              item.price,
              rfqResponseSummary?.totalUnits || 0,
              rfqResponseSummary?.unitPrice || 0,
              (rfqResponseSummary?.totalUnits || 0) === 0
            );

            return (
              <div key={itemKey} className="p-2 bg-white rounded-md border border-gray-100">
                {isSellerRfqResponseMode && item.marketType === "zero_km" ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{item.color || "Default Color"}</p>
                        <p className="text-[11px] text-gray-500">
                          Requested qty: {item.quantity}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          Requested unit cost: {formatPrice(item.price, item.currency)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {sellerHighlightMeta.isRejected || currentQuotedTotal !== originalColorTotal ? (
                            <>
                              <span className="text-gray-400 line-through mr-1">
                                {formatPrice(originalColorTotal, item.currency)}
                              </span>
                              <span>{formatPrice(currentQuotedTotal, item.currency)}</span>
                            </>
                          ) : (
                            formatPrice(originalColorTotal, item.currency)
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {response.availability === "unavailable" ? "Rejected" : "Current quote"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          sellerHighlightMeta.isRejected
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-200"
                        }`}
                      >
                        {sellerHighlightMeta.isRejected ? "Color rejected" : "Color approved"}
                      </span>
                      {sellerHighlightMeta.quantityChanged ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          Quantity changed
                        </span>
                      ) : null}
                      {sellerHighlightMeta.priceChanged ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          Price changed
                        </span>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1.5">
                      {sellerHighlightMeta.isRejected ? (
                        <p>
                          Status: <span className="font-semibold text-red-700">Rejected</span>
                        </p>
                      ) : (
                        <>
                          <p>
                            Quantity:{" "}
                            <span className="font-semibold text-gray-900">
                              {sellerHighlightMeta.quantityChanged
                                ? `${item.quantity} before -> ${response.quantity} now`
                                : `${item.quantity} unchanged`}
                            </span>
                          </p>
                          <p>
                            Price:{" "}
                            <span className="font-semibold text-gray-900">
                              {sellerHighlightMeta.priceChanged
                                ? `${formatPrice(item.price, item.currency)} before -> ${formatPrice(Number(response.unitPrice) || 0, item.currency)} now`
                                : `${formatPrice(item.price, item.currency)} unchanged`}
                            </span>
                          </p>
                        </>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="text-[11px] font-medium text-gray-700 block mb-1.5">Color</label>
                        <select
                          value={getZeroKmQuantityAction(item, response)}
                          onChange={(e) =>
                            onRfqLineResponseChange?.(item, (current) => ({
                              ...current,
                              availability: e.target.value === "reject" ? "unavailable" : "full",
                              quantity: e.target.value === "reject" ? 0 : item.quantity,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        >
                          <option value="approve">Approve color</option>
                          <option value="reject">Reject fully</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-gray-700 block mb-1.5">Quoted quantity</label>
                        <input
                          type="number"
                          min={0}
                          value={response.quantity}
                          disabled={response.availability === "unavailable"}
                          onChange={(e) =>
                            onRfqLineResponseChange?.(item, (current) => {
                              const nextQuantity = Math.max(0, Number(e.target.value) || 0);
                              return {
                                ...current,
                                availability: nextQuantity === 0 ? "unavailable" : nextQuantity === item.quantity ? "full" : "partial",
                                quantity: nextQuantity,
                              };
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:opacity-50"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-medium text-gray-700 block mb-1.5">Quoted unit price</label>
                        <input
                          type="number"
                          min={0}
                          value={response.unitPrice}
                          disabled={response.availability === "unavailable"}
                          onChange={(e) =>
                            onRfqLineResponseChange?.(item, (current) => ({
                              ...current,
                              unitPrice: e.target.value,
                            }))
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                ) : rfqResponseSummary && item.marketType === "zero_km" ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{item.color || "Default Color"}</p>
                        <p className="text-[11px] text-gray-500">
                          Requested qty: {item.quantity} @ {formatPrice(item.price, item.currency)}/unit
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {buyerHighlightMeta.isRejected || adjustedNegotiationTotal !== originalColorTotal ? (
                            <>
                              <span className="text-gray-400 line-through mr-1">
                                {formatPrice(originalColorTotal, item.currency)}
                              </span>
                              <span>
                                {formatPrice(adjustedNegotiationTotal, rfqResponseSummary.currency || item.currency)}
                              </span>
                            </>
                          ) : (
                            formatPrice(originalColorTotal, item.currency)
                          )}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {rfqResponseSummary.totalUnits === 0 ? "Rejected by seller" : "Seller quotation"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          buyerHighlightMeta.isRejected
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-green-50 text-green-700 border border-green-200"
                        }`}
                      >
                        {buyerHighlightMeta.isRejected ? "Rejected by seller" : "Quoted by seller"}
                      </span>
                      {buyerHighlightMeta.quantityChanged ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          Quantity changed
                        </span>
                      ) : null}
                      {buyerHighlightMeta.priceChanged ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                          Price changed
                        </span>
                      ) : null}
                    </div>

                    <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-1.5">
                      {buyerHighlightMeta.isRejected ? (
                        <p>
                          Status: <span className="font-semibold text-red-700">Rejected</span>
                        </p>
                      ) : (
                        <>
                          <p>
                            Quantity:{" "}
                            <span className="font-semibold text-gray-900">
                              {buyerHighlightMeta.quantityChanged
                                ? `${item.quantity} before -> ${rfqResponseSummary.totalUnits} now`
                                : `${item.quantity} unchanged`}
                            </span>
                          </p>
                          <p>
                            Price:{" "}
                            <span className="font-semibold text-gray-900">
                              {buyerHighlightMeta.priceChanged
                                ? `${formatPrice(item.price, item.currency)} before -> ${formatPrice(rfqResponseSummary.unitPrice, rfqResponseSummary.currency || item.currency)} now`
                                : `${formatPrice(item.price, item.currency)} unchanged`}
                            </span>
                          </p>
                        </>
                      )}
                    </div>

                    {showDiscountControls && !isLocked && isPerColorNegotiationMode && !buyerHighlightMeta.isRejected ? (
                      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-700">Color value</span>
                          <span className="text-[11px] font-semibold text-brand-blue">
                            {itemDiscountPercent}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          value={itemDiscountPercent}
                          onChange={(e) => onItemDiscountChange?.(itemKey, Number(e.target.value))}
                          className="w-full accent-brand-blue"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">{item.color || "Default Color"}</p>
                      <p className="text-[11px] text-gray-500">
                        Qty: {item.quantity} @ {formatPrice(item.price, item.currency)}/unit
                      </p>
                      {showDiscountControls && !isLocked && isPerColorNegotiationMode ? (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-medium text-gray-700">Color value</span>
                            <span className="text-[11px] font-semibold text-brand-blue">
                              {itemDiscountPercent}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={30}
                            value={itemDiscountPercent}
                            onChange={(e) => onItemDiscountChange?.(itemKey, Number(e.target.value))}
                            className="w-full accent-brand-blue"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {isPerColorNegotiationMode ? (
                          itemDiscountPercent > 0 ? (
                            <>
                              <span className="text-gray-400 line-through mr-1">
                                {formatPrice(baseNegotiationTotal, item.currency)}
                              </span>
                              <span>{formatPrice(adjustedNegotiationTotal, item.currency)}</span>
                            </>
                          ) : (
                            formatPrice(baseNegotiationTotal, item.currency)
                          )
                        ) : (
                          formatPrice(item.price * item.quantity, item.currency)
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
