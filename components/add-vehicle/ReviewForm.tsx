"use client";

import { Dispatch, SetStateAction } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import Image from "@/elements/Image";
import Button from "@/elements/Button";
import { ArrowLeftIcon } from "@/components/Icons";
import { emptyFeatureCategories } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    updateFormField: (name: keyof FormState, value: unknown) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    handleSaveDraft: () => void;
    publishLoading?: boolean;
    draftLoading?: boolean;
    errors?: Record<string, unknown>;
};

function SectionCard({ title, step, setStep, children }: { title: string; step: number; setStep: Dispatch<SetStateAction<number>>; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-stroke-light bg-white overflow-hidden mb-4">
            <div className="flex items-center justify-between px-5 py-3 border-b border-stroke-light bg-[#f8fafc]">
                <p className="text-sm font-semibold text-[#202C4A]">{title}</p>
                <button type="button" onClick={() => setStep(step)}
                    className="text-xs text-brand-blue hover:underline underline-offset-2 font-medium">
                    Edit
                </button>
            </div>
            <div className="px-5 py-4">{children}</div>
        </div>
    );
}

function Field({ label, value, locked }: { label: string; value?: string | number | null; locked?: boolean }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 min-w-32 shrink-0">{label}</span>
            <span className="text-xs font-medium text-[#202C4A] flex items-center gap-1.5">
                {locked && <span className="inline-flex items-center rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-blue">Inspection</span>}
                {value}
            </span>
        </div>
    );
}

