"use client";

import { AlertCircleIcon, AddIcon, ArrowLeftIcon, ArrowRightIcon, CloseIcon, Shield } from "@/components/Icons";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import type { FormState, VehicleInfo } from "@/components/add-vehicle/VehicleForm";
import Input from "@/elements/Input";
import Button from "@/elements/Button";
import message from "@/elements/message";
import { ZodTreeError } from "@/validation/shared-schema";
import Select, { type Option } from "@/elements/Select";
import { Incoterm } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateFormField: (name: keyof FormState, value: unknown, errorPath?: (string | number)[]) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: (e: FormEvent) => void;
    errors?: ZodTreeError;
    filterData?: Record<string, unknown>;
};

const VIN_REGEX = /^[A-HJ-NPR-Z0-9]+$/;
const normalizeVin = (v: string) => v.trim().toUpperCase();
const isValidVin = (vin: string) => vin.length === 17 && VIN_REGEX.test(vin);

const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "Salvage", "Grade A", "Grade B", "Grade C", "Grade D"];

const createVehicle = (isZeroKm: boolean, defaultColor?: string): VehicleInfo => ({
    mileage: isZeroKm ? undefined : 0,
    vin: "",
    registrationNumber: "",
    numberOfOwners: isZeroKm ? undefined : undefined,
    warrantyRemaining: "",
    inspectionReportUrl: "",
    color: defaultColor || "",
    availableQuantity: undefined,
    unitPrice: undefined,
    incoterm: undefined,
    vinList: [""],
    fobPrice: undefined,
    fobPortOfLoading: "",
    cifPrice: undefined,
    cifPortOfDestination: "",
});

const getVinStats = (vinList: string[]) => {
    const seen = new Set<string>();
    let valid = 0; let duplicate = 0; let invalid = 0;
    for (const v of vinList) {
        const n = normalizeVin(v || "");
        if (!n) continue;
        if (!isValidVin(n)) { invalid++; continue; }
        if (seen.has(n)) { duplicate++; continue; }
        seen.add(n); valid++;
    }
    return { valid, duplicate, invalid };
};

const syncLegacyPricing = (vehicle: VehicleInfo): VehicleInfo => {
    if ((vehicle.fobPrice || 0) > 0) return { ...vehicle, incoterm: Incoterm.FOB, unitPrice: vehicle.fobPrice };
    if ((vehicle.cifPrice || 0) > 0) return { ...vehicle, incoterm: Incoterm.CIF, unitPrice: vehicle.cifPrice };
    return { ...vehicle, incoterm: undefined, unitPrice: undefined };
};

