"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";
import { Dispatch, SetStateAction, useState } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import { ZodTreeError } from "@/validation/shared-schema";
import { FEATURE_OPTIONS } from "@/lib/data";
import { emptyFeatureCategories, type FeatureCategories } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    updateFormField: (name: keyof FormState, value: unknown) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    errors?: ZodTreeError;
};

type CategoryKey = keyof FeatureCategories;
type SubcategoryKey<C extends CategoryKey> = keyof FeatureCategories[C];

const CATEGORY_META: {
    key: CategoryKey;
    label: string;
    emoji: string;
    subcategories: { key: string; label: string }[];
}[] = [
    {
        key: "interior",
        label: "Interior",
        emoji: "🪑",
        subcategories: [
            { key: "seatMaterial", label: "Seat Material" },
            { key: "seatFeatures", label: "Seat Features" },
        ],
    },
    {
        key: "exterior",
        label: "Exterior",
        emoji: "🚗",
        subcategories: [
            { key: "wheels", label: "Wheels" },
            { key: "lighting", label: "Lighting" },
            { key: "roof", label: "Roof" },
        ],
    },
    {
        key: "technology",
        label: "Technology",
        emoji: "📱",
        subcategories: [
            { key: "connectivity", label: "Connectivity" },
            { key: "display", label: "Display" },
            { key: "audio", label: "Audio System" },
        ],
    },
    {
        key: "safety",
        label: "Safety",
        emoji: "🛡️",
        subcategories: [
            { key: "core", label: "Core Safety" },
            { key: "advanced", label: "Advanced Safety (ADAS)" },
        ],
    },
    {
        key: "comfort",
        label: "Comfort",
        emoji: "💺",
        subcategories: [
            { key: "climate", label: "Climate Control" },
            { key: "access", label: "Access & Convenience" },
        ],
    },
];

function countCategory(cats: FeatureCategories, key: CategoryKey): number {
    const cat = cats[key] as Record<string, string[]>;
    return Object.values(cat).reduce((sum, arr) => sum + arr.length, 0);
}

function totalSelected(cats: FeatureCategories): number {
    return CATEGORY_META.reduce((sum, c) => sum + countCategory(cats, c.key), 0);
}

export default function FeaturesChecklistForm({ formState, errors: _errors, updateFormField, setStep, handleSubmit }: Readonly<PropsT>) {
    const cats = formState.featureCategories ?? emptyFeatureCategories;
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(
        Object.fromEntries(CATEGORY_META.map((c) => [c.key, true]))
    );

    const toggleFeature = (categoryKey: CategoryKey, subcategoryKey: string, value: string) => {
        const current = (cats[categoryKey] as Record<string, string[]>)[subcategoryKey] ?? [];
        const next = current.includes(value)
            ? current.filter((v) => v !== value)
            : [...current, value];
        const newCats: FeatureCategories = {
            ...cats,
            [categoryKey]: {
                ...(cats[categoryKey] as Record<string, string[]>),
                [subcategoryKey]: next,
            },
        };
        updateFormField("featureCategories", newCats);
    };

    const toggleCategory = (key: string) => setOpenCategories((p) => ({ ...p, [key]: !p[key] }));

    const total = totalSelected(cats);

    return (
        <div>
            {/* Summary bar */}
            <div className="mb-5 flex items-center justify-between rounded-xl border border-brand-blue/20 bg-brand-blue/5 px-4 py-3">
                <p className="text-sm font-medium text-brand-blue">Features Checklist</p>
                <span className="rounded-full bg-brand-blue px-3 py-1 text-xs font-semibold text-white">
                    {total} selected
                </span>
            </div>

            <div className="space-y-4 mb-6">
                {CATEGORY_META.map((category) => {
                    const catCount = countCategory(cats, category.key);
                    const isOpen = openCategories[category.key];
                    const options = FEATURE_OPTIONS[category.key];

                    return (
                        <div key={category.key} className="rounded-xl border border-stroke-light overflow-hidden">
                            {/* Category header */}
                            <button
                                type="button"
                                onClick={() => toggleCategory(category.key)}
                                className="flex w-full items-center justify-between px-5 py-4 bg-white hover:bg-[#f8fafc] transition-colors text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{category.emoji}</span>
                                    <span className="text-sm font-semibold text-[#202C4A]">{category.label}</span>
                                    {catCount > 0 && (
                                        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-bold text-brand-blue">
                                            {catCount} selected
                                        </span>
                                    )}
                                </div>
                                <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                            </button>

                            {/* Subcategories */}
                            {isOpen && (
                                <div className="px-5 pb-5 bg-[#fafbfc] space-y-5 border-t border-stroke-light">
                                    {category.subcategories.map((sub) => {
                                        const optionList = (options as Record<string, readonly string[]>)[sub.key] ?? [];
                                        const selected = ((cats[category.key] as Record<string, string[]>)[sub.key] ?? []);

                                        return (
                                            <div key={sub.key} className="pt-4">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                                                    {sub.label}
                                                </p>
                                                <div className="flex flex-wrap gap-2">
                                                    {optionList.map((option) => {
                                                        const isSelected = selected.includes(option);
                                                        return (
                                                            <button
                                                                key={option}
                                                                type="button"
                                                                onClick={() => toggleFeature(
                                                                    category.key,
                                                                    sub.key as SubcategoryKey<typeof category.key>,
                                                                    option
                                                                )}
                                                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                                                                    isSelected
                                                                        ? "border-brand-blue bg-brand-blue text-white shadow-sm"
                                                                        : "border-gray-200 bg-white text-gray-600 hover:border-brand-blue/40 hover:text-brand-blue"
                                                                }`}
                                                            >
                                                                {isSelected ? "✓ " : ""}{option}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Selected summary */}
            {total > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 mb-6">
                    <p className="text-xs font-semibold text-emerald-800 mb-2">{total} features selected across all categories</p>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_META.map((c) => {
                            const catCurrent = cats[c.key] as Record<string, string[]>;
                            return Object.entries(catCurrent).flatMap(([, vals]) =>
                                vals.map((v) => (
                                    <span key={`${c.key}-${v}`} className="rounded-full bg-white border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-800">
                                        {v}
                                    </span>
                                ))
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="pt-6 border-t border-stroke-light flex justify-between">
                <button onClick={() => setStep((p) => p - 1)} type="button"
                    className="justify-center gap-2 whitespace-nowrap text-brand-blue border-stroke-light rounded-md text-sm font-medium border bg-background hover:bg-accent px-4 py-2 flex items-center">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Previous
                </button>
                <button onClick={handleSubmit} type="button"
                    className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white">
                    Next <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}
