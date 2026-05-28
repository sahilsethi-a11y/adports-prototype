"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/elements/Button";
import message from "@/elements/message";
import Modal from "@/elements/Modal";
import BulkUploadFileStep from "@/components/bulk-upload/BulkUploadFileStep";
import BulkHeaderMappingStep from "@/components/bulk-upload/BulkHeaderMappingStep";
import BulkPreviewGrid from "@/components/bulk-upload/BulkPreviewGrid";
import BulkEnrichmentStep from "@/components/bulk-upload/BulkEnrichmentStep";
import BulkImageUploadStep from "@/components/bulk-upload/BulkImageUploadStep";
import BulkSubmitStep from "@/components/bulk-upload/BulkSubmitStep";
import {
    BULK_UPLOAD_STEPS,
    BULK_ROW_LIMIT,
    acceptAllBulkCorrections,
    createEmptyBulkRow,
    createMappedBulkRows,
    downloadBulkTemplate,
    enrichBulkRows,
    type BulkFieldSource,
    type BulkMasterData,
    type BulkRow,
    getBulkDraftStorageKey,
    getSuggestedHeaderMappings,
    parseBulkVehicleFile,
    splitParsedFile,
    sortBulkRowsForDisplay,
    type ParsedBulkFile,
    validateBulkRows,
} from "@/lib/bulk-upload";
import { ArrowLeftIcon } from "@/components/Icons";
import { Incoterm, MarketType, Status, type VehicleFormValues } from "@/validation/vehicle-schema";
import { listLocalInventory, saveLocalInventory } from "@/lib/localInventory";
import type { Brand } from "@/lib/data";

type Props = {
    marketType: MarketType;
    brands: Brand[];
    filterData?: Record<string, unknown>;
};

