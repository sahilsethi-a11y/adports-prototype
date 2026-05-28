import { AlertCircleIcon, AddIcon, ArrowLeftIcon, ArrowRightIcon, CloseIcon, Shield } from "@/components/Icons";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useMemo, useState } from "react";
import type { FormState, VehicleInfo } from "@/components/add-vehicle/VehicleForm";
import Input from "@/elements/Input";
import Button from "@/elements/Button";
import message from "@/elements/message";
import { ZodTreeError } from "@/validation/shared-schema";
import Select from "@/elements/Select";
import { Incoterm } from "@/validation/vehicle-schema";

type PropsT = {
    formState: FormState;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateFormField: (name: Partial<keyof FormState>, value: unknown, errorPath?: (string | number)[]) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: (e: FormEvent) => void;
    errors?: ZodTreeError;
    filterData?: Record<string, unknown>;
};

type NumericVehicleField = "mileage" | "numberOfOwners" | "availableQuantity" | "unitPrice" | "fobPrice" | "cifPrice";
type TextVehicleField = "vin" | "registrationNumber" | "warrantyRemaining" | "inspectionReportUrl" | "color" | "fobPortOfLoading" | "cifPortOfDestination";

const NUMERIC_VEHICLE_FIELDS: NumericVehicleField[] = ["mileage", "numberOfOwners", "availableQuantity", "unitPrice", "fobPrice", "cifPrice"];
const TEXT_VEHICLE_FIELDS: TextVehicleField[] = ["vin", "registrationNumber", "warrantyRemaining", "inspectionReportUrl", "color", "fobPortOfLoading", "cifPortOfDestination"];
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]+$/;

const isNumericVehicleField = (name: string): name is NumericVehicleField => (NUMERIC_VEHICLE_FIELDS as readonly string[]).includes(name);
const isTextVehicleField = (name: string): name is TextVehicleField => (TEXT_VEHICLE_FIELDS as readonly string[]).includes(name);

const createVehicle = (isZeroKm: boolean, defaultColor?: string): VehicleInfo => ({
    mileage: isZeroKm ? undefined : 0,
    vin: "",
    registrationNumber: "",
    numberOfOwners: isZeroKm ? undefined : 0,
    warrantyRemaining: "",
    inspectionReportUrl: "",
    color: defaultColor || "",
    availableQuantity: undefined,
    unitPrice: undefined,
    incoterm: isZeroKm ? undefined : undefined,
    vinList: [""],
    fobPrice: undefined,
    fobPortOfLoading: "",
    cifPrice: undefined,
    cifPortOfDestination: "",
});

const normalizeVin = (value: string) => value.trim().toUpperCase();
const isValidVin = (vin: string) => vin.length === 17 && VIN_REGEX.test(vin);

const syncLegacyPricing = (vehicle: VehicleInfo): VehicleInfo => {
    if ((vehicle.fobPrice || 0) > 0) {
        return { ...vehicle, incoterm: Incoterm.FOB, unitPrice: vehicle.fobPrice };
    }
    if ((vehicle.cifPrice || 0) > 0) {
        return { ...vehicle, incoterm: Incoterm.CIF, unitPrice: vehicle.cifPrice };
    }
    return { ...vehicle, incoterm: undefined, unitPrice: undefined };
};

const normalizeVinListLength = (vehicle: VehicleInfo): VehicleInfo => {
    const quantity = Number(vehicle.availableQuantity);
    if (!quantity || quantity < 1) {
        const currentVinList = vehicle.vinList && vehicle.vinList.length > 0 ? vehicle.vinList : [""];
        return { ...vehicle, vinList: currentVinList, vin: normalizeVin(currentVinList[0] || "") };
    }
    const currentVinList = [...(vehicle.vinList || [])];
    const nextVinList = currentVinList.length < quantity ? [...currentVinList, ...Array.from({ length: quantity - currentVinList.length }, () => "")] : currentVinList.slice(0, quantity);
    return { ...vehicle, vinList: nextVinList, vin: normalizeVin(nextVinList[0] || "") };
};

const parseVinText = (value: string) =>
    value
        .split(/[\s,]+/)
        .map(normalizeVin)
        .filter(Boolean);

