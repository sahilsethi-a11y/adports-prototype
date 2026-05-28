"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@/components/Icons";
import { ChangeEvent, Dispatch, SetStateAction } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import Input from "@/elements/Input";
import { ZodTreeError } from "@/validation/shared-schema";
import Select, { type Option } from "@/elements/Select";

type PropsT = {
    formState: FormState;
    handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateFormField: (name: keyof FormState, value: unknown) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    errors?: ZodTreeError;
    filterData?: Record<string, unknown>;
};

const FUEL_TYPES = [
    { label: "Petrol", value: "Petrol" },
    { label: "Diesel", value: "Diesel" },
    { label: "Hybrid", value: "Hybrid" },
    { label: "PHEV (Plug-in Hybrid)", value: "PHEV" },
    { label: "Electric", value: "Electric" },
    { label: "Hydrogen", value: "Hydrogen" },
    { label: "Other", value: "Other" },
];

const TRANSMISSIONS = [
    { label: "Automatic", value: "Automatic" },
    { label: "Manual", value: "Manual" },
    { label: "CVT", value: "CVT" },
    { label: "Semi-Automatic", value: "Semi-Automatic" },
    { label: "Dual-Clutch (DCT)", value: "Dual-Clutch" },
];

const DRIVETRAINS = [
    { label: "FWD – Front-Wheel Drive", value: "FWD" },
    { label: "RWD – Rear-Wheel Drive", value: "RWD" },
    { label: "AWD – All-Wheel Drive", value: "AWD" },
    { label: "4WD – Four-Wheel Drive", value: "4WD" },
    { label: "4x4", value: "4x4" },
];

const needsEngineSize = (fuel: string) => ["Petrol", "Diesel", "Hybrid", "PHEV", "Other"].includes(fuel);
const needsBatterySize = (fuel: string) => ["Hybrid", "PHEV", "Electric"].includes(fuel);
const needsRange = (fuel: string) => fuel === "Electric";

export default function TechSpecsForm({
    formState, errors, updateFormField, handleInputChange, setStep, handleSubmit, filterData,
}: Readonly<PropsT>) {
    const fuel = formState.fuelType || "";

    return (
        <div>
            <div className="rounded-xl border border-stroke-light p-4 mb-6">
                <h2 className="text-brand-blue mb-1">Technical Specifications</h2>
                <p className="text-sm text-muted-foreground mb-5">Fuel type determines which fields are shown below.</p>

                {/* Fuel type — shown first, controls conditional fields */}
                <div className="mb-5">
                    <Select
                        label="Fuel Type"
                        name="fuelType"
                        options={FUEL_TYPES}
                        value={fuel}
                        onChange={(v) => {
                            updateFormField("fuelType", v);
                            // Clear irrelevant fields on fuel change
                            if (!needsEngineSize(v)) updateFormField("engineSize", "");
                            if (!needsBatterySize(v)) updateFormField("batterySize", "");
                            if (!needsRange(v)) updateFormField("electricRange", "");
                        }}
                        placeholder="Select fuel type"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                        errors={errors?.properties?.fuelType?.errors}
                    />
                </div>

                {/* Conditional fields */}
                {fuel && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 p-4 rounded-xl bg-[#f8fafc] border border-stroke-light">
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 md:col-span-2">
                            {fuel} — Powertrain Details
                        </p>
                        {needsEngineSize(fuel) && (
                            <Input
                                label={`Engine Size${fuel === "Other" ? " (optional)" : ""}`}
                                type="text"
                                name="engineSize"
                                value={formState.engineSize || ""}
                                onChange={handleInputChange}
                                placeholder="e.g., 2.0L, 3.5L"
                                errors={errors?.properties?.engineSize?.errors}
                            />
                        )}
                        {needsBatterySize(fuel) && (
                            <Input
                                label="Battery Capacity"
                                type="text"
                                name="batterySize"
                                value={formState.batterySize || ""}
                                onChange={handleInputChange}
                                placeholder="e.g., 15 kWh, 82 kWh"
                                errors={errors?.properties?.batterySize?.errors}
                            />
                        )}
                        {needsRange(fuel) && (
                            <Input
                                label="Electric Range (optional)"
                                type="text"
                                name="electricRange"
                                value={formState.electricRange || ""}
                                onChange={handleInputChange}
                                placeholder="e.g., 450 km WLTP"
                                errors={errors?.properties?.electricRange?.errors}
                            />
                        )}
                    </div>
                )}

                {/* Common drivetrain / performance fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Select
                        label="Transmission"
                        name="transmission"
                        options={(filterData?.transmissionOptions as Option[])?.length
                            ? (filterData?.transmissionOptions as Option[]).map((i) => ({ value: i.value, label: i.label }))
                            : TRANSMISSIONS}
                        value={formState.transmission || ""}
                        onChange={(v) => updateFormField("transmission", v)}
                        placeholder="Select transmission"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                        errors={errors?.properties?.transmission?.errors}
                    />
                    <Select
                        label="Drivetrain"
                        name="drivetrain"
                        options={(filterData?.drivetrainOptions as Option[])?.length
                            ? (filterData?.drivetrainOptions as Option[]).map((i) => ({ value: i.value, label: i.label }))
                            : DRIVETRAINS}
                        value={formState.drivetrain || ""}
                        onChange={(v) => updateFormField("drivetrain", v)}
                        placeholder="Select drivetrain"
                        border="bg-input-background"
                        labelCls="text-sm font-medium"
                        errors={errors?.properties?.drivetrain?.errors}
                    />
                    <Input
                        label="Cylinders (optional)"
                        type="number"
                        name="cylinders"
                        value={formState.cylinders || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 4, 6, 8"
                        errors={errors?.properties?.cylinders?.errors}
                    />
                    <Input
                        label="Horsepower (HP, optional)"
                        type="number"
                        name="horsepower"
                        value={formState.horsepower || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 240"
                        errors={errors?.properties?.horsepower?.errors}
                    />
                    <Input
                        label="Seating Capacity (optional)"
                        type="number"
                        name="seatingCapacity"
                        value={formState.seatingCapacity || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 5, 7"
                        errors={errors?.properties?.seatingCapacity?.errors}
                    />
                    <Input
                        label="Number of Doors (optional)"
                        type="number"
                        name="numberOfDoors"
                        value={formState.numberOfDoors || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 4, 5"
                        errors={errors?.properties?.numberOfDoors?.errors}
                    />
                </div>
            </div>

            {/* Vehicle Dimensions */}
            <div className="rounded-xl border border-stroke-light p-4 mb-6">
                <h3 className="text-brand-blue mb-1">Vehicle Dimensions <span className="text-sm font-normal text-gray-400">(optional, in mm)</span></h3>
                <p className="text-sm text-muted-foreground mb-4">Used for buyer specification matching. Leave blank if unknown.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Input
                        label="Length (mm)"
                        type="text"
                        name="vehicleLength"
                        value={formState.vehicleLength || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 4700"
                    />
                    <Input
                        label="Width (mm)"
                        type="text"
                        name="vehicleWidth"
                        value={formState.vehicleWidth || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 1850"
                    />
                    <Input
                        label="Height (mm)"
                        type="text"
                        name="vehicleHeight"
                        value={formState.vehicleHeight || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 1650"
                    />
                    <Input
                        label="Wheelbase (mm)"
                        type="text"
                        name="vehicleWheelbase"
                        value={formState.vehicleWheelbase || ""}
                        onChange={handleInputChange}
                        placeholder="e.g., 2750"
                    />
                </div>
            </div>

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
