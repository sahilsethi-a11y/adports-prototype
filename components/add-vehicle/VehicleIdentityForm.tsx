"use client";

import { AlertCircleIcon, ArrowRightIcon, CheckCircleIcon, SearchIcon } from "@/components/Icons";
import Select, { type Option } from "@/elements/Select";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import { getCities, getModals, getVariants, type Model, type Variant, type Brand, VEHICLE_TYPES, COUNTRIES_OF_ORIGIN } from "@/lib/data";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import Input from "@/elements/Input";
import { ZodTreeError } from "@/validation/shared-schema";
import Button from "@/elements/Button";
import message from "@/elements/message";
import { lookupVinOnChaboschi } from "@/lib/chaboschi";

type PropsT = {
    brands?: Brand[];
    formState: FormState;
    updateFormField: (name: keyof FormState, value: unknown) => void;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    filterData?: Record<string, unknown>;
    setStep: Dispatch<SetStateAction<number>>;
    errors?: ZodTreeError;
    handleSubmit: (e: FormEvent) => void;
};

const VIN_DUPE_STATUS = ["duplicate_same_seller", "duplicate_other_seller", "blocked_negotiation", "blocked_sold"];

function LockBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
            🔒 From inspection
        </span>
    );
}

function UnverifiedBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
            ⚠️ Seller-provided
        </span>
    );
}

