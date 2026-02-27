"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { setClientMarketMode, type MarketMode } from "@/lib/marketplace";
import { CheckIcon, CautionIcon } from "@/components/Icons";

type MarketplaceSwitchProps = {
    mode?: MarketMode;
    className?: string;
    showLabel?: boolean;
    required?: boolean;
    compact?: boolean;
};

export default function MarketplaceSwitch({ mode, className, showLabel = false, required = false, compact = false }: Readonly<MarketplaceSwitchProps>) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const queryMode = searchParams.get("market");
    const current: MarketMode | null =
        queryMode === "second_hand" || queryMode === "zero_km" ? queryMode : mode === "second_hand" || mode === "zero_km" ? mode : null;

    const switchMode = (next: MarketMode) => {
        if (next === current) return;
        const sp = new URLSearchParams(searchParams.toString());
        sp.set("market", next);
        setClientMarketMode(next);
        router.push(`${pathname}?${sp.toString()}`);
    };

    return (
        <div className={`${className ?? ""}`}>
            {compact ? (
                <div className="inline-flex w-full items-center rounded-md border border-stroke-light bg-white p-1">
                    <button
                        type="button"
                        onClick={() => switchMode("second_hand")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                            current === "second_hand" ? "bg-brand-blue text-white" : "text-gray-700 hover:bg-gray-100"
                        }`}>
                        Second-Hand
                    </button>
                    <button
                        type="button"
                        onClick={() => switchMode("zero_km")}
                        className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
                            current === "zero_km" ? "bg-brand-blue text-white" : "text-gray-700 hover:bg-gray-100"
                        }`}>
                        Zero KM
                    </button>
                </div>
            ) : null}
            {!compact ? (
                <>
                    {showLabel && (
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">
                                    Marketplace Type {required ? <span className="text-destructive">*</span> : null}
                                </p>
                                <p className="text-xs text-gray-600">Select one before searching vehicles.</p>
                            </div>
                            {required && !current ? (
                                <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs font-medium text-destructive">
                                    <CautionIcon className="h-3.5 w-3.5" />
                                    Required
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                    <CheckIcon className="h-3.5 w-3.5" />
                                    Selected
                                </span>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => switchMode("second_hand")}
                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                current === "second_hand"
                                    ? "border-brand-blue bg-brand-blue text-white shadow-[0px_10px_18px_-14px_rgba(32,44,74,0.8)]"
                                    : "border-stroke-light bg-white text-gray-800 hover:border-brand-blue/50 hover:bg-gray-50"
                            }`}>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">Second-Hand</p>
                                    <p className={`mt-0.5 text-xs ${current === "second_hand" ? "text-white/85" : "text-gray-600"}`}>
                                        Pre-owned cars from verified sellers
                                    </p>
                                </div>
                                <span
                                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                        current === "second_hand" ? "border-white bg-white text-brand-blue" : "border-gray-300 bg-white"
                                    }`}>
                                    {current === "second_hand" ? <CheckIcon className="h-3 w-3" /> : null}
                                </span>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => switchMode("zero_km")}
                            className={`rounded-xl border px-4 py-3 text-left transition-all ${
                                current === "zero_km"
                                    ? "border-brand-blue bg-brand-blue text-white shadow-[0px_10px_18px_-14px_rgba(32,44,74,0.8)]"
                                    : "border-stroke-light bg-white text-gray-800 hover:border-brand-blue/50 hover:bg-gray-50"
                            }`}>
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold">Zero KM</p>
                                    <p className={`mt-0.5 text-xs ${current === "zero_km" ? "text-white/85" : "text-gray-600"}`}>
                                        Brand-new vehicles with zero mileage
                                    </p>
                                </div>
                                <span
                                    className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                        current === "zero_km" ? "border-white bg-white text-brand-blue" : "border-gray-300 bg-white"
                                    }`}>
                                    {current === "zero_km" ? <CheckIcon className="h-3 w-3" /> : null}
                                </span>
                            </div>
                        </button>
                    </div>
                    {required && !current ? <p className="mt-2 text-xs font-medium text-destructive">Required before searching vehicles.</p> : null}
                </>
            ) : null}
        </div>
    );
}