const getVinStats = (vinList: string[]) => {
    const seen = new Set<string>();
    let valid = 0;
    let duplicate = 0;
    let invalid = 0;

    for (const vinItem of vinList) {
        const normalized = normalizeVin(vinItem || "");
        if (!normalized) continue;
        if (!isValidVin(normalized)) {
            invalid += 1;
            continue;
        }
        if (seen.has(normalized)) {
            duplicate += 1;
            continue;
        }
        seen.add(normalized);
        valid += 1;
    }

    return { valid, duplicate, invalid };
};

export default function DetailForm({ formState, errors, updateFormField, setStep, handleSubmit, filterData }: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const fetchedMileage = Number(formState.fetchedMileage) || 0;
    const colorOptions = ((filterData?.colors as { label: string; value: string }[]) ?? []).map((c) => ({ label: c.label || c.value, value: c.value }));
    const vehicles = useMemo(() => (formState.vehicles?.length > 0 ? formState.vehicles : [createVehicle(isZeroKm, formState.color || "")]), [formState.color, formState.vehicles, isZeroKm]);

    const [expandedVinSections, setExpandedVinSections] = useState<Record<number, boolean>>({});
    const [vinEntryMode, setVinEntryMode] = useState<Record<number, "paste" | "manual" | null>>({});
    const [vinPasteValues, setVinPasteValues] = useState<Record<number, string>>({});

    const globalZeroKmVinCounts = useMemo(() => {
        const counts = new Map<string, number>();
        if (!isZeroKm) return counts;
        for (const vehicle of vehicles) {
            for (const vinItem of vehicle.vinList || []) {
                const normalized = normalizeVin(vinItem || "");
                if (!normalized) continue;
                counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
            }
        }
        return counts;
    }, [isZeroKm, vehicles]);

    const appendVehicle = () => {
        updateFormField("vehicles", [...vehicles, createVehicle(isZeroKm, formState.color || "")]);
    };

    const updateVehicleAt = (index: number, updater: (vehicle: VehicleInfo) => VehicleInfo, errorPath?: (string | number)[]) => {
        const updatedVehicles = [...vehicles];
        updatedVehicles[index] = updater({ ...updatedVehicles[index] });
        updateFormField("vehicles", updatedVehicles, errorPath);
    };

    const handleVehicleInputChange = (e: ChangeEvent<HTMLInputElement>, id: number) => {
        const { name, value } = e.target;

        updateVehicleAt(
            id,
            (vehicle) => {
                if (isNumericVehicleField(name)) {
                    const nextNumericValue = value === "" ? undefined : Number(value);
                    vehicle[name] = name === "mileage" && !isZeroKm && typeof nextNumericValue === "number" ? Math.max(nextNumericValue, fetchedMileage) : nextNumericValue;
                    if (name === "availableQuantity" && isZeroKm) {
                        vehicle = normalizeVinListLength(vehicle);
                    }
                    if (name === "fobPrice" || name === "cifPrice" || name === "unitPrice") {
                        vehicle = syncLegacyPricing(vehicle);
                    }
                    return vehicle;
                }

                if (isTextVehicleField(name)) {
                    vehicle[name] = value;
                    return vehicle;
                }

                return vehicle;
            },
            ["vehicles", id, name]
        );
    };

    const applyPastedVins = (index: number) => {
        const configuredQuantity = Number(vehicles[index]?.availableQuantity);
        const parsed = parseVinText(vinPasteValues[index] || "");
        const targetLength = configuredQuantity > 0 ? configuredQuantity : Math.max(parsed.length, (vehicles[index]?.vinList || []).length, 1);
        const trimmedToQuantity = parsed.slice(0, targetLength);

        updateVehicleAt(
            index,
            (vehicle) => {
                const nextVinList = Array.from({ length: targetLength }, (_, vinIndex) => trimmedToQuantity[vinIndex] || "");
                return {
                    ...vehicle,
                    vinList: nextVinList,
                    vin: normalizeVin(nextVinList[0] || ""),
                };
            },
            ["vehicles", index, "vinList"]
        );

        setExpandedVinSections((prev) => ({ ...prev, [index]: true }));
        setVinEntryMode((prev) => ({ ...prev, [index]: "paste" }));

        if (configuredQuantity > 0 && parsed.length > targetLength) {
            message.error(`Only the first ${targetLength} VINs were applied for this color configuration.`);
        } else {
            message.success("VINs added");
        }
    };

    const formatMileage = (value?: number) => {
        if (!value || value < 1) return "";
        return `${value.toLocaleString()} kms`;
    };

    return (
        <form onSubmit={handleSubmit} noValidate>
            <div className="mb-4 flex items-center gap-4 justify-end">
                <div className="me-auto">
                    <h3 className="text-brand-blue">{isZeroKm ? "Vehicle Specifications" : "Vehicle Details & Specifications"}</h3>
                    <p className="text-sm text-muted-foreground">{isZeroKm ? "Add color-wise configurations with quantity and optional FOB/CIF pricing" : "Add the details for this single used-car listing"}</p>
                </div>
                {isZeroKm ? (
                    <Button type="button" leftIcon={<AddIcon className="h-3.5 w-3.5" />} onClick={appendVehicle} variant="primary">
                        Add Color Config
                    </Button>
                ) : null}
            </div>
            {vehicles.map((item, index) => {
                if (!isZeroKm && index > 0) return null;
                const configuredQuantity = Number(item.availableQuantity);
                const manualVinFieldCount = configuredQuantity > 0 ? configuredQuantity : Math.max((item.vinList || []).length, 1);
                const vinList = (item.vinList || []).slice(0, manualVinFieldCount);
                const vinStats = getVinStats(vinList);
                const filledCount = vinList.filter((vinItem) => normalizeVin(vinItem || "")).length;
                const isVinExpanded = !!expandedVinSections[index];
                const currentVinMode = vinEntryMode[index];
                const mileageValue = Number(item.mileage) || 0;
                const isMileageBelowFetched = !isZeroKm && fetchedMileage > 0 && mileageValue > 0 && mileageValue < fetchedMileage;

                return (
                    <div key={item.id || index} className="border rounded-xl p-4 mb-6 border-stroke-light">
                        <div className="flex items-center justify-between">
                            <h3 className="text-brand-blue mb-4">{isZeroKm ? `Vehicle #${index + 1}` : "Vehicle Detail"}</h3>
                            {isZeroKm && index > 0 && (
                                <div className="mb-4 text-right">
                                    <Button
                                        onClick={() => {
                                            const newVehicles = vehicles.filter((_, i) => i !== index);
                                            updateFormField("vehicles", newVehicles, ["vehicles", index]);
                                        }}
                                        variant="danger"
                                        type="button"
                                        className="bg-transparent hover:bg-destructive/10 text-destructive"
                                        leftIcon={<CloseIcon />}>
                                        Remove Vehicle
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {isZeroKm ? (
                                <>
                                    <Select
                                        label="Color"
                                        required
                                        name="color"
                                        options={colorOptions}
                                        value={item.color || ""}
                                        onChange={(value) => {
                                            updateVehicleAt(index, (vehicle) => ({ ...vehicle, color: value }), ["vehicles", index, "color"]);
                                        }}
                                        placeholder="Select color"
                                        border="bg-input-background"
                                        labelCls="text-sm font-medium"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.color?.errors}
                                    />
                                            <Input
                                                label="Available Quantity (Optional)"
                                                type="number"
                                                name="availableQuantity"
                                                errors={errors?.properties?.vehicles?.items?.[index]?.properties?.availableQuantity?.errors}
                                                value={item.availableQuantity || ""}
                                                onChange={(e) => handleVehicleInputChange(e, index)}
                                                placeholder="e.g., 25"
                                            />
                                </>
                            ) : (
                                <>
                                    <Input
                                        label="Condition"
                                        required
                                        type="text"
                                        name="condition"
                                        value={formState.condition || ""}
                                        readOnly
                                        className="text-black"
                                        placeholder="Grade C - Fair"
                                    />
                                    <Input
                                        label="Mileage"
                                        type="text"
                                        name="mileage"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.mileage?.errors}
                                        value={formatMileage(item.mileage)}
                                        onChange={(e) => {
                                            const digitsOnly = e.target.value.replace(/[^\d]/g, "");
                                            const nextMileage = digitsOnly ? Number(digitsOnly) : undefined;
                                            updateVehicleAt(
                                                index,
                                                (vehicle) => ({
                                                    ...vehicle,
                                                    mileage: nextMileage,
                                                }),
                                                ["vehicles", index, "mileage"]
                                            );
                                        }}
                                        className="text-gray-900"
                                        placeholder="55,000 kms"
                                        required
                                    />
                                </>
                            )}
                            {!isZeroKm ? (
                                <Input
                                    label="VIN"
                                    type="text"
                                    name="vin"
                                    errors={errors?.properties?.vehicles?.items?.[index]?.properties?.vin?.errors}
                                    value={item.vin || formState.vin || ""}
                                    disabled
                                    className="text-gray-900 disabled:text-gray-900 disabled:opacity-100"
                                    placeholder="17-character VIN"
                                    required
                                />
                            ) : null}
                            {!isZeroKm ? (
                                <>
                                    <Input
                                        required
                                        label="Number of Owners"
                                        type="number"
                                        name="numberOfOwners"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.numberOfOwners?.errors}
                                        value={item.numberOfOwners || ""}
                                        onChange={(e) => handleVehicleInputChange(e, index)}
                                        placeholder="eg. 2"
                                    />
                                    <Input
                                        label="Warranty Remaining"
                                        type="text"
                                        name="warrantyRemaining"
                                        errors={errors?.properties?.vehicles?.items?.[index]?.properties?.warrantyRemaining?.errors}
                                        value={item.warrantyRemaining || ""}
                                        onChange={(e) => handleVehicleInputChange(e, index)}
                                        placeholder="e.g., 2 years, Expired"
                                    />
                                </>
                            ) : null}
                        </div>
                        {isMileageBelowFetched ? (
                            <p className="mt-3 text-xs text-amber-700">Entered mileage is lower than the fetched Chaboschi mileage of {fetchedMileage.toLocaleString()} kms.</p>
                        ) : null}
                        {!isZeroKm && fetchedMileage > 0 ? <p className="mt-3 text-xs text-muted-foreground">Fetched mileage: {fetchedMileage.toLocaleString()} kms. You can only increase this value.</p> : null}

                        {isZeroKm ? (
                            <>
                                <div className="mt-6 rounded-xl border border-stroke-light p-4">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h4 className="text-sm font-medium text-brand-blue">VINs added: {filledCount} / {configuredQuantity > 0 ? configuredQuantity : "Not set"} (Optional)</h4>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {vinStats.valid} valid, {vinStats.duplicate} duplicate, {vinStats.invalid} invalid
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="border-brand-blue"
                                                onClick={() => {
                                                    setExpandedVinSections((prev) => ({ ...prev, [index]: true }));
                                                    setVinEntryMode((prev) => ({ ...prev, [index]: "paste" }));
                                                }}>
                                                Paste VINs
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="border-brand-blue"
                                                onClick={() => {
                                                    setExpandedVinSections((prev) => ({ ...prev, [index]: true }));
                                                    setVinEntryMode((prev) => ({ ...prev, [index]: "manual" }));
                                                }}>
                                                Add one by one
                                            </Button>
                                            {isVinExpanded ? (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setExpandedVinSections((prev) => ({ ...prev, [index]: false }));
                                                        setVinEntryMode((prev) => ({ ...prev, [index]: null }));
                                                    }}>
                                                    Collapse
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>

                                    {isVinExpanded && currentVinMode === "paste" ? (
                                        <div className="mt-4 grid gap-4">
                                            <Input
                                                label="Paste VINs"
                                                type="textarea"
                                                rows={5}
                                                value={vinPasteValues[index] || ""}
                                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setVinPasteValues((prev) => ({ ...prev, [index]: e.target.value }))}
                                                placeholder="Paste one VIN per line, or separate by comma / space"
                                            />
                                            <div className="flex items-center gap-2">
                                                <Button type="button" variant="primary" onClick={() => applyPastedVins(index)}>
                                                    Apply VINs
                                                </Button>
                                                <span className="text-xs text-muted-foreground">Extra VINs beyond quantity are ignored.</span>
                                            </div>
                                        </div>
                                    ) : null}

                                    {isVinExpanded && currentVinMode === "manual" ? (
                                        <div className="mt-4">
                                            {configuredQuantity > 0 ? null : (
                                                <div className="mb-3 flex justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        className="border-brand-blue"
                                                        onClick={() => {
                                                            updateVehicleAt(index, (vehicle) => ({
                                                                ...vehicle,
                                                                vinList: [...(vehicle.vinList || []), ""],
                                                            }));
                                                        }}>
                                                        Add VIN Field
                                                    </Button>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {Array.from({ length: manualVinFieldCount }).map((_, vinIndex) => {
                                                const currentVin = vinList[vinIndex] || "";
                                                const normalized = normalizeVin(currentVin);
                                                const isDuplicateAcrossRows = !!normalized && (globalZeroKmVinCounts.get(normalized) ?? 0) > 1;
                                                const manualErrors = [
                                                    ...(errors?.properties?.vehicles?.items?.[index]?.properties?.vinList?.items?.[vinIndex]?.errors || []),
                                                    ...(isDuplicateAcrossRows ? ["This VIN has already been added"] : []),
                                                ];

                                                return (
                                                    <Input
                                                        key={`vin-${index}-${vinIndex}`}
                                                        label={`VIN ${vinIndex + 1}`}
                                                        type="text"
                                                        name={`vinList-${vinIndex}`}
                                                        value={currentVin}
                                                        onChange={(e) => {
                                                            updateVehicleAt(
                                                                index,
                                                                (vehicle) => {
                                                                    const nextVinList = [...(vehicle.vinList || Array.from({ length: manualVinFieldCount }, () => ""))];
                                                                    nextVinList[vinIndex] = normalizeVin(e.target.value);
                                                                    return {
                                                                        ...vehicle,
                                                                        vinList: nextVinList,
                                                                        vin: normalizeVin(nextVinList[0] || ""),
                                                                    };
                                                                },
                                                                ["vehicles", index, "vinList", vinIndex]
                                                            );
                                                        }}
                                                        placeholder="Optional 17-character VIN"
                                                        errors={manualErrors}
                                                    />
                                                );
                                            })}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </>
                        ) : null}

                        {!isZeroKm ? <div className="border-t border-stroke-light my-6" /> : null}
                        {!isZeroKm && formState.vinLookupStatus === "not_found" ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                <div className="flex items-start gap-2">
                                    <AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <p className="font-medium">No inspection details were retrieved from Chaboschi.</p>
                                        <p className="mt-1 text-xs">Continue with manual entry.</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        {!isZeroKm && formState.vinLookupStatus === "found" && formState.inspectionSummary ? (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Shield className="h-4 w-4" />
                                    Inspection Summary
                                </div>
                                <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_0.9fr]">
                                    <div className="rounded-lg border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-900">Inspection Conclusion</p>
                                        <div className="mt-3 space-y-2">
                                            {formState.inspectionSummary.split("\n").filter(Boolean).map((line) => (
                                                <div key={line} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                                                    {line}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                                        <p className="font-semibold text-slate-900">Inspection Metadata</p>
                                        <p className="mt-3"><span className="font-medium">Inspection Provider:</span> {formState.inspectionProvider}</p>
                                        <p className="mt-2"><span className="font-medium">Inspection Date:</span> {formState.inspectionDateNote}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
                                        <p className="text-sm font-semibold text-slate-900">Vehicle Description</p>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">{formState.vehicleDescription}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}
            <div className="pt-6 border-t border-stroke-light">
                <div className="flex space-x-3 justify-between">
                    <button
                        onClick={() => setStep((prev) => prev - 1)}
                        type="button"
                        className="justify-center gap-2 whitespace-nowrap text-brand-blue border-stroke-light rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] border bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 flex items-center">
                        <ArrowLeftIcon className="h-3.5 w-3.5" />
                        Previous
                    </button>
                    <button
                        type="submit"
                        className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white disabled:cursor-not-allowed">
                        Next
                        <ArrowRightIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </form>
    );
}