type DraftState = {
    step: number;
    parsed: ParsedBulkFile | null;
    mappings: Record<string, string | null>;
    rows: BulkRow[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const parseFeatureList = (raw: string | undefined): string[] =>
    raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BulkUploadWizard({ marketType, brands, filterData }: Readonly<Props>) {
    const router = useRouter();

    // ── master data ───────────────────────────────────────────────────────────
    const masterData = useMemo<BulkMasterData>(
        () => ({
            brands,
            colors: ((filterData?.colors as { value: string }[]) || []).map((item) => item.value),
            conditions: ((filterData?.bodyConditionOptions as { value: string }[]) || []).map((item) => item.value),
            countries: ((filterData?.country as { label: string; value: string }[]) || []).map((item) => item.label),
            currencies: ((filterData?.currency as { value: string }[]) || []).map((item) => item.value),
            fuelTypes: ((filterData?.fuelType as { value: string }[]) || []).map((i) => i.value),
            transmissions: ((filterData?.transmission as { value: string }[]) || []).map((i) => i.value),
            drivetrains: ((filterData?.drivetrain as { value: string }[]) || []).map((i) => i.value),
            bodyTypes: ((filterData?.bodyType as { value: string }[]) || []).map((i) => i.value),
            regionalSpecs: ((filterData?.regionalSpecsOptions as { value: string }[]) || []).map((i) => i.value),
        }),
        [brands, filterData]
    );

    // ── draft restore ─────────────────────────────────────────────────────────
    const initialDraft = useMemo(() => {
        if (typeof window === "undefined") {
            return { step: 1, parsed: null as ParsedBulkFile | null, mappings: {} as Record<string, string | null>, rows: [] as BulkRow[], restored: false };
        }
        const raw = window.localStorage.getItem(getBulkDraftStorageKey(marketType));
        if (!raw) return { step: 1, parsed: null as ParsedBulkFile | null, mappings: {} as Record<string, string | null>, rows: [] as BulkRow[], restored: false };
        try {
            const draft = JSON.parse(raw) as DraftState;
            return { step: draft.step || 1, parsed: draft.parsed || null, mappings: draft.mappings || {}, rows: draft.rows || [], restored: !!draft.parsed || !!draft.rows?.length };
        } catch {
            window.localStorage.removeItem(getBulkDraftStorageKey(marketType));
            return { step: 1, parsed: null as ParsedBulkFile | null, mappings: {} as Record<string, string | null>, rows: [] as BulkRow[], restored: false };
        }
    }, [marketType]);

    // ── state ─────────────────────────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState(initialDraft.step);
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [parsedFile, setParsedFile] = useState<ParsedBulkFile | null>(initialDraft.parsed);
    const [mappings, setMappings] = useState<Record<string, string | null>>(initialDraft.mappings);
    const [rows, setRows] = useState<BulkRow[]>(initialDraft.rows);
    const [rowImages, setRowImages] = useState<Record<string, string[]>>({});
    const [splitParts, setSplitParts] = useState<{ filename: string; parsed: ParsedBulkFile }[]>([]);
    const [currentPartNumber, setCurrentPartNumber] = useState(1);
    const [totalParts, setTotalParts] = useState(1);
    const [enrichmentProgress, setEnrichmentProgress] = useState({ current: 0, total: 0, message: "Preparing enrichment..." });
    const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [submittedIds, setSubmittedIds] = useState<string[]>([]);
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

    useEffect(() => {
        if (initialDraft.restored) message.info("Bulk upload draft restored.");
    }, [initialDraft.restored]);

    // ── existing inventory key map ────────────────────────────────────────────
    const existingKeyMap = useMemo(() => {
        const records = listLocalInventory(marketType === MarketType.ZERO_KM ? "zero_km" : "second_hand");
        return new Map(
            records.map((record) => {
                const key =
                    marketType === MarketType.SECOND_HAND
                        ? String(record.form.vehicles?.[0]?.vin || "").trim().toLowerCase()
                        : [record.form.brand, record.form.model, record.form.variant, String(record.form.year || "")]
                              .map((value) => String(value || "").trim().toLowerCase())
                              .join("|");
                return [key, record.id];
            })
        );
    }, [marketType]);

    const revalidateRows = useCallback(
        (nextRows: BulkRow[]) => validateBulkRows(nextRows, marketType, masterData, existingKeyMap),
        [existingKeyMap, marketType, masterData]
    );
    const displayRows = useMemo(() => sortBulkRowsForDisplay(rows), [rows]);
    const blockingCount = rows.filter((row) => row.blockingIssues.length > 0).length;
    const warningCount = rows.reduce((sum, row) => sum + row.warnings.length, 0);

    // ── file handling ─────────────────────────────────────────────────────────
    const handleFileSelect = async (nextFile: File) => {
        const extension = nextFile.name.split(".").pop()?.toLowerCase();
        if (!["csv", "xlsx"].includes(extension || "")) {
            setFile(null); setParsedFile(null); setFileError("Invalid file format. Upload a CSV or .xlsx file.");
            return;
        }
        setFileError(null);
        setFile(nextFile);
        try {
            const parsed = await parseBulkVehicleFile(nextFile);
            if (!parsed.headers.length) {
                setParsedFile(null); setFileError("The uploaded file is empty or does not contain a header row."); return;
            }
            if (parsed.rowCount > BULK_ROW_LIMIT) {
                const chunks = splitParsedFile(parsed);
                const baseName = nextFile.name.replace(/\.(csv|xlsx)$/i, "");
                const remaining = chunks.slice(1).map((chunk, i) => ({ filename: `${baseName}_part${i + 2}.xlsx`, parsed: chunk }));
                setParsedFile(chunks[0]);
                setMappings(getSuggestedHeaderMappings(chunks[0].headers, marketType));
                setRows([]); setSplitParts(remaining); setCurrentPartNumber(1); setTotalParts(chunks.length);
                message.info(`File automatically split into ${chunks.length} parts. Processing part 1 of ${chunks.length}.`);
            } else {
                setParsedFile(parsed);
                setMappings(getSuggestedHeaderMappings(parsed.headers, marketType));
                setRows([]); setSplitParts([]); setCurrentPartNumber(1); setTotalParts(1);
            }
        } catch {
            setParsedFile(null); setFileError("We couldn't read that file. Check the format and try again.");
        }
    };

    // ── draft save ────────────────────────────────────────────────────────────
    const saveDraft = () => {
        if (typeof window === "undefined") return;
        const draft: DraftState = { step: currentStep, parsed: parsedFile, mappings, rows };
        window.localStorage.setItem(getBulkDraftStorageKey(marketType), JSON.stringify(draft));
        message.success("Bulk upload draft saved locally.");
    };

    // ── enrichment (step 4 → 5) ───────────────────────────────────────────────
    useEffect(() => {
        if (currentStep !== 4 || !rows.length) return;
        let isActive = true;
        const run = async () => {
            const enrichedRows = await enrichBulkRows(rows, marketType, (progress) => {
                if (isActive) setEnrichmentProgress(progress);
            });
            if (!isActive) return;
            setRows(revalidateRows(enrichedRows));
            setCurrentStep(5);
            message.success("Bulk enrichment completed.");
        };
        run();
        return () => { isActive = false; };
    }, [currentStep, rows, marketType, revalidateRows]);

    // ── inline field edit (steps 3 & 5) ──────────────────────────────────────
    const updateRowField = async (rowId: string, field: string, value: string) => {
        const nextRows: BulkRow[] = rows.map((row) =>
            row.id === rowId
                ? {
                      ...row,
                      values: { ...row.values, [field]: value },
                      fieldSources: { ...row.fieldSources, [field]: "seller" as BulkFieldSource },
                      fieldLocks:
                          currentStep === 5 && ["make", "model", "variant", "year", "mileage", "condition"].includes(field)
                              ? { ...row.fieldLocks, [field]: false }
                              : row.fieldLocks,
                  }
                : row
        );
        const validatedRows = revalidateRows(nextRows);
        setRows(validatedRows);
        if (currentStep === 5 && ["make", "model", "variant", "year", "vin"].includes(field)) {
            const targetRow = validatedRows.find((row) => row.id === rowId);
            if (!targetRow) return;
            const enrichedSingle = await enrichBulkRows([targetRow], marketType);
            setRows((prev) => revalidateRows(prev.map((row) => (row.id === rowId ? enrichedSingle[0] : row))));
        }
    };

    // ── image handlers ────────────────────────────────────────────────────────
    const handleUpdateRowImages = (rowId: string, images: string[]) => {
        setRowImages((prev) => ({ ...prev, [rowId]: images }));
    };

    const handleApplyToAll = (images: string[]) => {
        const next: Record<string, string[]> = {};
        rows.forEach((row) => { next[row.id] = images; });
        setRowImages(next);
        message.success(`Images applied to all ${rows.length} vehicles.`);
    };

    // ── build VehicleFormValues from BulkRow ──────────────────────────────────
    const buildVehicleForm = (row: BulkRow): VehicleFormValues => {
        const images = rowImages[row.id] ?? [];
        const fallbackImage = marketType === MarketType.ZERO_KM ? "/seed-images/01a925d2f23d5cc8.jpg" : "/seed-images/416c696dd76a1961.jpg";
        const imageUrls = images.length ? images : [fallbackImage];
        const mainImageUrl = imageUrls[0];

        const priceValue = Number(row.values.price || row.values.price_per_color || "0");
        const incotermValue = row.values.incoterm?.toUpperCase();

        const interiorFeatures = parseFeatureList(row.values.features_interior);
        const exteriorFeatures = parseFeatureList(row.values.features_exterior);
        const safetyFeatures = parseFeatureList(row.values.features_safety);
        const techFeatures = parseFeatureList(row.values.features_technology);
        const comfortFeatures = parseFeatureList(row.values.features_comfort);

        return {
            inventoryId: row.replaceExisting ? row.duplicateExistingId : undefined,
            marketType,
            vin: row.values.vin || "",
            vinLookupStatus: row.fieldSources.make === "chaboschi" ? "found" : row.values.vin ? "found" : "idle",
            vinLookupMessage: "",
            vinLookupProvider: row.fieldSources.make === "chaboschi" ? "Chaboschi" : "",
            chaboschiLockedFields: row.fieldSources.make === "chaboschi" ? ["brand", "model", "variant", "year"] : [],
            inspectionSummary: "",
            inspectionProvider: row.fieldSources.make === "chaboschi" ? "Chaboschi" : "",
            inspectionDateNote: "",
            vehicleDescription: "",
            fetchedMileage: Number(row.values.mileage || "0") || undefined,
            // Identity
            brand: row.values.make || "",
            model: row.values.model || "",
            variant: row.values.variant || "",
            year: Number(row.values.year || "0"),
            vehicleType: row.values.vehicle_type || "",
            countryOfOrigin: row.values.country_of_origin || "",
            regionalSpecs: row.values.regional_specs || "GCC Specs",
            bodyType: row.values.body_type || "Sedan",
            condition: marketType === MarketType.SECOND_HAND ? row.values.condition || "Good" : "",
            conditionSource: row.fieldSources.condition === "chaboschi" ? "chaboschi" : "manual",
            color: row.values.color || "",
            city: row.values.city || "Dubai",
            country: row.values.country || "AE",
            status: Status.LIVE,
            // Commercial
            price: priceValue || undefined,
            currency: row.values.currency || "AED",
            allowPriceNegotiations: false,
            negotiationNotes: "",
            maxDiscountMargin: undefined,
            // Tech specs
            fuelType: row.values.fuel_type || "",
            transmission: row.values.transmission || "Automatic",
            drivetrain: row.values.drivetrain || "FWD",
            engineSize: row.values.engine_size || "",
            batterySize: row.values.battery_size || "",
            electricRange: "",
            cylinders: Number(row.values.cylinders || "0") || 0,
            horsepower: Number(row.values.horsepower || "0") || 0,
            seatingCapacity: Number(row.values.seating_capacity || "0") || 0,
            numberOfDoors: Number(row.values.number_of_doors || "0") || 0,
            vehicleLength: "",
            vehicleWidth: "",
            vehicleHeight: "",
            vehicleWheelbase: "",
            // Features
            featureCategories: {
                interior: { seatMaterial: [], seatFeatures: interiorFeatures },
                exterior: { wheels: [], lighting: [], roof: exteriorFeatures },
                technology: { connectivity: techFeatures, display: [], audio: [] },
                safety: { core: safetyFeatures, advanced: [] },
                comfort: { climate: comfortFeatures, access: [] },
            },
            features: [...interiorFeatures, ...exteriorFeatures, ...safetyFeatures, ...techFeatures, ...comfortFeatures],
            imageUrls,
            mainImageUrl,
            description: row.values.description || row.values.variant || row.values.model || "Bulk uploaded listing",
            vehicles: [
                {
                    mileage: Number(row.values.mileage || "0") || undefined,
                    vin: row.values.vin || "",
                    vinList: row.values.vin ? [row.values.vin] : [],
                    registrationNumber: "",
                    numberOfOwners: Number(row.values.number_of_owners || "0") || undefined,
                    warrantyRemaining: row.values.warranty_remaining_years ? `${row.values.warranty_remaining_years} years` : "",
                    inspectionReportUrl: "",
                    color: row.values.color || "",
                    availableQuantity: marketType === MarketType.ZERO_KM ? 1 : undefined,
                    unitPrice: priceValue || undefined,
                    incoterm: incotermValue === "FOB" ? Incoterm.FOB : incotermValue === "CIF" ? Incoterm.CIF : undefined,
                    fobPrice: incotermValue === "FOB" ? priceValue || undefined : undefined,
                    fobPortOfLoading: row.values.port_of_loading || "",
                    cifPrice: incotermValue === "CIF" ? priceValue || undefined : undefined,
                    cifPortOfDestination: row.values.port_of_destination || "",
                },
            ],
        };
    };

    // ── derived ───────────────────────────────────────────────────────────────
    const duplicateRows = rows.filter((row) => row.duplicateExistingId && !row.replaceExisting);
    const activeTitle = useMemo(() => (marketType === MarketType.SECOND_HAND ? "Used Vehicle Bulk Upload" : "Zero KM Bulk Upload"), [marketType]);

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <Button type="button" variant="ghost" className="mb-3 px-0" leftIcon={<ArrowLeftIcon className="h-3.5 w-3.5" />} onClick={() => router.push("/seller/dashboard")}>
                        Back to Dashboard
                    </Button>
                    <h1 className="text-2xl text-brand-blue">{activeTitle}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {marketType === MarketType.SECOND_HAND
                            ? "Upload a CSV/Excel file — VINs are looked up on Chaboschi and inspection-verified fields are locked automatically."
                            : "Upload a CSV/Excel file — provide vehicle details and indicative pricing per color configuration."}
                    </p>
                </div>
                <Button type="button" variant="ghost" onClick={saveDraft}>
                    Save Draft
                </Button>
            </div>

            {/* Step indicator */}
            <div className="rounded-2xl border border-stroke-light bg-white p-4">
                <div className="grid grid-cols-4 gap-2 md:grid-cols-7">
                    {BULK_UPLOAD_STEPS.map((step, index) => {
                        const stepNumber = index + 1;
                        const isActive = stepNumber === currentStep;
                        const isCompleted = stepNumber < currentStep;
                        return (
                            <div key={step} className={`rounded-xl border px-2 py-3 text-center ${isActive ? "border-brand-blue bg-blue-50" : isCompleted ? "border-emerald-200 bg-emerald-50" : "border-stroke-light bg-slate-50"}`}>
                                <div className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isActive ? "bg-brand-blue text-white" : isCompleted ? "bg-emerald-600 text-white" : "bg-white text-gray-600"}`}>
                                    {isCompleted ? "✓" : stepNumber}
                                </div>
                                <p className="mt-1.5 text-[11px] font-medium text-gray-700 leading-tight">{step}</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Step 1: Upload ── */}
            {currentStep === 1 ? (
                <BulkUploadFileStep
                    marketType={marketType}
                    file={file}
                    fileError={fileError}
                    rowCount={parsedFile?.rowCount || 0}
                    onFileSelect={handleFileSelect}
                    onRemoveFile={() => {
                        setFile(null); setParsedFile(null); setFileError(null);
                        setMappings({}); setRows([]); setSplitParts([]);
                        setCurrentPartNumber(1); setTotalParts(1);
                    }}
                    splitParts={splitParts}
                    currentPartNumber={currentPartNumber}
                    totalParts={totalParts}
                    onDownloadTemplate={() => downloadBulkTemplate(marketType)}
                    onContinue={() => setCurrentStep(2)}
                />
            ) : null}

            {/* ── Step 2: Header Mapping ── */}
            {currentStep === 2 && parsedFile ? (
                <BulkHeaderMappingStep
                    marketType={marketType}
                    headers={parsedFile.headers}
                    rows={parsedFile.rows}
                    mappings={mappings}
                    onSetFieldMapping={(fieldKey, sellerHeader) => {
                        setMappings((prev) => {
                            const next = { ...prev };
                            Object.keys(next).forEach((h) => { if (next[h] === fieldKey) next[h] = null; });
                            if (sellerHeader) next[sellerHeader] = fieldKey;
                            return next;
                        });
                    }}
                    onBack={() => setCurrentStep(1)}
                    onSaveDraft={saveDraft}
                    onConfirm={() => {
                        const nextRows = revalidateRows(createMappedBulkRows(parsedFile, mappings, marketType));
                        setRows(nextRows);
                        setCurrentStep(3);
                        saveDraft();
                        message.success("Header mapping confirmed.");
                    }}
                />
            ) : null}

            {/* ── Step 3: Pre-Validate ── */}
            {currentStep === 3 ? (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl text-brand-blue">Pre-Validation Preview</h2>
                            <p className="text-sm text-muted-foreground">
                                Review uploaded rows, fix blocking issues, accept suggested corrections, and prepare for enrichment.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <Button type="button" variant="ghost" onClick={() => setRows((prev) => revalidateRows(acceptAllBulkCorrections(prev)))}>
                                Accept All Auto-Corrections
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRows((prev) => [...prev, createEmptyBulkRow(marketType)])}>
                                Add Row
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setRows((prev) => revalidateRows(prev.filter((row) => !row.selected)))}>
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                    <BulkPreviewGrid
                        marketType={marketType}
                        rows={displayRows}
                        mode="prevalidate"
                        masterData={masterData}
                        onToggleRow={(rowId, checked) => setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, selected: checked } : row)))}
                        onDeleteRow={(rowId) => setRows((prev) => revalidateRows(prev.filter((row) => row.id !== rowId)))}
                        onChangeField={updateRowField}
                    />
                    <div className="flex justify-between gap-3">
                        <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)}>Back</Button>
                        <div className="flex gap-3">
                            <Button type="button" variant="ghost" onClick={saveDraft}>Save Draft</Button>
                            <Button type="button" variant="primary" disabled={blockingCount > 0 || !rows.length} onClick={() => setCurrentStep(4)}>
                                Proceed to Enrichment
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* ── Step 4: Enrichment ── */}
            {currentStep === 4 ? (
                <BulkEnrichmentStep current={enrichmentProgress.current} total={enrichmentProgress.total} message={enrichmentProgress.message} />
            ) : null}

            {/* ── Step 5: Post-Enrichment Review ── */}
            {currentStep === 5 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <h2 className="text-xl text-brand-blue">Post-Enrichment Review</h2>
                            <p className="text-sm text-muted-foreground">
                                Chaboschi-locked fields (Make, Model, Variant, Year, Condition, Mileage) cannot be modified for inspected vehicles.
                                Edit freely for rows without inspection data.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            {blockingCount > 0 && (
                                <span className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                                    {blockingCount} blocking {blockingCount === 1 ? "row" : "rows"}
                                </span>
                            )}
                            {warningCount > 0 && (
                                <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
                                    {warningCount} {warningCount === 1 ? "warning" : "warnings"}
                                </span>
                            )}
                            {blockingCount === 0 && (
                                <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                                    All rows valid
                                </span>
                            )}
                        </div>
                    </div>
                    <BulkPreviewGrid
                        marketType={marketType}
                        rows={displayRows}
                        mode="review"
                        masterData={masterData}
                        onToggleRow={(rowId, checked) => setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, selected: checked } : row)))}
                        onDeleteRow={(rowId) => setRows((prev) => revalidateRows(prev.filter((row) => row.id !== rowId)))}
                        onChangeField={updateRowField}
                    />
                    <div className="flex justify-between gap-3">
                        <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)}>Back</Button>
                        <Button
                            type="button"
                            variant="primary"
                            disabled={blockingCount > 0 || !rows.length}
                            onClick={() => {
                                if (duplicateRows.length) { setDuplicateModalOpen(true); return; }
                                setCurrentStep(6);
                            }}>
                            Continue to Images
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* ── Step 6: Images ── */}
            {currentStep === 6 ? (
                <BulkImageUploadStep
                    marketType={marketType}
                    rows={displayRows}
                    rowImages={rowImages}
                    onUpdateImages={handleUpdateRowImages}
                    onApplyToAll={handleApplyToAll}
                    onBack={() => setCurrentStep(5)}
                    onContinue={() => setCurrentStep(7)}
                />
            ) : null}

            {/* ── Step 7: Submit ── */}
            {currentStep === 7 ? (
                <BulkSubmitStep
                    total={rows.length}
                    validCount={rows.filter((row) => row.blockingIssues.length === 0).length}
                    warningCount={warningCount}
                    hasBlockingErrors={blockingCount > 0}
                    submitLoading={submitLoading}
                    submittedIds={submittedIds}
                    onBack={() => setCurrentStep(6)}
                    onSubmit={() => setIsSubmitModalOpen(true)}
                    onUploadMore={() => router.refresh()}
                    onViewListings={() => router.push("/seller/inventory")}
                />
            ) : null}

            {/* ── Duplicate resolution modal ── */}
            <Modal isOpen={duplicateModalOpen} onClose={() => setDuplicateModalOpen(false)} showCloseButton>
                <div className="p-2">
                    <h3 className="text-lg text-brand-blue">Duplicate Listings Detected</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Some rows match existing seller listings. Choose how to handle them before proceeding.
                    </p>
                    <div className="mt-4 space-y-2">
                        {duplicateRows.map((row) => (
                            <div key={row.id} className="rounded-lg border border-stroke-light p-3 text-sm text-gray-800">
                                {marketType === MarketType.SECOND_HAND
                                    ? row.values.vin
                                    : `${row.values.make} ${row.values.model} ${row.values.variant} ${row.values.year}`}
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                        <Button type="button" variant="ghost" onClick={() => {
                            setRows((prev) => prev.filter((row) => !row.duplicateExistingId || row.replaceExisting));
                            setDuplicateModalOpen(false);
                            setCurrentStep(6);
                        }}>
                            Remove Duplicates
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => router.push("/seller/inventory")}>
                            View Existing Listings
                        </Button>
                        <Button type="button" variant="primary" onClick={() => {
                            setRows((prev) => prev.map((row) => (row.duplicateExistingId ? { ...row, replaceExisting: true } : row)));
                            setDuplicateModalOpen(false);
                            setCurrentStep(6);
                        }}>
                            Replace Existing
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── Submit confirmation modal ── */}
            <Modal isOpen={isSubmitModalOpen} onClose={() => setIsSubmitModalOpen(false)} showCloseButton>
                <div className="p-2">
                    <h3 className="text-lg text-brand-blue">Confirm Bulk Submission</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Total vehicles: <strong>{rows.length}</strong> · Validated: <strong>{rows.filter((r) => r.blockingIssues.length === 0).length}</strong> · Warnings: <strong>{warningCount}</strong>
                    </p>
                    <div className="mt-4 rounded-xl border border-stroke-light bg-slate-50 p-3 text-sm text-gray-700">
                        <p className="font-medium mb-1">Image coverage</p>
                        <p className="text-xs text-muted-foreground">
                            {rows.filter((r) => (rowImages[r.id]?.length ?? 0) > 0).length} of {rows.length} vehicles have images assigned.
                            {rows.filter((r) => (rowImages[r.id]?.length ?? 0) === 0).length > 0 && " Vehicles without images will use a placeholder."}
                        </p>
                    </div>
                    <div className="mt-5 flex gap-3">
                        <Button type="button" variant="ghost" onClick={() => setIsSubmitModalOpen(false)}>Cancel</Button>
                        <Button
                            type="button"
                            variant="primary"
                            loading={submitLoading}
                            onClick={() => {
                                setSubmitLoading(true);
                                const nextIds = rows
                                    .filter((row) => row.blockingIssues.length === 0)
                                    .map((row) => saveLocalInventory(buildVehicleForm(row), Status.LIVE));
                                setSubmittedIds(nextIds);
                                setSubmitLoading(false);
                                setIsSubmitModalOpen(false);
                                message.success("Bulk listings submitted locally.");

                                if (splitParts.length > 0) {
                                    const [nextPart, ...remaining] = splitParts;
                                    const nextPartNumber = currentPartNumber + 1;
                                    const nextRows = revalidateRows(createMappedBulkRows(nextPart.parsed, mappings, marketType));
                                    setParsedFile(nextPart.parsed);
                                    setRows(nextRows);
                                    setSplitParts(remaining);
                                    setCurrentPartNumber(nextPartNumber);
                                    setCurrentStep(3);
                                    message.info(`Part ${nextPartNumber} of ${totalParts} loaded automatically.`);
                                }
                            }}>
                            Confirm Submit
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