export default function VehicleIdentityForm({
    brands, formState, errors, updateFormField, handleInputChange, filterData, handleSubmit,
}: Readonly<PropsT>) {
    const [models, setModels] = useState<Model[]>();
    const [variants, setVariants] = useState<Variant[]>();
    const [cities, setCities] = useState<Option[]>();
    const [isManualVariant, setIsManualVariant] = useState(false);
    const [vinLookupLoading, setVinLookupLoading] = useState(false);

    const isZeroKm = formState.marketType === "zero_km";
    const locked = formState.chaboschiLockedFields ?? [];
    const isLocked = (field: string) => locked.includes(field);
    const isManualMode = formState.vinLookupStatus === "not_found";
    const FieldBadge = ({ field }: { field: string }) => {
        if (isLocked(field)) return <LockBadge />;
        if (isManualMode && !isZeroKm) return <UnverifiedBadge />;
        return null;
    };

    useEffect(() => {
        if (!formState.brand) return;
        getModals(formState.brand).then((res) => setModels(res.data)).catch(() => {});
    }, [formState.brand]);

    useEffect(() => {
        if (!formState.model || isManualVariant) return;
        getVariants(formState.model).then((res) => setVariants(res.data)).catch(() => {});
    }, [formState.model, isManualVariant]);

    useEffect(() => {
        if (!formState.country) return;
        getCities(formState.country).then((res) => {
            setCities(
                res?.data?.map((city: { id: string; name: string }) => ({
                    label: city.name,
                    value: city.name,
                    extra: city.id,
                }))
            );
        }).catch(() => {});
    }, [formState.country]);

    const canLookupVin = !isZeroKm && !!formState.vin && formState.vin.length >= 10;

    const handleVinLookup = async () => {
        if (!canLookupVin) {
            message.error("Enter at least a partial VIN before lookup.");
            return;
        }
        setVinLookupLoading(true);
        try {
            const vin = String(formState.vin || "").trim().toUpperCase();
            // Demo: VINs starting with "NF", "XX", or "00" simulate a not-found response
            const demoIsNotFound = vin.startsWith("NF") || vin.startsWith("XX") || vin.startsWith("00");
            const result = await lookupVinOnChaboschi(vin, demoIsNotFound ? "not_found" : "found");
            updateFormField("vinLookupProvider", result.provider);

            if (result.status === "not_found") {
                updateFormField("vinLookupStatus", "not_found");
                updateFormField("vinLookupMessage", result.warning);
                updateFormField("inspectionSummary", "");
                updateFormField("fetchedMileage", undefined);
                updateFormField("chaboschiLockedFields", []);
                updateFormField("vehicles", [{ ...(formState.vehicles?.[0] || {}), vin }]);
                message.info(result.warning);
                return;
            }

            // Enrichment success — auto-fill and lock identity fields
            updateFormField("vinLookupStatus", "found");
            updateFormField("vinLookupMessage", "VIN verified on Chaboschi. Identity fields locked.");
            // Identity
            updateFormField("brand", result.make);
            updateFormField("model", result.model);
            updateFormField("variant", result.variant);
            updateFormField("year", result.year);
            updateFormField("vehicleType", result.vehicleType);
            updateFormField("countryOfOrigin", result.countryOfOrigin);
            updateFormField("regionalSpecs", result.regionalSpecs);
            updateFormField("bodyType", result.bodyType);
            // Inspection metadata
            updateFormField("inspectionSummary", result.inspectionSummary);
            updateFormField("inspectionProvider", result.inspectionProvider);
            updateFormField("inspectionDateNote", result.inspectionDateNote);
            updateFormField("vehicleDescription", result.vehicleDescription);
            updateFormField("fetchedMileage", result.mileage);
            updateFormField("condition", result.condition);
            updateFormField("conditionSource", "chaboschi");
            updateFormField("imageUrls", result.imageUrls);
            updateFormField("mainImageUrl", result.imageUrls[0] || "");
            updateFormField("chaboschiLockedFields", [
                "brand", "model", "variant", "year",
                "vehicleType", "countryOfOrigin", "regionalSpecs", "bodyType",
            ]);
            updateFormField("vehicles", [{
                mileage: Math.max(Number(formState.vehicles?.[0]?.mileage) || 0, result.mileage),
                vin,
                registrationNumber: formState.vehicles?.[0]?.registrationNumber || "",
                numberOfOwners: formState.vehicles?.[0]?.numberOfOwners,
                warrantyRemaining: formState.vehicles?.[0]?.warrantyRemaining || "",
                inspectionReportUrl: "",
                color: formState.vehicles?.[0]?.color || formState.color || "",
                vinList: [vin],
                fobPortOfLoading: formState.vehicles?.[0]?.fobPortOfLoading || "",
                cifPortOfDestination: formState.vehicles?.[0]?.cifPortOfDestination || "",
            }]);
            message.success("VIN verified. Inspection data applied.");
        } finally {
            setVinLookupLoading(false);
        }
    };

    const vinStatus = formState.vinLookupStatus;

    return (
        <form onSubmit={handleSubmit} noValidate>
            {/* Market type banner */}
            <div className={`mb-5 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${isZeroKm ? "bg-sky-50 border border-sky-200 text-sky-800" : "bg-brand-blue/5 border border-brand-blue/20 text-brand-blue"}`}>
                <span className="text-lg">{isZeroKm ? "🆕" : "🔑"}</span>
                {isZeroKm
                    ? "Zero-KM Vehicle — VIN is optional at this stage and will be required at the order/shipment stage."
                    : "Second-Hand Vehicle — VIN is required. Run a VIN lookup to fetch inspection data from Chaboschi."}
            </div>

            {/* VIN (second-hand only) */}
            {!isZeroKm && (
                <div className="mb-6 rounded-xl border border-stroke-light bg-slate-50 p-4">
                    <h3 className="mb-1 text-sm font-semibold text-brand-blue">VIN Identification</h3>
                    <p className="mb-4 text-xs text-muted-foreground">Enter the 17-character VIN and run a lookup to verify against Chaboschi inspection data.</p>
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <Input
                                label="VIN"
                                type="text"
                                name="vin"
                                errors={errors?.properties?.vin?.errors}
                                value={formState.vin || ""}
                                onChange={(e) => updateFormField("vin", e.target.value.toUpperCase())}
                                placeholder="17-character VIN"
                                required
                            />
                        </div>
                        <div className="flex items-end pb-0.5">
                            <Button
                                type="button"
                                variant="outline"
                                loading={vinLookupLoading}
                                disabled={!canLookupVin}
                                leftIcon={<SearchIcon className="h-4 w-4" />}
                                onClick={handleVinLookup}
                                className="border-brand-blue text-brand-blue whitespace-nowrap"
                            >
                                VIN Lookup
                            </Button>
                        </div>
                    </div>

                    {/* Demo hint */}
                    {!vinStatus && (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                            💡 <strong>Demo:</strong> Start VIN with <code className="bg-gray-100 px-1 rounded">NF</code>, <code className="bg-gray-100 px-1 rounded">XX</code>, or <code className="bg-gray-100 px-1 rounded">00</code> to simulate a not-found response.
                        </p>
                    )}

                    {/* VIN status banners */}
                    {vinStatus === "found" && (
                        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                            <div className="flex items-start gap-2">
                                <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <p className="font-medium">VIN verified on Chaboschi</p>
                                    <p className="mt-0.5 text-xs">Make, model, variant, and year have been auto-filled and locked to inspection data.</p>
                                </div>
                            </div>
                        </div>
                    )}
                    {vinStatus === "not_found" && (
                        <div className="mt-4 space-y-3">
                            {/* Primary warning */}
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                    <div>
                                        <p className="font-semibold">VIN not found on Chaboschi</p>
                                        <p className="mt-0.5 text-xs text-amber-800">No inspection record was found for this VIN. This vehicle will be listed without inspection verification.</p>
                                    </div>
                                </div>
                            </div>
                            {/* Manual entry guidance */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-base">📝</span>
                                    <p className="text-sm font-semibold text-[#202C4A]">Manual Entry Mode</p>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">Unverified</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Fill in the vehicle details manually below. Since these are seller-provided, all fields will be marked as <strong>unverified</strong> on the listing.
                                </p>
                                <ul className="space-y-1.5">
                                    {[
                                        { field: "Make, Model & Variant", note: "Select from dropdowns below" },
                                        { field: "Year of Manufacture", note: "Enter 4-digit year" },
                                        { field: "Vehicle Condition", note: "Provided on the next step" },
                                        { field: "Mileage", note: "Provided on the next step" },
                                    ].map(({ field, note }) => (
                                        <li key={field} className="flex items-center gap-2 text-xs">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                                            <span className="text-[#202C4A] font-medium">{field}</span>
                                            <span className="text-muted-foreground">— {note}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 text-[11px] text-muted-foreground border-t pt-2">
                                    You can re-run the VIN lookup at any time if the vehicle gets inspected later.
                                </p>
                            </div>
                        </div>
                    )}
                    {vinStatus === "duplicate_same_seller" && (
                        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                            <AlertCircleIcon className="inline mr-2 h-4 w-4" />
                            <strong>Duplicate VIN — your listing.</strong> This VIN is already listed under your account. You can replace, archive, or merge the existing listing.
                        </div>
                    )}
                    {vinStatus === "duplicate_other_seller" && (
                        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
                            <AlertCircleIcon className="inline mr-2 h-4 w-4" />
                            <strong>Duplicate VIN — another seller.</strong> This VIN is listed by another seller and is pending admin review. You may save as draft only.
                        </div>
                    )}
                    {(vinStatus === "blocked_negotiation" || vinStatus === "blocked_sold") && (
                        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                            <AlertCircleIcon className="inline mr-2 h-4 w-4" />
                            {vinStatus === "blocked_negotiation"
                                ? <><strong>Blocked.</strong> This VIN is currently in an active negotiation and cannot be relisted.</>
                                : <><strong>Blocked.</strong> This VIN has been marked as sold and cannot be relisted.</>
                            }
                        </div>
                    )}
                </div>
            )}

            {/* Vehicle identity fields */}
            <div className={`rounded-xl border p-4 mb-6 ${isManualMode && !isZeroKm ? "border-amber-200 bg-amber-50/30" : "border-stroke-light"}`}>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-brand-blue">Vehicle Identity</h2>
                    {isManualMode && !isZeroKm && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Manual Entry</span>
                    )}
                    {vinStatus === "found" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">✓ Inspection Verified</span>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Vehicle Type */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Vehicle Type</span>
                            <FieldBadge field="vehicleType" />
                        </div>
                        <Select
                            name="vehicleType"
                            options={VEHICLE_TYPES.map((t) => ({ label: t, value: t }))}
                            value={formState.vehicleType || ""}
                            onChange={(value) => { if (!isLocked("vehicleType")) updateFormField("vehicleType", value); }}
                            placeholder="Select vehicle type"
                            disabled={isLocked("vehicleType")}
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Country of Origin */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Country of Origin</span>
                            <FieldBadge field="countryOfOrigin" />
                        </div>
                        <Select
                            name="countryOfOrigin"
                            options={COUNTRIES_OF_ORIGIN}
                            value={formState.countryOfOrigin || ""}
                            onChange={(value) => { if (!isLocked("countryOfOrigin")) updateFormField("countryOfOrigin", value); }}
                            placeholder="Select country of origin"
                            disabled={isLocked("countryOfOrigin")}
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Brand */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Make <span className="text-destructive">*</span></span>
                            <FieldBadge field="brand" />
                        </div>
                        <Select
                            name="brand"
                            errors={errors?.properties?.brand?.errors}
                            options={brands?.map((b) => ({ value: b.name, label: b.name }))}
                            value={formState.brand}
                            onChange={(value) => {
                                if (isLocked("brand")) return;
                                updateFormField("brand", value);
                                updateFormField("model", "");
                                updateFormField("variant", "");
                            }}
                            placeholder="Select Make"
                            disabled={isLocked("brand")}
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Model */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Model <span className="text-destructive">*</span></span>
                            <FieldBadge field="model" />
                        </div>
                        <Select
                            name="model"
                            errors={errors?.properties?.model?.errors}
                            options={models?.map((m) => ({ value: m.modelName, label: m.modelName }))}
                            value={formState.model}
                            onChange={(value) => {
                                if (isLocked("model")) return;
                                updateFormField("model", value);
                                updateFormField("variant", "");
                            }}
                            placeholder="Select Model"
                            disabled={isLocked("model")}
                            noDataMessage="Select model found"
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Variant */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Variant <span className="text-destructive">*</span></span>
                            <FieldBadge field="variant" />
                        </div>
                        {isManualVariant ? (
                            <Input
                                type="text"
                                name="variant"
                                errors={errors?.properties?.variant?.errors}
                                value={formState.variant || ""}
                                onChange={handleInputChange}
                                placeholder="Enter variant"
                                disabled={isLocked("variant")}
                                label={
                                    <span className="flex items-center justify-between">
                                        <span />
                                        <button type="button" className="text-xs font-normal text-brand-blue underline underline-offset-2" onClick={() => setIsManualVariant(false)}>
                                            Use dropdown
                                        </button>
                                    </span>
                                }
                            />
                        ) : (
                            <>
                                <Select
                                    name="variant"
                                    errors={errors?.properties?.variant?.errors}
                                    options={variants?.map((v) => ({ value: v.variantName, label: v.variantName }))}
                                    value={formState.variant}
                                    onChange={(value) => { if (!isLocked("variant")) updateFormField("variant", value); }}
                                    placeholder="Select Variant"
                                    noDataMessage="No variant found"
                                    disabled={isLocked("variant")}
                                    border="bg-input-background"
                                    labelCls="text-sm font-medium"
                                />
                                {!isLocked("variant") && (
                                    <div className="mt-1 text-right">
                                        <button type="button" className="text-xs text-brand-blue underline underline-offset-2" onClick={() => setIsManualVariant(true)}>
                                            Enter manually
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Year */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Year <span className="text-destructive">*</span></span>
                            <FieldBadge field="year" />
                        </div>
                        <Input
                            type="number"
                            name="year"
                            errors={errors?.properties?.year?.errors}
                            value={formState.year || ""}
                            onChange={handleInputChange}
                            placeholder="2023"
                            disabled={isLocked("year")}
                            label=""
                        />
                    </div>

                    {/* Regional Specs */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Regional Specs <span className="text-destructive">*</span></span>
                            <FieldBadge field="regionalSpecs" />
                        </div>
                        <Select
                            name="regionalSpecs"
                            errors={errors?.properties?.regionalSpecs?.errors}
                            options={(filterData?.regionalSpecsOptions as Option[])?.map((item) => ({ value: item.value, label: item.label }))}
                            value={formState.regionalSpecs}
                            onChange={(value) => { if (!isLocked("regionalSpecs")) updateFormField("regionalSpecs", value); }}
                            placeholder="Select regional specs"
                            disabled={isLocked("regionalSpecs")}
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Body Type */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Body Type <span className="text-destructive">*</span></span>
                            <FieldBadge field="bodyType" />
                        </div>
                        <Select
                            name="bodyType"
                            errors={errors?.properties?.bodyType?.errors}
                            options={(filterData?.bodyType as Option[])?.map((item) => ({ value: item.value, label: item.label }))}
                            value={formState.bodyType}
                            onChange={(value) => { if (!isLocked("bodyType")) updateFormField("bodyType", value); }}
                            placeholder="Select body type"
                            disabled={isLocked("bodyType")}
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                        />
                    </div>

                    {/* Country (seller location) */}
                    <Select
                        label="Country"
                        required
                        name="country"
                        errors={errors?.properties?.country?.errors}
                        options={(filterData?.country as Option[])?.map((item) => ({ value: item.value, label: item.label }))}
                        value={formState.country}
                        onChange={(value) => updateFormField("country", value)}
                        placeholder="e.g. UAE"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />

                    {/* City */}
                    <Select
                        label="City"
                        required
                        name="city"
                        errors={errors?.properties?.city?.errors}
                        options={cities?.map((item) => ({ value: item.value, label: item.label }))}
                        value={formState.city}
                        onChange={(value) => updateFormField("city", value)}
                        placeholder="e.g. Dubai"
                        noDataMessage="Select country first"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                </div>

                {/* Color — second-hand only */}
                {!isZeroKm && (
                    <fieldset className="mt-5">
                        <legend className="text-sm font-medium mb-2">Color <span className="text-destructive">*</span></legend>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                            {(filterData?.colors as { label: string; value: string; hex: string }[])?.map((color) => (
                                <label
                                    key={color.value}
                                    className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                                        formState.color === color.value ? "border-brand-blue bg-blue-50" : "border-gray-200 hover:border-gray-300"
                                    }`}>
                                    <div className="w-9 h-9 rounded-full border border-gray-300 shrink-0" style={{ backgroundColor: color.hex }} aria-hidden="true" />
                                    <input type="radio" name="color" value={color.value} onChange={handleInputChange} hidden />
                                    <span className="text-xs/4.5 text-center">{color.value}</span>
                                </label>
                            ))}
                        </div>
                        {errors?.properties?.color?.errors?.map((err: string) => (
                            <span key={err} className="text-xs text-destructive mt-1 block">{err}</span>
                        ))}
                    </fieldset>
                )}
            </div>

            <div className="flex justify-end items-center pt-6 border-t border-stroke-light">
                <button
                    type="submit"
                    className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white">
                    Next
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        </form>
    );
}
