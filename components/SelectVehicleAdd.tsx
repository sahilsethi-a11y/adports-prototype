"use client";

import { CheckCircleIcon, CloseIcon, DownloadIcon, FileIcon } from "@/components/Icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/elements/Button";
import { setClientMarketMode } from "@/lib/marketplace";
import { downloadBulkTemplate } from "@/lib/bulk-upload";
import { MarketType } from "@/validation/vehicle-schema";

type PropsT = {
    onClose: () => void;
};

const data = {
    title: "Choose Vehicle Upload Method",
    subtitle: "Select how you'd like to add your vehicles to the marketplace",
    types: [
        {
            title: "Form-Based Entry",
            description: "Add vehicles one at a time using our guided form with step-by-step validation",
            benefits: ["Easy to use interface", "Real-time validation", "Image upload support", "Multiple vehicle instances"],
            note: "Best for: Single or few vehicles",
            type: "form-based",
        },
        {
            title: "CSV/Excel Upload",
            description: "Upload multiple vehicles at once using our template spreadsheet",
            benefits: ["Bulk upload support", "Fast data entry", "Error validation report", "Template provided"],
            note: "Best for: Multiple vehicles (10+)",
            type: "excel-based",
        },
    ],
};

export default function SelectVehicleAdd({ onClose }: Readonly<PropsT>) {
    const [selectedType, setSelectedType] = useState("");
    const [marketType, setMarketType] = useState<"" | "second_hand" | "zero_km">("");
    const router = useRouter();

    const handleTypeSelection = () => {
        if (!marketType) return;
        setClientMarketMode(marketType);
        if (selectedType === "form-based") {
            router.push(`/add-vehicle?market=${marketType}&marketType=${marketType}`);
        } else if (selectedType === "excel-based") {
            router.push(`/add-vehicle/bulk?marketType=${marketType}`);
        }
    };

    return (
        <div>
            <button onClick={onClose} className="absolute top-2 right-2 p-2 text-gray-500 hover:text-gray-700 cursor-pointer">
                <CloseIcon />
            </button>
            <div className="flex flex-col gap-2 text-center sm:text-left mb-4">
                <h2 className="text-lg leading-none font-semibold flex items-center text-brand-blue">{data.title}</h2>
                <p className="text-muted-foreground text-sm">{data.subtitle}</p>
            </div>
            <div className="overflow-auto max-h-[calc(100vh-100px)]">
                <div className="mb-6 rounded-lg border border-stroke-light p-4">
                    <p className="text-sm font-medium text-brand-blue mb-3">1. Select Vehicle Type</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setMarketType("second_hand")}
                            className={`rounded-lg border px-4 py-3 text-left transition-all ${
                                marketType === "second_hand"
                                    ? "border-brand-blue bg-brand-blue text-white"
                                    : "border-stroke-light bg-white text-gray-800 hover:border-brand-blue/50"
                            }`}>
                            <p className="text-sm font-semibold">Used Vehicle</p>
                            <p className={`mt-0.5 text-xs ${marketType === "second_hand" ? "text-white/85" : "text-gray-600"}`}>Pre-owned listing</p>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMarketType("zero_km")}
                            className={`rounded-lg border px-4 py-3 text-left transition-all ${
                                marketType === "zero_km"
                                    ? "border-brand-blue bg-brand-blue text-white"
                                    : "border-stroke-light bg-white text-gray-800 hover:border-brand-blue/50"
                            }`}>
                            <p className="text-sm font-semibold">New Vehicle</p>
                            <p className={`mt-0.5 text-xs ${marketType === "zero_km" ? "text-white/85" : "text-gray-600"}`}>Zero KM listing</p>
                        </button>
                    </div>
                </div>

                <p className="text-sm font-medium text-brand-blue mb-3">2. Select Upload Method</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.types.map((t) => (
                        <div
                            key={t.title}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && setSelectedType(t.type)}
                            onClick={() => setSelectedType(t.type)}
                            className={`relative p-6 border rounded-lg transition-all hover:shadow-lg cursor-pointer text-left border-gray-200 hover:border-brand-blue ${
                                t.type === selectedType ? "bg-blue-50" : ""
                            }`}>
                            {t.type === selectedType && (
                                <div className="absolute top-4 right-4">
                                    <CheckCircleIcon className="h-5 w-5 text-brand-blue" />
                                </div>
                            )}
                            <div className="flex flex-col items-center space-y-4">
                                <div className="p-4 rounded-full bg-gray-100">
                                    <FileIcon className="text-brand-blue" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-brand-blue mb-2">{t.title}</h3>
                                    <p className="text-sm text-gray-600 mb-4">{t.description}</p>
                                    <div className="space-y-2 text-xs text-gray-500">
                                        {t.benefits.map((b) => (
                                            <div key={b} className="flex items-center justify-center space-x-2">
                                                <CheckCircleIcon className="h-3 w-3 mr-1 text-green-500" />
                                                <span>{b}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {t.type === "excel-based" && (
                                <div className="mt-4 flex flex-col items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (marketType) downloadBulkTemplate(marketType as MarketType);
                                        }}
                                        disabled={!marketType}
                                        title={!marketType ? "Select a vehicle type first" : undefined}
                                        className="flex gap-2 text-brand-blue text-xs items-center border border-brand-blue rounded-md px-2 py-1 transition-colors hover:bg-brand-blue hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand-blue">
                                        <DownloadIcon className="h-3 w-3" />
                                        {marketType === "second_hand" ? "Download Used Vehicle Template" : marketType === "zero_km" ? "Download Zero KM Template" : "Download Template"}
                                    </button>
                                    {!marketType && <p className="text-xs text-muted-foreground">Select a vehicle type to enable</p>}
                                </div>
                            )}
                            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                                <span className="text-xs text-gray-500 font-medium">{t.note}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-stroke-light">
                    <Button type="reset" onClick={onClose} variant="ghost">
                        Cancel
                    </Button>
                    <Button type="submit" onClick={handleTypeSelection} disabled={!selectedType || !marketType} variant="primary">
                        Continue
                    </Button>
                </div>
            </div>
        </div>
    );
}
