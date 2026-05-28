"use client";

import { AlertCircleIcon, ArrowRightIcon, CheckCircleIcon, SearchIcon } from "@/components/Icons";
import Select, { type Option } from "@/elements/Select";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import { getCities, getModals, getVariants, type Model, type Variant, type Brand } from "@/lib/data";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useEffect, useState } from "react";
import Input from "@/elements/Input";
import { ZodTreeError } from "@/validation/shared-schema";
import Button from "@/elements/Button";
import message from "@/elements/message";
import { lookupVinOnChaboschi } from "@/lib/chaboschi";

type PropsT = {
    brands?: Brand[];
    formState: FormState;
    updateFormField: (name: Partial<keyof FormState>, value: unknown) => void;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    filterData?: Record<string, unknown>;
    setStep: Dispatch<SetStateAction<number>>;
    errors?: ZodTreeError;
    handleSubmit: (e: FormEvent) => void;
};

export default function BasicInfoForm({ brands, formState, errors, updateFormField, handleInputChange, filterData, handleSubmit }: Readonly<PropsT>) {
    const [modals, setModals] = useState<Model[]>();
    const [variants, setVariants] = useState<Variant[]>();
    const [cities, setCities] = useState<Option[]>();
    const [isManualVariant, setIsManualVariant] = useState(false);
    const isZeroKm = formState.marketType === "zero_km";
    const [isValidating, setIsValidating] = useState(false);
    const [vinLookupLoading, setVinLookupLoading] = useState(false);

    useEffect(() => {
        if (!formState.brand) return;

        const fetchModels = async (brand: string) => {
            try {
                const res = await getModals(brand);
                setModals(res.data);
            } catch {
                console.log("error fetching models");
            }
        };
        fetchModels(formState.brand);
    }, [formState.brand]);

    useEffect(() => {
        if (!formState.model || isManualVariant) return;
        const fetchVariants = async (model: string) => {
            try {
                const res = await getVariants(model);
                setVariants(res.data);
            } catch {
                console.log("error fetching variants");
            }
        };

        fetchVariants(formState.model);
    }, [formState.model, isManualVariant]);

    useEffect(() => {
        if (!formState.country) return;
        const fetchCities = async (countryCode: string) => {
            try {
                const resCities = await getCities(countryCode);
                const options = resCities?.data?.map((city: { id: string; name: string }) => ({
                    label: city.name,
                    value: city.name,
                    extra: city.id,
                }));
                setCities(options);
            } catch (error) {
                console.error("Failed to fetch emirates:", error);
            }
        };
        fetchCities(formState.country);
    }, [formState.country]);

    const handleValidateJato = async () => {
        if (!formState.brand || !formState.model || !formState.variant || !formState.year) {
            message.error("Select make, model, variant and year before validation.");
            return;
        }
        setIsValidating(true);
        await new Promise((resolve) => setTimeout(resolve, 700));

        const modelName = String(formState.model || "").toLowerCase();
        const isSuv = ["patrol", "sportage", "tucson", "song", "q5", "x5", "land cruiser", "rav4"].some((k) => modelName.includes(k));

        const autoloaded = {
            bodyType: isSuv ? "SUV" : "Sedan",
            fuelType: "Petrol",
            transmission: "Automatic",
            drivetrain: isSuv ? "AWD" : "FWD",
            engineSize: isSuv ? "2.5L" : "2.0L",
            cylinders: isSuv ? "6" : "4",
            horsepower: isSuv ? "240" : "180",
            seatingCapacity: isSuv ? "7" : "5",
            numberOfDoors: isSuv ? "5" : "4",
            description: `${formState.year} ${formState.brand} ${formState.model} ${formState.variant}. Autoloaded prototype specs from JATO validation for listing setup.`,
        };

        updateFormField("bodyType", autoloaded.bodyType);
        updateFormField("fuelType", autoloaded.fuelType);
        updateFormField("transmission", autoloaded.transmission);
        updateFormField("drivetrain", autoloaded.drivetrain);
        updateFormField("engineSize", autoloaded.engineSize);
        updateFormField("cylinders", autoloaded.cylinders);
        updateFormField("horsepower", autoloaded.horsepower);
        updateFormField("seatingCapacity", autoloaded.seatingCapacity);
        updateFormField("numberOfDoors", autoloaded.numberOfDoors);
        updateFormField("description", autoloaded.description);

        message.success(`Validated and autoloaded ${isZeroKm ? "Zero KM" : "Second-Hand"} listing specs (prototype mock).`);
        setIsValidating(false);
    };

    const canLookupVin = !isZeroKm && !!formState.vin && !!formState.brand && !!formState.model && !!formState.variant && !!formState.year && !!formState.regionalSpecs;
    const isEngineSectionLocked = !isZeroKm && formState.vinLookupStatus !== "found";

    const handleVinLookup = async () => {
        if (!canLookupVin) {
            message.error("Add VIN, make, model, variant, year, and regional specs before VIN Lookup.");
            return;
        }

        setVinLookupLoading(true);

        try {
            const vin = String(formState.vin || "").trim().toUpperCase();
            const result = await lookupVinOnChaboschi(vin, "found");

            updateFormField("vinLookupProvider", result.provider);

            if (result.status === "not_found") {
                updateFormField("vinLookupStatus", "not_found");
                updateFormField("vinLookupMessage", result.warning);
                updateFormField("inspectionSummary", "");
                updateFormField("inspectionProvider", "");
                updateFormField("inspectionDateNote", "");
                updateFormField("vehicleDescription", "");
                updateFormField("fetchedMileage", undefined);
                updateFormField("imageUrls", []);
                updateFormField("mainImageUrl", "");
                updateFormField("vehicles", [
                    {
                        ...(formState.vehicles?.[0] || {}),
                        vin,
                        mileage: formState.vehicles?.[0]?.mileage,
                        inspectionReportUrl: "",
                    },
                ]);
                message.info(result.warning);
                return;
            }

            updateFormField("vinLookupStatus", "found");
            updateFormField("vinLookupMessage", "VIN found on Chaboschi. The entered vehicle details have been approved and the inspection report and images were fetched.");
            updateFormField("brand", result.make);
            updateFormField("model", result.model);
            updateFormField("variant", result.variant);
            updateFormField("year", result.year);
            updateFormField("inspectionSummary", result.inspectionSummary);
            updateFormField("inspectionProvider", result.inspectionProvider);
            updateFormField("inspectionDateNote", result.inspectionDateNote);
            updateFormField("vehicleDescription", result.vehicleDescription);
            updateFormField("fetchedMileage", result.mileage);
            updateFormField("condition", result.condition);
            updateFormField("imageUrls", result.imageUrls);
            updateFormField("mainImageUrl", result.imageUrls[0] || "");
            updateFormField("vehicles", [
                {
                    mileage: Math.max(Number(formState.vehicles?.[0]?.mileage) || 0, result.mileage),
                    vin,
                    registrationNumber: formState.vehicles?.[0]?.registrationNumber || "",
                    numberOfOwners: formState.vehicles?.[0]?.numberOfOwners || 0,
                    warrantyRemaining: formState.vehicles?.[0]?.warrantyRemaining || "",
                    inspectionReportUrl: "",
                    color: formState.vehicles?.[0]?.color || formState.color || "",
                    availableQuantity: formState.vehicles?.[0]?.availableQuantity,
                    unitPrice: formState.vehicles?.[0]?.unitPrice,
                    incoterm: formState.vehicles?.[0]?.incoterm,
                    vinList: formState.vehicles?.[0]?.vinList || [vin],
                    fobPrice: formState.vehicles?.[0]?.fobPrice,
                    fobPortOfLoading: formState.vehicles?.[0]?.fobPortOfLoading || "",
                    cifPrice: formState.vehicles?.[0]?.cifPrice,
                    cifPortOfDestination: formState.vehicles?.[0]?.cifPortOfDestination || "",
                },
            ]);
            message.success("VIN found on Chaboschi. The entered details were approved and the inspection report and images were applied.");
        } finally {
            setVinLookupLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="border rounded-xl p-4 mb-6 border-stroke-light">
                <h2 className="text-brand-blue mb-4">Vehicle Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                        label="Brand"
                        required
                        name="brand"
                        errors={errors?.properties?.brand?.errors}
                        options={brands?.map((brand) => ({
                            value: brand.name,
                            label: brand.name,
                        }))}
                        value={formState.brand}
                        onChange={(value) => {
                            updateFormField("brand", value);
                            updateFormField("model", "");
                            updateFormField("variant", "");
                        }}
                        placeholder="Select Make"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Select
                        label="Model"
                        name="model"
                        required={true}
                        errors={errors?.properties?.model?.errors}
                        options={modals?.map((model) => ({
                            value: model.modelName,
                            label: model.modelName,
                        }))}
                        value={formState.model}
                        onChange={(value) => {
                            updateFormField("model", value);
                            updateFormField("variant", "");
                        }}
                        placeholder="Select Model"
                        noDataMessage="Select model found"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <div>
                        {isManualVariant ? (
                            <Input
                                label={
                                    <span className="flex items-center justify-between gap-3">
                                        <span>
                                            Variant <span className="text-destructive">*</span>
                                        </span>
                                        <button type="button" className="text-xs font-normal text-brand-blue underline underline-offset-2" onClick={() => setIsManualVariant(false)}>
                                            Use dropdown
                                        </button>
                                    </span>
                                }
                                type="text"
                                name="variant"
                                errors={errors?.properties?.variant?.errors}
                                value={formState.variant || ""}
                                onChange={handleInputChange}
                                placeholder="Enter variant"
                            />
                        ) : (
                            <>
                                <Select
                                    label="Variant"
                                    required
                                    name="variant"
                                    errors={errors?.properties?.variant?.errors}
                                    options={variants?.map((variant) => ({
                                        value: variant.variantName,
                                        label: variant.variantName,
                                    }))}
                                    value={formState.variant}
                                    onChange={(value) => updateFormField("variant", value)}
                                    placeholder="Select Variant"
                                    noDataMessage="No variant found"
                                    border="bg-input-background"
                                    labelCls="text-sm font-medium"
                                />
                                <div className="mt-1 text-right">
                                    <button type="button" className="text-xs text-brand-blue underline underline-offset-2" onClick={() => setIsManualVariant(true)}>
                                        Enter manually
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <Input label="Year" type="number" name="year" errors={errors?.properties?.year?.errors} value={formState.year || ""} onChange={handleInputChange} placeholder="2023" required />
                    <Select
                        label="Regional Specs"
                        required
                        name="regionalSpecs"
                        errors={errors?.properties?.regionalSpecs?.errors}
                        options={(filterData?.regionalSpecsOptions as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        value={formState.regionalSpecs}
                        onChange={(value) => updateFormField("regionalSpecs", value)}
                        placeholder="Select regional specs"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    {!isZeroKm ? (
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
                    ) : null}
                    {!isZeroKm ? (
                        <fieldset className="md:col-span-2">
                            <legend className="text-sm font-medium mb-2">Color</legend>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                                {(filterData?.colors as { label: string; value: string; hex: string }[])?.map((color) => (
                                    <label
                                        key={color.value}
                                        className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all hover:shadow-sm ${
                                            formState.color === color.value ? "border-brand-blue bg-blue-50" : "border-gray-200 hover:border-gray-300"
                                        }`}>
                                        <div className="w-9 h-9 rounded-full border border-gray-300 shrink-0 " style={{ backgroundColor: color.hex }} aria-hidden="true" />
                                        <input type="radio" name="color" value={color.value} onChange={handleInputChange} hidden />
                                        <span className="text-xs/4.5 flex-1">{color.value}</span>
                                    </label>
                                ))}
                            </div>
                            {errors?.properties?.color?.errors?.map((err: string) => (
                                <span key={err} className="text-xs text-destructive mt-1 block">
                                    {err}
                                </span>
                            ))}
                        </fieldset>
                    ) : null}
                    <Select
                        label="Country"
                        required
                        name="country"
                        errors={errors?.properties?.country?.errors}
                        options={(filterData?.country as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        value={formState.country}
                        onChange={(value) => updateFormField("country", value)}
                        placeholder="e.g. UAE"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Select
                        label="City"
                        name="city"
                        required
                        errors={errors?.properties?.city?.errors}
                        options={cities?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        value={formState.city}
                        onChange={(value) => updateFormField("city", value)}
                        placeholder="e.g. Dubai"
                        border="bg-input-background"
                        noDataMessage="Select country first"
                        labelCls="text-sm font-medium"
                    />
                </div>
                {!isZeroKm ? (
                    <div className="mt-5 rounded-xl border border-stroke-light bg-slate-50 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-brand-blue">VIN Lookup</h3>
                                <p className="mt-1 text-xs text-muted-foreground">Fetches inspection report and other vehicle details from Chaboschi.</p>
                            </div>
                            <div className="flex flex-nowrap gap-2 overflow-x-auto">
                                <Button type="button" variant="outline" loading={vinLookupLoading} disabled={!canLookupVin} leftIcon={<SearchIcon className="h-4 w-4" />} onClick={handleVinLookup}>
                                    VIN Lookup
                                </Button>
                            </div>
                        </div>
                        {formState.vinLookupStatus === "found" ? (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                                <div className="flex items-start gap-2">
                                    <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">{formState.vinLookupMessage || "VIN found on Chaboschi."}</p>
                                        <p className="mt-1 text-xs">Decoded result: {formState.brand} {formState.model} {formState.variant} {formState.year}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {formState.vinLookupStatus === "not_found" ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">{formState.vinLookupMessage || "VIN not found on Chaboschi."}</p>
                                        <p className="mt-1 text-xs">This is non-blocking. The seller can proceed with manual entry and continue publishing.</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : null}
                <div className="mt-6 mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                        Engine, performance, and description fields below are autoloaded when you click Validate (prototype JATO mock).
                        {isEngineSectionLocked ? " Complete a successful VIN lookup first." : ""}
                    </p>
                    <Button
                        type="button"
                        loading={isValidating}
                        disabled={isEngineSectionLocked}
                        onClick={handleValidateJato}
                        variant="outline"
                        className="border-brand-blue text-brand-blue">
                        Validate
                    </Button>
                </div>
                <div className="border-t border-stroke-light my-6" />
                <div className={isEngineSectionLocked ? "opacity-50" : ""}>
                <h2 className="text-brand-blue mb-4">Engine & Performance</h2>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${isEngineSectionLocked ? "pointer-events-none" : ""}`}>
                    <Select
                        label="Body Type"
                        required
                        name="bodyType"
                        errors={errors?.properties?.bodyType?.errors}
                        options={(filterData?.bodyType as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        value={formState.bodyType}
                        onChange={(value) => updateFormField("bodyType", value)}
                        placeholder="Select body type"
                        disabled={isEngineSectionLocked}
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Select
                        label="Fuel Type"
                        options={(filterData?.fuelTypeOptions as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        name="fuelType"
                        errors={errors?.properties?.fuelType?.errors}
                        value={formState.fuelType}
                        onChange={(value) => updateFormField("fuelType", value)}
                        placeholder="Select fuel type"
                        disabled={isEngineSectionLocked}
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Select
                        label="Transmission"
                        options={(filterData?.transmissionOptions as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        name="transmission"
                        errors={errors?.properties?.transmission?.errors}
                        value={formState.transmission}
                        onChange={(value) => updateFormField("transmission", value)}
                        placeholder="Select transmission"
                        disabled={isEngineSectionLocked}
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Select
                        label="Drivetrain"
                        options={(filterData?.drivetrainOptions as Option[])?.map((item) => ({
                            value: item.value,
                            label: item.label,
                        }))}
                        name="drivetrain"
                        value={formState.drivetrain}
                        errors={errors?.properties?.drivetrain?.errors}
                        onChange={(value) => updateFormField("drivetrain", value)}
                        placeholder="Select Drivetrain"
                        disabled={isEngineSectionLocked}
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                    />
                    <Input
                        label="Engine Size"
                        type="text"
                        name="engineSize"
                        errors={errors?.properties?.engineSize?.errors}
                        value={formState.engineSize || ""}
                        onChange={handleInputChange}
                        disabled={isEngineSectionLocked}
                        placeholder="e.g., 3.0L, 2.5L"
                    />
                    <Input
                        label="Cylinders"
                        type="number"
                        name="cylinders"
                        errors={errors?.properties?.cylinders?.errors}
                        value={formState.cylinders || ""}
                        onChange={handleInputChange}
                        disabled={isEngineSectionLocked}
                        placeholder="e.g., 4, 6, 8"
                    />
                    <Input
                        label="Horsepower(in HP)"
                        type="number"
                        name="horsepower"
                        errors={errors?.properties?.horsepower?.errors}
                        value={formState.horsepower || ""}
                        onChange={handleInputChange}
                        disabled={isEngineSectionLocked}
                        placeholder="e.g., 1200"
                    />
                    <Input
                        label="Seating Capacity"
                        type="number"
                        name="seatingCapacity"
                        errors={errors?.properties?.seatingCapacity?.errors}
                        value={formState.seatingCapacity || ""}
                        onChange={handleInputChange}
                        disabled={isEngineSectionLocked}
                        placeholder="e.g., 5, 7"
                    />
                    <Input
                        label="Number of Doors"
                        type="number"
                        name="numberOfDoors"
                        errors={errors?.properties?.numberOfDoors?.errors}
                        value={formState.numberOfDoors || ""}
                        onChange={handleInputChange}
                        disabled={isEngineSectionLocked}
                        placeholder="e.g., 2, 4, 5"
                    />
                </div>
                <div className="border-t border-stroke-light my-6" />
                <Input
                    type="textarea"
                    label="Description"
                    name="description"
                    rows={3}
                    errors={errors?.properties?.description?.errors}
                    value={formState.description}
                    onChange={handleInputChange}
                    disabled={isEngineSectionLocked}
                    placeholder="Describe your vehicle's condition, history, and any special features..."
                />
                </div>
            </div>
            <div className="flex justify-end items-center pt-6 border-t border-stroke-light">
                <div className="flex space-x-3">
                    <button
                        type="submit"
                        className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50  focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white disabled:cursor-not-allowed">
                        Next
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </form>
    );
}
