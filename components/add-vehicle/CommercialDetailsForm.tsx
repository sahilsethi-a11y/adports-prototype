"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";
import { Dispatch, SetStateAction, useMemo } from "react";
import type { FormState, VehicleInfo } from "@/components/add-vehicle/VehicleForm";
import Input from "@/elements/Input";
import { ZodTreeError } from "@/validation/shared-schema";
import Select, { type Option } from "@/elements/Select";
import { Incoterm } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    updateFormField: (name: keyof FormState, value: unknown, errorPath?: (string | number)[]) => void;
    updateVehicleField: (vehicles: VehicleInfo[]) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    errors?: ZodTreeError;
    filterData?: Record<string, unknown>;
};

const INCOTERMS = [
    { label: "FOB – Free On Board", value: Incoterm.FOB },
    { label: "CIF – Cost, Insurance & Freight", value: Incoterm.CIF },
    { label: "CFR – Cost & Freight", value: Incoterm.CFR },
    { label: "EXW – Ex Works", value: Incoterm.EXW },
    { label: "FCA – Free Carrier", value: Incoterm.FCA },
    { label: "DAP – Delivered At Place", value: Incoterm.DAP },
    { label: "FAS – Free Alongside Ship", value: Incoterm.FAS },
    { label: "DDP – Delivered Duty Paid", value: Incoterm.DDP },
    { label: "DPU – Delivered At Place Unloaded", value: Incoterm.DPU },
];