export default function VehicleDetailsForm({
    formState, errors, updateFormField, handleInputChange, setStep, handleSubmit, filterData,
}: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const fetchedMileage = Number(formState.fetchedMileage) || 0;
    const colorOptions = ((filterData?.colors as { label: string; value: string }[]) ?? []).map(
        (c) => ({ label: c.label || c.value, value: c.value })
    ) as Option[];

    const vehicles = useMemo(
        () => (formState.vehicles?.length ? formState.vehicles : [createVehicle(isZeroKm, formState.color || "")]),
        [formState.color, formState.vehicles, isZeroKm]
    );

    const [expandedVin, setExpandedVin] = useState<Record<number, boolean>>({});
    const [vinMode, setVinMode] = useState<Record<number, "paste" | "manual" | null>>({});
    const [vinPaste, setVinPaste] = useState<Record<number, string>>({});

    const globalVinCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!isZeroKm) return counts;
        for (const v of vehicles)
            for (const vi of v.vinList || []) {
                const n = normalizeVin(vi || "");
                if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
            }
        return counts;
    }, [isZeroKm, vehicles]);

    const updateVehicleAt = (index: number, updater: (v: VehicleInfo) => VehicleInfo, errorPath?: (string | number)[]) => {
        const next = [...vehicles];
        next[index] = updater({ ...next[index] });
        updateFormField("vehicles", next, errorPath);
    };

    const applyPastedVins = (index: number) => {
        const qty = Number(vehicles[index]?.availableQuantity);
        const parsed = (vinPaste[index] || "").split(/[\s,]+/).map(normalizeVin).filter(Boolean);
        const target = qty > 0 ? qty : Math.max(parsed.length, (vehicles[index]?.vinList || []).length, 1);
        const trimmed = parsed.slice(0, target);
        updateVehicleAt(index, (v) => ({
            ...v,
            vinList: Array.from({ length: target }, (_, i) => trimmed[i] || ""),
            vin: normalizeVin(trimmed[0] || ""),
        }), ["vehicles", index, "vinList"]);
        setExpandedVin((p) => ({ ...p, [index]: true }));
        setVinMode((p) => ({ ...p, [index]: "paste" }));
        if (qty > 0 && parsed.length > target) message.error(`Only the first ${target} VINs were applied.`);
        else message.success("VINs applied");
    };

    const isChaboschiCondition = formState.conditionSource === "chaboschi";

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4 flex items-center gap-4 justify-between">
                <div>
                    <h3 className="text-brand-blue">{isZeroKm ? "Vehicle Configurations" : "Vehicle Details"}</h3>
                    <p className="text-sm text-muted-foreground">
                        {isZeroKm
                            ? "Add color-wise configurations with indicative quantities. VINs are optional at this stage."
                            : "Enter the condition, mileage, and ownership details for this vehicle."}
                    </p>
                </div>
                {isZeroKm && (
                    <Button type="button" leftIcon={<AddIcon className="h-3.5 w-3.5" />}
                        onClick={() => updateFormField("vehicles", [...vehicles, createVehicle(true)])} variant="primary">
                        Add Color Config
                    </Button>
                )}
            </div>

            {vehicles.map((item, index) => {
                if (!isZeroKm && index > 0) return null;
                const qty = Number(item.availableQuantity);
                const manualCount = qty > 0 ? qty : Math.max((item.vinList || []).length, 1);
                const vinList = (item.vinList || []).slice(0, manualCount);
                const vinStats = getVinStats(vinList);
                const filledCount = vinList.filter((v) => normalizeVin(v || "")).length;
                const isVinExpanded = !!expandedVin[index];
                const currentVinMode = vinMode[index];
                const mileageValue = Number(item.mileage) || 0;
                const isMileageBelowFetched = !isZeroKm && fetchedMileage > 0 && mileageValue > 0 && mileageValue < fetchedMileage;

                return (
                    <div key={item.id || index} className="border rounded-xl p-4 mb-6 border-stroke-light">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-brand-blue">{isZeroKm ? `Configuration #${index + 1}` : "Vehicle Detail"}</h3>
                            {isZeroKm && index > 0 && (
                                <Button onClick={() => updateFormField("vehicles", vehicles.filter((_, i) => i !== index))}
                                    variant="danger" type="button"
                                    className="bg-transparent hover:bg-destructive/10 text-destructive"
                                    leftIcon={<CloseIcon />}>
                                    Remove
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {isZeroKm ? (
                                <>
                                    <Select
                                        label="Color"
                                        required
                                        options={colorOptions}
                                        value={item.color || ""}
                                        onChange={(v) => updateVehicleAt(index, (ve) => ({ ...ve, color: v }), ["vehicles", index, "color"])}
                                        placeholder="Select color"
                                        border="bg-input-background"
                                        labelCls="text-sm font-medium"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.color?.errors}
                                    />
                                    <Input
                                        label="Available Quantity (indicative, optional)"
                                        type="number"
                                        name="availableQuantity"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.availableQuantity?.errors}
                                        value={item.availableQuantity || ""}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? undefined : Number(e.target.value);
                                            let updated = { ...item, availableQuantity: val };
                                            // sync vinList length
                                            if (val && val > 0) {
                                                const cur = [...(updated.vinList || [])];
                                                const next = cur.length < val ? [...cur, ...Array.from({ length: val - cur.length }, () => "")] : cur.slice(0, val);
                                                updated = { ...updated, vinList: next, vin: normalizeVin(next[0] || "") };
                                            }
                                            const nextVehicles = [...vehicles];
                                            nextVehicles[index] = updated;
                                            updateFormField("vehicles", nextVehicles, ["vehicles", index, "availableQuantity"]);
                                        }}
                                        placeholder="e.g., 25"
                                    />
                                    <Input
                                        label="Mileage (km, optional, max 100)"
                                        type="number"
                                        name="mileage"
                                        value={item.mileage ?? ""}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? undefined : Math.min(Number(e.target.value), 100);
                                            updateVehicleAt(index, (v) => ({ ...v, mileage: val }), ["vehicles", index, "mileage"]);
                                        }}
                                        placeholder="e.g., 15"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.mileage?.errors}
                                    />
                                </>
                            ) : (
                                <>
                                    {/* Condition */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium">Condition <span className="text-destructive">*</span></span>
                                            {isChaboschiCondition && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                                                    🔒 From inspection
                                                </span>
                                            )}
                                        </div>
                                        <Select
                                            options={CONDITIONS.map((c) => ({ label: c, value: c }))}
                                            value={formState.condition || ""}
                                            onChange={(v) => {
                                                if (isChaboschiCondition) return;
                                                updateFormField("condition", v);
                                                updateFormField("conditionSource", "manual");
                                            }}
                                            placeholder="Select condition"
                                            disabled={isChaboschiCondition}
                                            border="bg-input-background"
                                            labelCls="text-sm font-medium"
                                            errors={errors?.properties?.condition?.errors}
                                        />
                                    </div>

                                    {/* Mileage */}
                                    <div>
                                        <Input
                                            label="Mileage (km)"
                                            type="number"
                                            name="mileage"
                                            required
                                            errors={errors?.properties?.vehicles?.items?.[index]?.properties?.mileage?.errors}
                                            value={item.mileage ?? ""}
                                            onChange={(e) => {
                                                const val = e.target.value === "" ? undefined : Number(e.target.value);
                                                const clamped = fetchedMileage > 0 && val !== undefined ? Math.max(val, fetchedMileage) : val;
                                                updateVehicleAt(index, (v) => ({ ...v, mileage: clamped }), ["vehicles", index, "mileage"]);
                                            }}
                                            placeholder="e.g., 55000"
                                        />
                                        {isMileageBelowFetched && (
                                            <p className="mt-1 text-xs text-amber-700">Below Chaboschi mileage ({fetchedMileage.toLocaleString()} km). Minimum enforced.</p>
                                        )}
                                        {fetchedMileage > 0 && (
                                            <p className="mt-1 text-xs text-muted-foreground">Inspection mileage: {fetchedMileage.toLocaleString()} km. You can only increase this value.</p>
                                        )}
                                    </div>

                                    {/* VIN (read-only, set from identity step) */}
                                    <Input
                                        label="VIN"
                                        type="text"
                                        name="vin"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.vin?.errors}
                                        value={item.vin || formState.vin || ""}
                                        disabled
                                        className="text-gray-900 disabled:text-gray-900 disabled:opacity-100"
                                        placeholder="Set in Identity step"
                                        required
                                    />

                                    {/* Owners */}
                                    <Input
                                        label="Number of Previous Owners"
                                        type="number"
                                        name="numberOfOwners"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.numberOfOwners?.errors}
                                        value={item.numberOfOwners || ""}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? undefined : Number(e.target.value);
                                            updateVehicleAt(index, (v) => ({ ...v, numberOfOwners: val }), ["vehicles", index, "numberOfOwners"]);
                                        }}
                                        placeholder="e.g., 2"
                                    />

                                    {/* Warranty */}
                                    <Input
                                        label="Warranty Remaining (optional)"
                                        type="text"
                                        name="warrantyRemaining"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.warrantyRemaining?.errors}
                                        value={item.warrantyRemaining || ""}
                                        onChange={(e) => {
                                            updateVehicleAt(index, (v) => ({ ...v, warrantyRemaining: e.target.value }), ["vehicles", index, "warrantyRemaining"]);
                                        }}
                                        placeholder="e.g., 2 years, Expired"
                                    />
                                </>
                            )}
                        </div>

                        {/* VIN section for zero-km */}
                        {isZeroKm && (
                            <div className="mt-6 rounded-xl border border-stroke-light p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h4 className="text-sm font-medium text-brand-blue">
                                            VINs: {filledCount} / {qty > 0 ? qty : "—"} <span className="font-normal text-gray-500">(optional)</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {vinStats.valid} valid · {vinStats.duplicate} duplicate · {vinStats.invalid} invalid
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button type="button" variant="ghost" className="border-brand-blue"
                                            onClick={() => { setExpandedVin((p) => ({ ...p, [index]: true })); setVinMode((p) => ({ ...p, [index]: "paste" })); }}>
                                            Paste VINs
                                        </Button>
                                        <Button type="button" variant="ghost" className="border-brand-blue"
                                            onClick={() => { setExpandedVin((p) => ({ ...p, [index]: true })); setVinMode((p) => ({ ...p, [index]: "manual" })); }}>
                                            Enter one by one
                                        </Button>
                                        {isVinExpanded && (
                                            <Button type="button" variant="ghost"
                                                onClick={() => { setExpandedVin((p) => ({ ...p, [index]: false })); setVinMode((p) => ({ ...p, [index]: null })); }}>
                                                Collapse
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {isVinExpanded && currentVinMode === "paste" && (
                                    <div className="mt-4 grid gap-4">
                                        <Input
                                            label="Paste VINs"
                                            type="textarea"
                                            rows={5}
                                            value={vinPaste[index] || ""}
                                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setVinPaste((p) => ({ ...p, [index]: e.target.value }))}
                                            placeholder="One VIN per line, or comma/space separated"
                                        />
                                        <div className="flex items-center gap-2">
                                            <Button type="button" variant="primary" onClick={() => applyPastedVins(index)}>Apply VINs</Button>
                                            <span className="text-xs text-muted-foreground">VINs beyond quantity limit are ignored.</span>
                                        </div>
                                    </div>
                                )}
                                {isVinExpanded && currentVinMode === "manual" && (
                                    <div className="mt-4">
                                        {qty < 1 && (
                                            <div className="mb-3 flex justify-end">
                                                <Button type="button" variant="ghost" className="border-brand-blue"
                                                    onClick={() => updateVehicleAt(index, (v) => ({ ...v, vinList: [...(v.vinList || []), ""] }))}>
                                                    Add VIN Field
                                                </Button>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {Array.from({ length: manualCount }).map((_, vi) => {
                                                const cur = vinList[vi] || "";
                                                const norm = normalizeVin(cur);
                                                const isDupe = !!norm && (globalVinCounts.get(norm) ?? 0) > 1;
                                                const errs = [
                                                    ...(errors?.properties?.vehicles?.items?.[index]?.properties?.vinList?.items?.[vi]?.errors || []),
                                                    ...(isDupe ? ["Duplicate VIN"] : []),
                                                ];
                                                return (
                                                    <Input key={`vin-${index}-${vi}`}
                                                        label={`VIN ${vi + 1} (optional)`}
                                                        type="text"
                                                        value={cur}
                                                        onChange={(e) => updateVehicleAt(index, (v) => {
                                                            const next = [...(v.vinList || Array.from({ length: manualCount }, () => ""))];
                                                            next[vi] = normalizeVin(e.target.value);
                                                            return { ...v, vinList: next, vin: normalizeVin(next[0] || "") };
                                                        }, ["vehicles", index, "vinList", vi])}
                                                        placeholder="Optional 17-character VIN"
                                                        errors={errs}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Inspection summary (second-hand, if found) */}
                        {!isZeroKm && formState.vinLookupStatus === "not_found" && (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <p><strong>No inspection data retrieved.</strong> Continue with manual entry.</p>
                                </div>
                            </div>
                        )}
                        {!isZeroKm && formState.vinLookupStatus === "found" && formState.inspectionSummary && (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Shield className="h-4 w-4" /> Inspection Summary
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-900 mb-3">Inspection Conclusion</p>
                                        {formState.inspectionSummary.split("\n").filter(Boolean).map((line) => (
                                            <div key={line} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900 mb-2">{line}</div>
                                        ))}
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                                        <p className="font-semibold mb-3">Metadata</p>
                                        <p><span className="font-medium">Provider:</span> {formState.inspectionProvider}</p>
                                        <p className="mt-2"><span className="font-medium">Date:</span> {formState.inspectionDateNote}</p>
                                    </div>
                                    {formState.vehicleDescription && (
                                        <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
                                            <p className="text-sm font-semibold text-slate-900 mb-2">Vehicle Description</p>
                                            <p className="text-sm leading-6 text-slate-700">{formState.vehicleDescription}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Description */}
            <div className="rounded-xl border border-stroke-light p-4 mb-6">
                <Input
                    type="textarea"
                    label="Description (optional)"
                    name="description"
                    rows={4}
                    errors={errors?.properties?.description?.errors}
                    value={formState.description || ""}
                    onChange={handleInputChange}
                    placeholder="Describe the vehicle's history, condition, features, or any special notes..."
                />
            </div>

            <div className="pt-6 border-t border-stroke-light flex justify-between">
                <button onClick={() => setStep((p) => p - 1)} type="button"
                    className="justify-center gap-2 whitespace-nowrap text-brand-blue border-stroke-light rounded-md text-sm font-medium border bg-background hover:bg-accent px-4 py-2 flex items-center">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Previous
                </button>
                <button type="submit"
                    className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white">
                    Next <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
            </div>
        </form>
    );
}
