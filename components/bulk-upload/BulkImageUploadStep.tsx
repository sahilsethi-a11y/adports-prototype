"use client";

import { useCallback, useRef, useState } from "react";
import Button from "@/elements/Button";
import { CloseIcon, UploadIcon } from "@/components/Icons";
import type { BulkRow } from "@/lib/bulk-upload";
import { MarketType } from "@/validation/vehicle-schema";

type Props = {
    marketType: MarketType;
    rows: BulkRow[];
    rowImages: Record<string, string[]>;
    onUpdateImages: (rowId: string, images: string[]) => void;
    onApplyToAll: (images: string[]) => void;
    onBack: () => void;
    onContinue: () => void;
};

function readFilesAsDataUrls(files: File[]): Promise<string[]> {
    return Promise.all(
        files.map(
            (file) =>
                new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                })
        )
    );
}

function getVehicleLabel(row: BulkRow) {
    const parts = [row.values.make, row.values.model, row.values.variant, row.values.year].filter(Boolean);
    return parts.join(" ") || `Row #${row.id.slice(-4)}`;
}

function RowImageCard({
    row,
    images,
    onUpdate,
}: {
    row: BulkRow;
    images: string[];
    onUpdate: (images: string[]) => void;
}) {
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 10 - images.length);
            if (!imageFiles.length) return;
            const dataUrls = await readFilesAsDataUrls(imageFiles);
            onUpdate([...images, ...dataUrls]);
        },
        [images, onUpdate]
    );

    const removeImage = (index: number) => {
        onUpdate(images.filter((_, i) => i !== index));
    };

    const isEnriched = row.fieldSources.make === "chaboschi" || row.fieldSources.model === "chaboschi";
    const seedImage = "/seed-images/416c696dd76a1961.jpg";

    return (
        <div className="rounded-xl border border-stroke-light bg-white p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                    <p className="text-sm font-semibold text-[#202C4A] truncate max-w-[200px]" title={getVehicleLabel(row)}>
                        {getVehicleLabel(row)}
                    </p>
                    {row.values.vin && (
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{row.values.vin}</p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {isEnriched && (
                        <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                            🔒 Inspection
                        </span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{images.length} / 10</span>
                </div>
            </div>

            {/* Chaboschi images hint */}
            {isEnriched && images.length === 0 && (
                <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                    <p className="text-xs text-emerald-800">
                        Inspection images available.{" "}
                        <button
                            type="button"
                            className="font-semibold underline underline-offset-2"
                            onClick={() => onUpdate([seedImage, "/seed-images/822c80bb0b4eb6f9.jpg", "/seed-images/a1eec190c7ae0854.jpg"])}
                        >
                            Use inspection images
                        </button>
                    </p>
                </div>
            )}

            {/* Thumbnail strip */}
            {images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                    {images.map((src, i) => (
                        <div key={i} className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={src}
                                alt={`Image ${i + 1}`}
                                className="h-14 w-14 rounded-lg object-cover border border-stroke-light"
                            />
                            {i === 0 && (
                                <span className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-brand-blue/80 text-center text-[9px] font-semibold text-white py-0.5">
                                    Main
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => removeImage(i)}
                                className="absolute -top-1 -right-1 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow"
                            >
                                <CloseIcon className="h-2.5 w-2.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Drop zone */}
            {images.length < 10 && (
                <label
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        handleFiles(e.dataTransfer.files);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-4 transition-colors ${
                        dragOver ? "border-brand-blue bg-blue-50" : "border-stroke-light hover:border-brand-blue/50 hover:bg-slate-50"
                    }`}
                >
                    <UploadIcon className="h-5 w-5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Drop images or click to browse</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="sr-only"
                        onChange={(e) => handleFiles(e.target.files)}
                    />
                </label>
            )}
        </div>
    );
}

export default function BulkImageUploadStep({ marketType, rows, rowImages, onUpdateImages, onApplyToAll, onBack, onContinue }: Readonly<Props>) {
    const [globalDragOver, setGlobalDragOver] = useState(false);
    const globalInputRef = useRef<HTMLInputElement>(null);
    const isZeroKm = marketType === MarketType.ZERO_KM;

    const rowsWithImages = rows.filter((r) => (rowImages[r.id]?.length ?? 0) > 0).length;
    const rowsWithoutImages = rows.length - rowsWithImages;

    const handleApplyToAll = useCallback(
        async (files: FileList | null) => {
            if (!files || files.length === 0) return;
            const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 10);
            if (!imageFiles.length) return;
            const dataUrls = await readFilesAsDataUrls(imageFiles);
            onApplyToAll(dataUrls);
        },
        [onApplyToAll]
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-stroke-light bg-white p-6">
                <h2 className="text-xl text-brand-blue">Bulk Image Upload</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Assign images to each vehicle listing.{" "}
                    {isZeroKm
                        ? "No inspection images are available for zero-km vehicles — upload manufacturer images manually."
                        : "Vehicles enriched via Chaboschi show inspection images for quick assignment."}
                </p>

                {/* Summary */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-stroke-light bg-slate-50 p-3 text-center">
                        <p className="text-xl font-semibold text-[#202C4A]">{rows.length}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Total vehicles</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                        <p className="text-xl font-semibold text-emerald-900">{rowsWithImages}</p>
                        <p className="mt-0.5 text-xs text-emerald-700">With images</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                        <p className="text-xl font-semibold text-amber-900">{rowsWithoutImages}</p>
                        <p className="mt-0.5 text-xs text-amber-700">Missing images</p>
                    </div>
                </div>

                {/* Apply to all */}
                <div
                    onDragOver={(e) => { e.preventDefault(); setGlobalDragOver(true); }}
                    onDragLeave={() => setGlobalDragOver(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setGlobalDragOver(false);
                        handleApplyToAll(e.dataTransfer.files);
                    }}
                    className={`mt-4 rounded-xl border-2 border-dashed p-4 transition-colors ${
                        globalDragOver ? "border-brand-blue bg-blue-50" : "border-stroke-light"
                    }`}
                >
                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                        <div>
                            <p className="text-sm font-medium text-[#202C4A]">Apply images to all vehicles</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Drop images here or use the button to assign the same set of images to every vehicle row.
                            </p>
                        </div>
                        <label className="shrink-0 cursor-pointer">
                            <span className="inline-flex items-center gap-2 rounded-md border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue transition-colors hover:bg-brand-blue hover:text-white">
                                <UploadIcon className="h-4 w-4" />
                                Upload for All
                            </span>
                            <input
                                ref={globalInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="sr-only"
                                onChange={(e) => handleApplyToAll(e.target.files)}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Per-vehicle grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                    <RowImageCard
                        key={row.id}
                        row={row}
                        images={rowImages[row.id] ?? []}
                        onUpdate={(images) => onUpdateImages(row.id, images)}
                    />
                ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onBack}>
                    Back
                </Button>
                <Button type="button" variant="primary" onClick={onContinue}>
                    Continue to Submit
                </Button>
            </div>
        </div>
    );
}
