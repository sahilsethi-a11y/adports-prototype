import { ArrowLeftIcon, FileIcon } from "@/components/Icons";
import { ChangeEvent, Dispatch, SetStateAction, useState } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import Select, { type Option } from "@/elements/Select";
import Input from "@/elements/Input";
import Button from "@/elements/Button";
import { ZodTreeError } from "@/validation/shared-schema";
import { Incoterm } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    updateFormField: (name: Partial<keyof FormState>, value: string | boolean) => void;
    updateVehicleField: (vehicles: FormState["vehicles"]) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    filterData?: Record<string, unknown>;
    handleSubmit: () => void;
    publishLoading: boolean;
    draftLoading: boolean;
    handleSaveDraft: () => void;
    errors?: ZodTreeError;
};

export default function PriceForm({ formState, filterData, updateFormField, updateVehicleField, setStep, handleSubmit, handleSaveDraft, draftLoading, publishLoading, errors }: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const usedCarVehicle = formState.vehicles?.[0];
    const zeroKmPricingRows = (formState.vehicles || [])
        .filter((item) => item.color || item.fobPrice || item.cifPrice)
        .map((item, index) => ({
            id: `${item.color || "color"}-${index}`,
            index,
            color: item.color || `Color ${index + 1}`,
            quantity: item.availableQuantity,
            fobPrice: item.fobPrice,
            fobPort: item.fobPortOfLoading,
            cifPrice: item.cifPrice,
            cifPort: item.cifPortOfDestination,
        }));
    const allFobPricesSame = zeroKmPricingRows.length > 1 && zeroKmPricingRows.every((row) => row.fobPrice === zeroKmPricingRows[0]?.fobPrice);
    const allCifPricesSame = zeroKmPricingRows.length > 1 && zeroKmPricingRows.every((row) => row.cifPrice === zeroKmPricingRows[0]?.cifPrice);
    const sharedFobPort = (formState.vehicles || []).find((item) => item.fobPortOfLoading?.trim())?.fobPortOfLoading || "";
    const sharedCifPort = (formState.vehicles || []).find((item) => item.cifPortOfDestination?.trim())?.cifPortOfDestination || "";
    const [useSamePriceForAllColors, setUseSamePriceForAllColors] = useState(allFobPricesSame || allCifPricesSame);
    const [sameFobPrice, setSameFobPrice] = useState<string>(allFobPricesSame && zeroKmPricingRows[0]?.fobPrice ? String(zeroKmPricingRows[0].fobPrice) : "");
    const [sameCifPrice, setSameCifPrice] = useState<string>(allCifPricesSame && zeroKmPricingRows[0]?.cifPrice ? String(zeroKmPricingRows[0].cifPrice) : "");
    const [selectedCommercialTerm, setSelectedCommercialTerm] = useState<"fob" | "cif" | null>(() => {
        const hasFob = (formState.vehicles || []).some((item) => (item.fobPrice || 0) > 0 || item.fobPortOfLoading?.trim());
        if (hasFob) return "fob";
        const hasCif = (formState.vehicles || []).some((item) => (item.cifPrice || 0) > 0 || item.cifPortOfDestination?.trim());
        return hasCif ? "cif" : null;
    });
    const includeFobPricing = selectedCommercialTerm === "fob";
    const includeCifPricing = selectedCommercialTerm === "cif";
    const hasSelectedCommercialTerm = includeFobPricing || includeCifPricing;
    const requiresCurrency = !isZeroKm || includeFobPricing || includeCifPricing;
    const usedCarCommercialTerm = usedCarVehicle?.incoterm === Incoterm.FOB ? "fob" : usedCarVehicle?.incoterm === Incoterm.CIF ? "cif" : selectedCommercialTerm;

    const updateZeroKmCommercialField = (index: number, field: "fobPrice" | "cifPrice" | "fobPortOfLoading" | "cifPortOfDestination", rawValue: string) => {
        const vehicles = [...(formState.vehicles || [])];
        const current = vehicles[index];
        if (!current) return;

        const updated = {
            ...current,
            [field]: field === "fobPrice" || field === "cifPrice" ? (rawValue === "" ? undefined : Number(rawValue)) : rawValue,
        };

        if ((updated.fobPrice || 0) > 0) {
            updated.incoterm = Incoterm.FOB;
            updated.unitPrice = updated.fobPrice;
        } else if ((updated.cifPrice || 0) > 0) {
            updated.incoterm = Incoterm.CIF;
            updated.unitPrice = updated.cifPrice;
        } else {
            updated.incoterm = undefined;
            updated.unitPrice = undefined;
        }

        vehicles[index] = updated;
        updateVehicleField(vehicles);
    };

    const updateSharedPortField = (field: "fobPortOfLoading" | "cifPortOfDestination", rawValue: string) => {
        const vehicles = [...(formState.vehicles || [])].map((vehicle) => ({
            ...vehicle,
            [field]: rawValue,
        }));
        updateVehicleField(vehicles);
    };

    const applySamePriceToAllColors = (field: "fobPrice" | "cifPrice", rawValue: string) => {
        const nextValue = rawValue === "" ? undefined : Number(rawValue);
        const vehicles = [...(formState.vehicles || [])].map((vehicle) => {
            const updated = {
                ...vehicle,
                [field]: nextValue,
            };

            if ((updated.fobPrice || 0) > 0) {
                updated.incoterm = Incoterm.FOB;
                updated.unitPrice = updated.fobPrice;
            } else if ((updated.cifPrice || 0) > 0) {
                updated.incoterm = Incoterm.CIF;
                updated.unitPrice = updated.cifPrice;
            } else {
                updated.incoterm = undefined;
                updated.unitPrice = undefined;
            }

            return updated;
        });

        updateVehicleField(vehicles);
    };

    const toggleCommercialSection = (type: "fob" | "cif") => {
        const nextSelectedTerm = selectedCommercialTerm === type ? null : type;
        setSelectedCommercialTerm(nextSelectedTerm);

        if (nextSelectedTerm !== "fob") {
            setSameFobPrice("");
        }

        if (nextSelectedTerm !== "cif") {
            setSameCifPrice("");
        }

        const vehicles = [...(formState.vehicles || [])].map((vehicle) => {
            if (nextSelectedTerm === "fob") {
                return {
                    ...vehicle,
                    cifPrice: undefined,
                    cifPortOfDestination: "",
                    incoterm: (vehicle.fobPrice || 0) > 0 ? Incoterm.FOB : undefined,
                    unitPrice: vehicle.fobPrice || undefined,
                };
            }

            if (nextSelectedTerm === "cif") {
                return {
                    ...vehicle,
                    fobPrice: undefined,
                    fobPortOfLoading: "",
                    incoterm: (vehicle.cifPrice || 0) > 0 ? Incoterm.CIF : undefined,
                    unitPrice: vehicle.cifPrice || undefined,
                };
            }

            return {
                ...vehicle,
                fobPrice: undefined,
                fobPortOfLoading: "",
                cifPrice: undefined,
                cifPortOfDestination: "",
                incoterm: undefined,
                unitPrice: undefined,
            };
        });

        updateVehicleField(vehicles);
    };

    const updateUsedCarCommercialTerm = (term: "fob" | "cif") => {
        setSelectedCommercialTerm(term);
        const vehicle = usedCarVehicle || {};
        const updatedVehicle =
            term === "fob"
                ? {
                      ...vehicle,
                      incoterm: Incoterm.FOB,
                      cifPrice: undefined,
                      cifPortOfDestination: "",
                      unitPrice: vehicle.fobPrice || undefined,
                  }
                : {
                      ...vehicle,
                      incoterm: Incoterm.CIF,
                      fobPrice: undefined,
                      fobPortOfLoading: "",
                      unitPrice: vehicle.cifPrice || undefined,
                  };

        updateVehicleField([updatedVehicle]);
        updateFormField("price", String(updatedVehicle.unitPrice || ""));
    };

    const updateUsedCarCommercialField = (field: "fobPrice" | "cifPrice" | "fobPortOfLoading" | "cifPortOfDestination", rawValue: string) => {
        const vehicle = usedCarVehicle || {};
        const updatedVehicle = {
            ...vehicle,
            [field]: field === "fobPrice" || field === "cifPrice" ? (rawValue === "" ? undefined : Number(rawValue)) : rawValue,
        };

        if ((updatedVehicle.fobPrice || 0) > 0) {
            updatedVehicle.incoterm = Incoterm.FOB;
            updatedVehicle.unitPrice = updatedVehicle.fobPrice;
            updateFormField("price", String(updatedVehicle.fobPrice));
        } else if ((updatedVehicle.cifPrice || 0) > 0) {
            updatedVehicle.incoterm = Incoterm.CIF;
            updatedVehicle.unitPrice = updatedVehicle.cifPrice;
            updateFormField("price", String(updatedVehicle.cifPrice));
        } else {
            updatedVehicle.unitPrice = undefined;
            updateFormField("price", "");
        }

        updateVehicleField([updatedVehicle]);
    };

    return (
        <div>
            <div className="border rounded-xl p-4 mb-6 border-stroke-light">
                <h3 className="text-brand-blue mb-4">Pricing Information</h3>
                {isZeroKm ? (
                    <p className="text-xs text-muted-foreground mb-3">
                        For Zero KM listings, choose which commercial terms you want to offer, then enter the relevant unit price and port details below.
                    </p>
                ) : null}
                <div className={`grid grid-cols-1 ${isZeroKm ? "md:grid-cols-1" : "md:grid-cols-2"} gap-4`}>
                    {!isZeroKm ? (
                        <Select
                            label="Incoterm"
                            required
                            options={[
                                { value: "fob", label: "FOB" },
                                { value: "cif", label: "CIF" },
                            ]}
                            name="incoterm"
                            value={usedCarCommercialTerm || ""}
                            onChange={(value) => updateUsedCarCommercialTerm(value as "fob" | "cif")}
                            placeholder="Select incoterm"
                            border="bg-input-background"
                            labelCls="text-sm font-medium"
                            errors={errors?.properties?.vehicles?.items?.[0]?.properties?.incoterm?.errors}
                        />
                    ) : null}
                    <Select
                        label="Currency"
                        required={requiresCurrency}
                        options={(filterData?.currency as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        name="currency"
                        value={formState.currency || ""}
                        onChange={(value) => updateFormField("currency", value)}
                        placeholder="Select currency"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                        errors={errors?.properties?.currency?.errors}
                    />
                </div>
                {!isZeroKm ? (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {usedCarCommercialTerm === "fob" ? (
                            <>
                                <Input
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.fobPrice?.errors || errors?.properties?.price?.errors}
                                    label="FOB Price"
                                    type="number"
                                    name="fobPrice"
                                    value={usedCarVehicle?.fobPrice || ""}
                                    onChange={(e) => updateUsedCarCommercialField("fobPrice", e.target.value)}
                                    placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                    required
                                />
                                <Input
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.fobPortOfLoading?.errors}
                                    label="Port of Loading"
                                    type="text"
                                    name="fobPortOfLoading"
                                    value={usedCarVehicle?.fobPortOfLoading || ""}
                                    onChange={(e) => updateUsedCarCommercialField("fobPortOfLoading", e.target.value)}
                                    placeholder="e.g., Shanghai, Ningbo"
                                    required
                                />
                            </>
                        ) : null}
                        {usedCarCommercialTerm === "cif" ? (
                            <>
                                <Input
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.cifPrice?.errors || errors?.properties?.price?.errors}
                                    label="CIF Price"
                                    type="number"
                                    name="cifPrice"
                                    value={usedCarVehicle?.cifPrice || ""}
                                    onChange={(e) => updateUsedCarCommercialField("cifPrice", e.target.value)}
                                    placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                    required
                                />
                                <Input
                                    errors={errors?.properties?.vehicles?.items?.[0]?.properties?.cifPortOfDestination?.errors}
                                    label="Port of Destination"
                                    type="text"
                                    name="cifPortOfDestination"
                                    value={usedCarVehicle?.cifPortOfDestination || ""}
                                    onChange={(e) => updateUsedCarCommercialField("cifPortOfDestination", e.target.value)}
                                    placeholder="e.g., Jebel Ali, Sohar"
                                    required
                                />
                            </>
                        ) : null}
                    </div>
                ) : null}
                {isZeroKm && zeroKmPricingRows.length > 0 ? (
                    <>
                        <div className="border-t border-stroke-light my-6" />
                        <div className="mb-6 rounded-xl border border-stroke-light p-4 bg-white">
                            <h4 className="text-brand-blue mb-3">Commercial Terms</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="inline-flex cursor-pointer items-center gap-4">
                                    <div className="relative">
                                        <input type="checkbox" checked={includeFobPricing} onChange={() => toggleCommercialSection("fob")} className="peer sr-only" />
                                        <div className="h-4.5 w-8 rounded-full bg-gray-300 peer-checked:bg-brand-blue transition-colors duration-300" />
                                        <div className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-3.5" />
                                    </div>
                                    <div className="text-sm text-gray-800">Include FOB</div>
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-4">
                                    <div className="relative">
                                        <input type="checkbox" checked={includeCifPricing} onChange={() => toggleCommercialSection("cif")} className="peer sr-only" />
                                        <div className="h-4.5 w-8 rounded-full bg-gray-300 peer-checked:bg-brand-blue transition-colors duration-300" />
                                        <div className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-3.5" />
                                    </div>
                                    <div className="text-sm text-gray-800">Include CIF</div>
                                </label>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">Select only one commercial term for zero-km listings.</p>
                        </div>
                        {zeroKmPricingRows.length > 1 ? (
                            <div className="mb-6 rounded-xl border border-stroke-light p-4 bg-white">
                                <h4 className="text-brand-blue mb-3">Same Price For All Colors</h4>
                                <label className={`inline-flex items-center gap-4 mb-4 ${hasSelectedCommercialTerm ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            name="useSamePriceForAllColors"
                                            checked={useSamePriceForAllColors}
                                            disabled={!hasSelectedCommercialTerm}
                                            onChange={() =>
                                                setUseSamePriceForAllColors((prev) => {
                                                    const next = !prev;
                                                    if (next) {
                                                        setSameFobPrice(allFobPricesSame && zeroKmPricingRows[0]?.fobPrice ? String(zeroKmPricingRows[0].fobPrice) : "");
                                                        setSameCifPrice(allCifPricesSame && zeroKmPricingRows[0]?.cifPrice ? String(zeroKmPricingRows[0].cifPrice) : "");
                                                    }
                                                    return next;
                                                })
                                            }
                                            className="peer sr-only"
                                        />
                                        <div className="h-4.5 w-8 rounded-full bg-gray-300 peer-checked:bg-brand-blue transition-colors duration-300" />
                                        <div className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all duration-300 peer-checked:translate-x-3.5" />
                                    </div>
                                    <div className="text-sm text-gray-800">Use the same FOB/CIF price for every added color</div>
                                </label>
                                {!hasSelectedCommercialTerm ? (
                                    <p className="text-xs text-muted-foreground">Select FOB or CIF first to enable shared pricing across colors.</p>
                                ) : null}
                                {hasSelectedCommercialTerm && useSamePriceForAllColors ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {includeFobPricing ? (
                                            <Input
                                                label="Shared FOB Unit Price"
                                                type="number"
                                                name="sameFobPrice"
                                                value={sameFobPrice}
                                                onChange={(e) => {
                                                    setSameFobPrice(e.target.value);
                                                    applySamePriceToAllColors("fobPrice", e.target.value);
                                                }}
                                                placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                            />
                                        ) : null}
                                        {includeCifPricing ? (
                                            <Input
                                                label="Shared CIF Unit Price"
                                                type="number"
                                                name="sameCifPrice"
                                                value={sameCifPrice}
                                                onChange={(e) => {
                                                    setSameCifPrice(e.target.value);
                                                    applySamePriceToAllColors("cifPrice", e.target.value);
                                                }}
                                                placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                            />
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        {!useSamePriceForAllColors ? (
                            <div>
                                <h4 className="text-brand-blue mb-3">Color Pricing Summary</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {zeroKmPricingRows.map((row) => (
                                        <div key={row.id} className="rounded-xl border border-stroke-light p-4 bg-white">
                                            <div className="flex items-center justify-between gap-3 mb-2">
                                                <span className="text-sm font-medium text-gray-900">{row.color}</span>
                                                <span className="text-xs text-muted-foreground">Qty: {row.quantity || "Not set"}</span>
                                            </div>
                                            <div className="space-y-3 text-sm text-gray-700">
                                                {includeFobPricing ? (
                                                    <Input
                                                        label="FOB Unit Price"
                                                        type="number"
                                                        name={`fobPrice-${row.index}`}
                                                        value={row.fobPrice || ""}
                                                        onChange={(e) => updateZeroKmCommercialField(row.index, "fobPrice", e.target.value)}
                                                        placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                                        errors={errors?.properties?.vehicles?.items?.[row.index]?.properties?.fobPrice?.errors}
                                                    />
                                                ) : null}
                                                {includeCifPricing ? (
                                                    <Input
                                                        label="CIF Unit Price"
                                                        type="number"
                                                        name={`cifPrice-${row.index}`}
                                                        value={row.cifPrice || ""}
                                                        onChange={(e) => updateZeroKmCommercialField(row.index, "cifPrice", e.target.value)}
                                                        placeholder={`e.g., ${formState.currency ? `${formState.currency} amount` : "amount"}`}
                                                        errors={errors?.properties?.vehicles?.items?.[row.index]?.properties?.cifPrice?.errors}
                                                    />
                                                ) : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <div className={`mt-6 ${hasSelectedCommercialTerm ? "" : "opacity-60"}`}>
                            <h4 className="text-brand-blue mb-3">Ports</h4>
                            {!hasSelectedCommercialTerm ? <p className="text-xs text-muted-foreground mb-3">Select FOB or CIF first to enter port details.</p> : null}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {includeFobPricing ? (
                                    <Input
                                        label="Port of Loading"
                                        type="text"
                                        name="sharedFobPortOfLoading"
                                        value={sharedFobPort}
                                        disabled={!hasSelectedCommercialTerm}
                                        onChange={(e) => updateSharedPortField("fobPortOfLoading", e.target.value)}
                                        placeholder="e.g., Shanghai, Ningbo"
                                        errors={
                                            errors?.properties?.vehicles?.items
                                                ?.flatMap((item) => item?.properties?.fobPortOfLoading?.errors || [])
                                                .filter(Boolean)
                                        }
                                    />
                                ) : null}
                                {includeCifPricing ? (
                                    <Input
                                        label="Port of Destination"
                                        type="text"
                                        name="sharedCifPortOfDestination"
                                        value={sharedCifPort}
                                        disabled={!hasSelectedCommercialTerm}
                                        onChange={(e) => updateSharedPortField("cifPortOfDestination", e.target.value)}
                                        placeholder="e.g., Jebel Ali, Sohar"
                                        errors={
                                            errors?.properties?.vehicles?.items
                                                ?.flatMap((item) => item?.properties?.cifPortOfDestination?.errors || [])
                                                .filter(Boolean)
                                        }
                                    />
                                ) : null}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
            <div className="pt-6 border-t border-stroke-light">
                <div className="flex space-x-3 justify-end">
                    <Button type="button" className="me-auto" variant="ghost" leftIcon={<ArrowLeftIcon className="h-3.5 w-3.5" />} onClick={() => setStep((prev) => prev - 1)}>
                        Previous
                    </Button>
                    <Button loading={draftLoading} variant="ghost" onClick={handleSaveDraft} type="button" leftIcon={<FileIcon className="h-3.5 w-3.5" />} className="border-brand-blue">
                        Save Draft
                    </Button>
                    <Button type="submit" variant="primary" loading={publishLoading} onClick={() => handleSubmit()}>
                        Publish listing
                    </Button>
                </div>
            </div>
        </div>
    );
}