export default function CommercialDetailsForm({
    formState, errors, updateFormField, updateVehicleField, setStep, handleSubmit, filterData,
}: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const currencyOptions = ((filterData?.currency as Option[]) ?? []).map((c) => ({ label: c.label || c.value, value: c.value }));
    const colorOptions = ((filterData?.colors as { label: string; value: string }[]) ?? []).map((c) => ({ label: c.label || c.value, value: c.value }));

    const vehicles = useMemo(
        () => (formState.vehicles?.length ? formState.vehicles : []),
        [formState.vehicles]
    );

    const updateVehicle = (index: number, patch: Partial<VehicleInfo>) => {
        const next = [...vehicles];
        next[index] = { ...next[index], ...patch };
        // Sync unitPrice/incoterm
        if (patch.fobPrice !== undefined || patch.incoterm !== undefined) {
            const v = next[index];
            if (v.incoterm === Incoterm.FOB) next[index] = { ...v, unitPrice: v.fobPrice, cifPrice: undefined, cifPortOfDestination: "" };
            if (v.incoterm === Incoterm.CIF) next[index] = { ...v, unitPrice: v.cifPrice, fobPrice: undefined, fobPortOfLoading: "" };
        }
        updateVehicleField(next);
    };

    const v0 = vehicles[0];

    return (
        <div>
            {/* Currency (shared) */}
            <div className="rounded-xl border border-stroke-light p-4 mb-6">
                <h2 className="text-brand-blue mb-4">Commercial Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Currency"
                        name="currency"
                        required
                        options={currencyOptions.length ? currencyOptions : [{ label: "USD", value: "USD" }, { label: "AED", value: "AED" }, { label: "EUR", value: "EUR" }]}
                        value={formState.currency || ""}
                        onChange={(v) => updateFormField("currency", v)}
                        placeholder="Select currency"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                        errors={errors?.properties?.currency?.errors}
                    />
                </div>
            </div>

            {/* Second-hand: single vehicle pricing */}
            {!isZeroKm && v0 !== undefined && (
                <div className="rounded-xl border border-stroke-light p-4 mb-6 space-y-4">
                    <h3 className="text-brand-blue">Pricing & Terms</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Incoterm */}
                        <Select
                            label="Incoterm"
                            required
                            options={INCOTERMS}
                            value={v0.incoterm || ""}
                            onChange={(val) => updateVehicle(0, { incoterm: val as Incoterm })}
                            placeholder="Select incoterm"
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                            errors={errors?.properties?.vehicles?.items?.[0]?.properties?.incoterm?.errors}
                        />

                        {/* Asking Price */}
                        <div>
                            <Input
                                label="Asking Price"
                                type="number"
                                name="price"
                                required
                                value={formState.price || ""}
                                onChange={(e) => updateFormField("price", e.target.value === "" ? undefined : Number(e.target.value))}
                                placeholder="e.g., 45000"
                                errors={errors?.properties?.price?.errors}
                            />
                            {formState.currency && (
                                <p className="mt-1 text-xs text-muted-foreground">in {formState.currency}</p>
                            )}
                        </div>

                        {/* FOB price + port */}
                        {v0.incoterm === Incoterm.FOB && (
                            <>
                                <Input
                                    label="FOB Price"
                                    type="number"
                                    name="fobPrice"
                                    required
                                    value={v0.fobPrice || ""}
                                    onChange={(e) => updateVehicle(0, { fobPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                                    placeholder="e.g., 43000"
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.fobPrice?.errors}
                                />
                                <Input
                                    label="Port of Loading"
                                    type="text"
                                    name="fobPortOfLoading"
                                    required
                                    value={v0.fobPortOfLoading || ""}
                                    onChange={(e) => updateVehicle(0, { fobPortOfLoading: e.target.value })}
                                    placeholder="e.g., Jebel Ali, Shanghai"
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.fobPortOfLoading?.errors}
                                />
                            </>
                        )}

                        {/* CIF price + port */}
                        {v0.incoterm === Incoterm.CIF && (
                            <>
                                <Input
                                    label="CIF Price"
                                    type="number"
                                    name="cifPrice"
                                    required
                                    value={v0.cifPrice || ""}
                                    onChange={(e) => updateVehicle(0, { cifPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                                    placeholder="e.g., 47000"
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.cifPrice?.errors}
                                />
                                <Input
                                    label="Port of Destination"
                                    type="text"
                                    name="cifPortOfDestination"
                                    required
                                    value={v0.cifPortOfDestination || ""}
                                    onChange={(e) => updateVehicle(0, { cifPortOfDestination: e.target.value })}
                                    placeholder="e.g., Port of Dubai, Barcelona"
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.cifPortOfDestination?.errors}
                                />
                            </>
                        )}

                        {/* Max Discount Margin */}
                        <div>
                            <Input
                                label="Maximum Discount Margin (%)"
                                type="number"
                                name="maxDiscountMargin"
                                value={formState.maxDiscountMargin ?? ""}
                                onChange={(e) => updateFormField("maxDiscountMargin", e.target.value === "" ? undefined : Number(e.target.value))}
                                placeholder="e.g., 5"
                                errors={errors?.properties?.maxDiscountMargin?.errors}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">Maximum discount you are willing to accept from the asking price.</p>
                        </div>
                    </div>

                    {/* Negotiation toggle */}
                    <div className="flex items-center gap-3 mt-2">
                        <button
                            type="button"
                            onClick={() => updateFormField("allowPriceNegotiations", !formState.allowPriceNegotiations)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formState.allowPriceNegotiations ? "bg-brand-blue" : "bg-gray-200"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formState.allowPriceNegotiations ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                        <span className="text-sm font-medium text-[#202C4A]">Allow price negotiations</span>
                    </div>
                    {formState.allowPriceNegotiations && (
                        <Input
                            type="textarea"
                            label="Negotiation Notes (optional)"
                            name="negotiationNotes"
                            rows={2}
                            value={formState.negotiationNotes || ""}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateFormField("negotiationNotes", e.target.value)}
                            placeholder="Any conditions or notes for buyers regarding negotiation..."
                        />
                    )}
                </div>
            )}

            {/* Zero-km: per-color pricing */}
            {isZeroKm && (
                <div className="rounded-xl border border-stroke-light p-4 mb-6 space-y-4">
                    <div>
                        <h3 className="text-brand-blue">Indicative Pricing per Configuration</h3>
                        <p className="text-sm text-muted-foreground mt-1">Prices are indicative and non-binding. Buyers may request any quantity.</p>
                    </div>
                    {vehicles.length === 0 && (
                        <p className="text-sm text-gray-400">No configurations added. Go back to Vehicle Details to add color configurations.</p>
                    )}
                    {vehicles.map((item, index) => (
                        <div key={index} className="rounded-xl border border-stroke-light bg-[#f8fafc] p-4">
                            <div className="flex items-center gap-2 mb-3">
                                {item.color && colorOptions.find((c) => c.value === item.color) && (
                                    <span className="rounded-full px-3 py-1 text-xs font-medium bg-brand-blue/10 text-brand-blue">{item.color}</span>
                                )}
                                <span className="text-sm font-medium text-[#202C4A]">
                                    Config #{index + 1}{item.availableQuantity ? ` · ${item.availableQuantity} units` : ""}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    label="Incoterm (optional)"
                                    options={INCOTERMS}
                                    value={item.incoterm || ""}
                                    onChange={(val) => updateVehicle(index, { incoterm: val as Incoterm })}
                                    placeholder="Select incoterm"
                                    border="bg-input-background"
                                    labelCls="text-sm font-medium"
                                />
                                {item.incoterm === Incoterm.FOB && (
                                    <>
                                        <Input
                                            label="FOB Price (indicative)"
                                            type="number"
                                            value={item.fobPrice || ""}
                                            onChange={(e) => updateVehicle(index, { fobPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                                            placeholder="e.g., 32000"
                                        />
                                        <Input
                                            label="Port of Loading"
                                            type="text"
                                            value={item.fobPortOfLoading || ""}
                                            onChange={(e) => updateVehicle(index, { fobPortOfLoading: e.target.value })}
                                            placeholder="e.g., Shanghai, Tianjin"
                                        />
                                    </>
                                )}
                                {item.incoterm === Incoterm.CIF && (
                                    <>
                                        <Input
                                            label="CIF Price (indicative)"
                                            type="number"
                                            value={item.cifPrice || ""}
                                            onChange={(e) => updateVehicle(index, { cifPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                                            placeholder="e.g., 35000"
                                        />
                                        <Input
                                            label="Port of Destination"
                                            type="text"
                                            value={item.cifPortOfDestination || ""}
                                            onChange={(e) => updateVehicle(index, { cifPortOfDestination: e.target.value })}
                                            placeholder="e.g., Jebel Ali, Hamburg"
                                        />
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {/* Allow negotiations */}
                    <div className="flex items-center gap-3 mt-2">
                        <button
                            type="button"
                            onClick={() => updateFormField("allowPriceNegotiations", !formState.allowPriceNegotiations)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formState.allowPriceNegotiations ? "bg-brand-blue" : "bg-gray-200"}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formState.allowPriceNegotiations ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                        <span className="text-sm font-medium text-[#202C4A]">Allow price negotiations</span>
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
