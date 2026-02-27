"use client";

import { useMemo, useState } from "react";
import Button from "@/elements/Button";
import message from "@/elements/message";
import { type MarketMode } from "@/lib/marketplace";
import { LOCAL_AUTH_COOKIE, LOCAL_AUTH_STORAGE_KEY, getDemoUserByToken, type LocalAuthUser } from "@/lib/localAuth";
import { getClientMarketMode, scopedStorageKey } from "@/lib/marketplace";

type Props = {
    marketMode: MarketMode;
    vehicleId: string;
    availableUnits: number;
    name: string;
    year?: number;
    location: string;
    price: number;
    currency: string;
    mainImageUrl: string;
    sellerId?: string;
    sellerCompany: string;
    brand?: string;
    model?: string;
    variant?: string;
    color?: string;
    colorOptions?: string[];
    condition?: string;
    bodyType?: string;
};

const safeStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const safeNum = (v: unknown) => (typeof v === "number" ? v : Number(v));

const buildZeroKmQuoteKey = (p: {
    brand?: string;
    model?: string;
    variant?: string;
    year?: number;
    color?: string;
    sellerId?: string;
}) => {
    const brand = safeStr(p.brand).toLowerCase();
    const model = safeStr(p.model).toLowerCase();
    const variant = safeStr(p.variant).toLowerCase();
    const year = safeNum(p.year);
    const color = safeStr(p.color).toLowerCase();
    return ["zero_km", p.sellerId || "", brand, model, variant, year, color].join("|");
};

const colorHexMap: Record<string, string> = {
    white: "#f6f7f8",
    black: "#1f232a",
    silver: "#c6ccd6",
    gray: "#858b93",
    blue: "#2d6bb4",
    red: "#b73a3a",
    green: "#2f7f5f",
    yellow: "#d4a018",
    orange: "#c46a2d",
    brown: "#7b563e",
};

const getColorHex = (color: string) => colorHexMap[color.toLowerCase().trim()] || "#8a93a3";