export default function ReviewForm({
    formState, setStep, handleSubmit, handleSaveDraft, publishLoading, draftLoading,
}: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const locked = formState.chaboschiLockedFields ?? [];
    const isLocked = (f: string) => locked.includes(f);
    const cats = formState.featureCategories ?? emptyFeatureCategories;
    const totalFeatures = Object.values(cats).flatMap((c) => Object.values(c as Record<string, string[]>).flat()).length;

    const v0 = formState.vehicles?.[0];
    const images = formState.imageUrls || [];

    return (
        <div>
            {/* Submission info banner */}
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Review before submitting</p>
                <p className="mt-0.5 text-xs">Once submitted, your listing will be reviewed by the ADPG team before going live. This typically takes 1–2 business days.</p>
            </div>

            {/* Step 1 — Vehicle Identity */}
            <SectionCard title="Vehicle Identity" step={1} setStep={setStep}>
                <div className="grid grid-cols-2 gap-y-2">
                    <Field label="Market Type" value={isZeroKm ? "Zero-KM" : "Second-Hand"} />
                    <Field label="Vehicle Type" value={formState.vehicleType} />
                    <Field label="Country of Origin" value={formState.countryOfOrigin} />
                    <Field label="Make" value={formState.brand} locked={isLocked("brand")} />
                    <Field label="Model" value={formState.model} locked={isLocked("model")} />
                    <Field label="Variant" value={formState.variant} locked={isLocked("variant")} />
                    <Field label="Year" value={formState.year} locked={isLocked("year")} />
                    <Field label="Color" value={formState.color} />
                    <Field label="Regional Specs" value={formState.regionalSpecs} />
                    <Field label="Body Type" value={formState.bodyType} />
                    <Field label="Country" value={formState.country} />
                    <Field label="City" value={formState.city} />
                    {!isZeroKm && <Field label="VIN" value={formState.vin} />}
                </div>
                {formState.vinLookupStatus === "found" && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        ✓ VIN verified on Chaboschi. Inspection data applied.
                    </div>
                )}
            </SectionCard>

            {/* Step 2 — Vehicle Details */}
            <SectionCard title="Vehicle Details" step={2} setStep={setStep}>
                {!isZeroKm ? (
                    <div className="grid grid-cols-2 gap-y-2">
                        <Field label="Condition" value={formState.condition} locked={formState.conditionSource === "chaboschi"} />
                        <Field label="Mileage" value={v0?.mileage !== undefined ? `${v0.mileage.toLocaleString()} km` : undefined} />
                        <Field label="Owners" value={v0?.numberOfOwners} />
                        <Field label="Warranty" value={v0?.warrantyRemaining} />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {(formState.vehicles || []).map((v, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg border border-stroke-light bg-[#f8fafc] px-3 py-2 text-xs">
                                <span className="font-medium text-[#202C4A]">{v.color || `Config #${i + 1}`}</span>
                                {v.availableQuantity && <span className="text-gray-500">{v.availableQuantity} units</span>}
                                {v.mileage !== undefined && <span className="text-gray-500">{v.mileage} km</span>}
                            </div>
                        ))}
                    </div>
                )}
                {formState.description && (
                    <p className="mt-3 text-xs text-gray-600 italic">&quot;{formState.description.slice(0, 120)}{formState.description.length > 120 ? "…" : ""}&quot;</p>
                )}
            </SectionCard>

            {/* Step 3 — Commercial Details */}
            <SectionCard title="Commercial Details" step={3} setStep={setStep}>
                <div className="grid grid-cols-2 gap-y-2">
                    <Field label="Currency" value={formState.currency} />
                    {!isZeroKm && (
                        <>
                            <Field label="Incoterm" value={v0?.incoterm} />
                            <Field label="Asking Price" value={formState.price ? `${formState.currency} ${Number(formState.price).toLocaleString()}` : undefined} />
                            <Field label="Max Discount" value={formState.maxDiscountMargin !== undefined ? `${formState.maxDiscountMargin}%` : undefined} />
                            {v0?.incoterm === "FOB" && <Field label="FOB Price" value={v0.fobPrice ? `${formState.currency} ${v0.fobPrice.toLocaleString()}` : undefined} />}
                            {v0?.incoterm === "FOB" && <Field label="Port of Loading" value={v0.fobPortOfLoading} />}
                            {v0?.incoterm === "CIF" && <Field label="CIF Price" value={v0.cifPrice ? `${formState.currency} ${v0.cifPrice.toLocaleString()}` : undefined} />}
                            {v0?.incoterm === "CIF" && <Field label="Port of Destination" value={v0.cifPortOfDestination} />}
                        </>
                    )}
                    <Field label="Negotiations" value={formState.allowPriceNegotiations ? "Allowed" : "Not allowed"} />
                </div>
            </SectionCard>

            {/* Step 4 — Technical Specs */}
            <SectionCard title="Technical Specifications" step={4} setStep={setStep}>
                <div className="grid grid-cols-2 gap-y-2">
                    <Field label="Fuel Type" value={formState.fuelType} />
                    <Field label="Engine Size" value={formState.engineSize} />
                    <Field label="Battery Size" value={formState.batterySize} />
                    <Field label="Range" value={formState.electricRange} />
                    <Field label="Transmission" value={formState.transmission} />
                    <Field label="Drivetrain" value={formState.drivetrain} />
                    <Field label="Cylinders" value={formState.cylinders || undefined} />
                    <Field label="Horsepower" value={formState.horsepower ? `${formState.horsepower} HP` : undefined} />
                    <Field label="Seating" value={formState.seatingCapacity || undefined} />
                    <Field label="Doors" value={formState.numberOfDoors || undefined} />
                    {formState.vehicleLength && <Field label="Length" value={`${formState.vehicleLength} mm`} />}
                    {formState.vehicleWidth && <Field label="Width" value={`${formState.vehicleWidth} mm`} />}
                    {formState.vehicleHeight && <Field label="Height" value={`${formState.vehicleHeight} mm`} />}
                    {formState.vehicleWheelbase && <Field label="Wheelbase" value={`${formState.vehicleWheelbase} mm`} />}
                </div>
            </SectionCard>

            {/* Step 5 — Features */}
            <SectionCard title="Features" step={5} setStep={setStep}>
                {totalFeatures === 0 ? (
                    <p className="text-sm text-gray-400">No features selected.</p>
                ) : (
                    <div className="space-y-3">
                        {([
                            { key: "interior", label: "Interior", subs: ["seatMaterial", "seatFeatures"] },
                            { key: "exterior", label: "Exterior", subs: ["wheels", "lighting", "roof"] },
                            { key: "technology", label: "Technology", subs: ["connectivity", "display", "audio"] },
                            { key: "safety", label: "Safety", subs: ["core", "advanced"] },
                            { key: "comfort", label: "Comfort", subs: ["climate", "access"] },
                        ] as const).map((cat) => {
                            const selected = cat.subs.flatMap((s) => (cats[cat.key] as Record<string, string[]>)[s] ?? []);
                            if (!selected.length) return null;
                            return (
                                <div key={cat.key}>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{cat.label}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {selected.map((v) => (
                                            <span key={v} className="rounded-full border border-brand-blue/20 bg-brand-blue/5 px-2 py-0.5 text-[10px] text-brand-blue">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </SectionCard>

            {/* Step 6 — Images */}
            <SectionCard title="Images" step={6} setStep={setStep}>
                {images.length === 0 ? (
                    <p className="text-sm text-gray-400">No images uploaded. At least one image is required.</p>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {images.map((img) => (
                            <div key={img} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${formState.mainImageUrl === img ? "border-brand-blue" : "border-stroke-light"}`}>
                                <Image fill src={img} alt="vehicle" className="object-cover" sizes="80px" height={80} width={80} />
                                {formState.mainImageUrl === img && (
                                    <span className="absolute bottom-0 inset-x-0 bg-brand-blue text-white text-[8px] text-center py-0.5">Main</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{images.length} image{images.length !== 1 ? "s" : ""} uploaded</p>
            </SectionCard>

            {/* Validation warnings */}
            {(() => {
                const warnings: string[] = [];
                if (!formState.brand) warnings.push("Make is required");
                if (!formState.model) warnings.push("Model is required");
                if (!formState.variant) warnings.push("Variant is required");
                if (!isZeroKm && !formState.vin) warnings.push("VIN is required for second-hand vehicles");
                if (!isZeroKm && !formState.condition) warnings.push("Condition is required");
                if (!isZeroKm && !formState.price) warnings.push("Price is required");
                if (!images.length) warnings.push("At least one image is required");
                if (!formState.mainImageUrl) warnings.push("A main image must be selected");
                if (warnings.length === 0) return null;
                return (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-4">
                        <p className="text-xs font-semibold text-red-800 mb-2">Fix before submitting:</p>
                        <ul className="space-y-1">
                            {warnings.map((w) => (
                                <li key={w} className="text-xs text-red-700 flex items-center gap-1.5">
                                    <span className="text-red-500">•</span> {w}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })()}

            {/* Actions */}
            <div className="pt-6 border-t border-stroke-light flex flex-col sm:flex-row gap-3 justify-between">
                <button onClick={() => setStep((p) => p - 1)} type="button"
                    className="justify-center gap-2 whitespace-nowrap text-brand-blue border-stroke-light rounded-md text-sm font-medium border bg-background hover:bg-accent px-4 py-2 flex items-center">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Previous
                </button>
                <div className="flex gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        className="border-brand-blue"
                        loading={draftLoading}
                        onClick={handleSaveDraft}>
                        Save as Draft
                    </Button>
                    <button
                        type="button"
                        disabled={publishLoading}
                        onClick={handleSubmit}
                        className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue/90 px-6 py-2.5 flex items-center disabled:opacity-50 disabled:cursor-not-allowed">
                        {publishLoading ? "Submitting…" : "Submit for Review"}
                    </button>
                </div>
            </div>
        </div>
    );
}