export default function ZeroKmQuantityCard(props: Readonly<Props>) {
    const maxUnits = Math.max(1, props.availableUnits || 1);
    const colorOptions = (props.colorOptions && props.colorOptions.length ? props.colorOptions : [props.color].filter(Boolean)) as string[];
    const defaultColor = colorOptions[0] || props.color || "White";
    const [selectedColors, setSelectedColors] = useState<string[]>([defaultColor]);
    const [quantitiesByColor, setQuantitiesByColor] = useState<Record<string, number>>({ [defaultColor]: 1 });
    const [loading, setLoading] = useState(false);

    const selectedEntries = useMemo(
        () =>
            selectedColors
                .map((color) => ({ color, quantity: Math.max(1, quantitiesByColor[color] || 1) }))
                .filter((entry) => entry.quantity > 0),
        [selectedColors, quantitiesByColor]
    );

    const updateQty = (color: string, delta: number) => {
        setQuantitiesByColor((prev) => {
            const current = Math.max(1, prev[color] || 1);
            return { ...prev, [color]: Math.max(1, Math.min(maxUnits, current + delta)) };
        });
    };

    const toggleColor = (color: string) => {
        setSelectedColors((prev) => {
            if (prev.includes(color)) return prev.filter((c) => c !== color);
            return [...prev, color];
        });
        setQuantitiesByColor((prev) => ({ ...prev, [color]: Math.max(1, prev[color] || 1) }));
    };

    const isBuyer = () => {
        if (typeof window === "undefined") return false;
        try {
            const raw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
            const localUser = raw ? (JSON.parse(raw) as LocalAuthUser) : null;
            if (localUser?.roleType) return localUser.roleType.toLowerCase() === "buyer";
        } catch {}
        const token = document.cookie
            .split("; ")
            .find((row) => row.startsWith(`${LOCAL_AUTH_COOKIE}=`))
            ?.split("=")[1];
        const cookieUser = getDemoUserByToken(token ? decodeURIComponent(token) : null);
        return cookieUser?.roleType?.toLowerCase() === "buyer";
    };

    const handleAddSelected = () => {
        if (selectedEntries.length < 1) {
            message.info("Select at least one color");
            return;
        }
        if (!isBuyer()) {
            message.info("Only buyers can add vehicle to quote builder");
            return;
        }
        setLoading(true);
        try {
            if (typeof window === "undefined") return;
            const marketMode = getClientMarketMode();
            const quoteItemsStorageKey = scopedStorageKey("quoteBuilderItems", marketMode);
            const quoteStorageKey = scopedStorageKey("quoteBuilderIds", marketMode);
            const quoteSellerStorageKey = scopedStorageKey("quoteBuilderSellerByVehicle", marketMode);
            const quoteSellerCompanyStorageKey = scopedStorageKey("quoteBuilderSellerByCompany", marketMode);
            const quoteVehicleCompanyStorageKey = scopedStorageKey("quoteBuilderVehicleByCompany", marketMode);

            const rawItems = window.localStorage.getItem(quoteItemsStorageKey);
            const parsedItems = rawItems ? (JSON.parse(rawItems) as Array<Record<string, unknown>>) : [];
            const nextItems = [...parsedItems];

            for (const entry of selectedEntries) {
                const bucketKey = buildZeroKmQuoteKey({
                    brand: props.brand,
                    model: props.model,
                    variant: props.variant,
                    year: props.year,
                    color: entry.color,
                    sellerId: props.sellerId,
                });
                const lineKey = `${props.vehicleId}::${bucketKey}`;
                const existingIndex = nextItems.findIndex((item) => String(item?.lineKey || "") === lineKey);
                const nextQuantity = entry.quantity;
                const payload = {
                    id: props.vehicleId,
                    lineKey,
                    name: props.name,
                    year: props.year || 0,
                    location: props.location,
                    quantity: nextQuantity,
                    price: Number(props.price) || 0,
                    currency: props.currency || "USD",
                    mainImageUrl: props.mainImageUrl,
                    sellerCompany: props.sellerCompany || "Unknown Seller",
                    sellerId: props.sellerId,
                    bucketKey,
                    isSelected: true,
                    brand: props.brand,
                    model: props.model,
                    variant: props.variant,
                    color: entry.color,
                    colorOptions: colorOptions,
                    marketType: "zero_km" as const,
                    condition: props.condition,
                    bodyType: props.bodyType,
                };
                if (existingIndex >= 0) {
                    nextItems[existingIndex] = payload;
                } else {
                    nextItems.push(payload);
                }
            }

            window.localStorage.setItem(quoteItemsStorageKey, JSON.stringify(nextItems));

            const rawIds = window.localStorage.getItem(quoteStorageKey);
            const parsedIds = rawIds ? (JSON.parse(rawIds) as string[]) : [];
            const mergedIds = Array.from(new Set([...parsedIds, props.vehicleId]));
            window.localStorage.setItem(quoteStorageKey, JSON.stringify(mergedIds));

            if (props.sellerId) {
                const rawMap = window.localStorage.getItem(quoteSellerStorageKey);
                const parsedMap = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};
                parsedMap[props.vehicleId] = props.sellerId;
                window.localStorage.setItem(quoteSellerStorageKey, JSON.stringify(parsedMap));
            }

            if (props.sellerCompany && props.sellerId) {
                const rawCompanyMap = window.localStorage.getItem(quoteSellerCompanyStorageKey);
                const parsedCompanyMap = rawCompanyMap ? (JSON.parse(rawCompanyMap) as Record<string, string>) : {};
                parsedCompanyMap[props.sellerCompany] = props.sellerId;
                window.localStorage.setItem(quoteSellerCompanyStorageKey, JSON.stringify(parsedCompanyMap));
            }

            if (props.sellerCompany) {
                const rawVehicleCompanyMap = window.localStorage.getItem(quoteVehicleCompanyStorageKey);
                const parsedVehicleCompanyMap = rawVehicleCompanyMap ? (JSON.parse(rawVehicleCompanyMap) as Record<string, string>) : {};
                parsedVehicleCompanyMap[props.sellerCompany] = props.vehicleId;
                window.localStorage.setItem(quoteVehicleCompanyStorageKey, JSON.stringify(parsedVehicleCompanyMap));
            }
            window.dispatchEvent(new Event("quoteBuilderUpdated"));
            message.success("Added selected options to quote builder");
        } catch {
            message.error("Failed to update quote builder");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-stroke-light p-7.5">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-brand-blue">Color Allocation</h3>
                <p className="text-sm text-gray-600 mt-1">Select multiple colors and define quantity for each one.</p>
            </div>
            <div className="mb-4 rounded-md border border-stroke-light bg-gray-50 px-3 py-2 text-xs text-gray-700">
                <span>
                    Selected colors: <span className="font-semibold">{selectedEntries.length}</span>
                </span>
                <span className="ml-3">
                    Total units: <span className="font-semibold">{selectedEntries.reduce((sum, entry) => sum + entry.quantity, 0)}</span>
                </span>
                <span className="ml-3 text-gray-500">Max per color: {maxUnits}</span>
            </div>
            <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
                {colorOptions.map((color) => {
                    const selected = selectedColors.includes(color);
                    const qty = Math.max(1, quantitiesByColor[color] || 1);
                    const colorHex = getColorHex(color);
                    return (
                        <div key={color} className={`rounded-md border p-2.5 transition-colors ${selected ? "border-brand-blue/40 bg-brand-blue/5" : "border-stroke-light bg-white"}`}>
                            <div className="flex items-center justify-between gap-3">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={selected} onChange={() => toggleColor(color)} className="h-4 w-4" />
                                    <span
                                        className="inline-block h-4 w-4 rounded-full border border-black/20"
                                        style={{ backgroundColor: colorHex }}
                                        aria-hidden="true"
                                    />
                                    <span className="text-sm font-medium text-gray-800">{color}</span>
                                    {selected ? <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">Selected</span> : null}
                                </label>
                                <div className="inline-flex items-center rounded-md border border-stroke-light overflow-hidden">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 rounded-none"
                                        disabled={!selected}
                                        onClick={() => updateQty(color, -1)}
                                    >
                                        -
                                    </Button>
                                    <span className="h-8 min-w-10 px-2 text-xs flex items-center justify-center border-x border-stroke-light">{qty}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 rounded-none"
                                        disabled={!selected}
                                        onClick={() => updateQty(color, 1)}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="mb-4 rounded-md border border-stroke-light bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {selectedEntries.length > 0 ? (
                    <span>
                        Selected:{" "}
                        {selectedEntries.map((entry) => `${entry.color} (${entry.quantity})`).join(", ")}
                    </span>
                ) : (
                    <span>No colors selected</span>
                )}
            </div>
            <Button type="button" fullWidth size="md" loading={loading} onClick={handleAddSelected}>
                Add Selected to Quote Builder
            </Button>
        </div>
    );
}
