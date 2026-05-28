"use client";

import { DownloadIcon, FileIcon, CloseIcon, UploadIcon } from "@/components/Icons";
import Button from "@/elements/Button";
import { formatFileSize, type ParsedBulkFile } from "@/lib/bulk-upload";
import { MarketType } from "@/validation/vehicle-schema";

type SplitPart = { filename: string; parsed: ParsedBulkFile };

type Props = {
    marketType: MarketType;
    file: File | null;
    fileError: string | null;
    rowCount: number;
    splitParts: SplitPart[];
    currentPartNumber: number;
    totalParts: number;
    onFileSelect: (file: File) => void;
    onRemoveFile: () => void;
    onDownloadTemplate: () => void;
    onContinue: () => void;
};

export default function BulkUploadFileStep({ marketType, file, fileError, rowCount, splitParts, currentPartNumber, totalParts, onFileSelect, onRemoveFile, onDownloadTemplate, onContinue }: Readonly<Props>) {
    const marketLabel = marketType === MarketType.SECOND_HAND ? "Used Vehicle" : "Zero KM";
    const isSplit = totalParts > 1;

    return (
        <div className="rounded-2xl border border-stroke-light bg-white p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h2 className="text-xl text-brand-blue">Upload File</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Upload a CSV or Excel file for the {marketLabel} bulk flow. Templates include the required platform headers for this vehicle type.</p>
                </div>
                <Button type="button" variant="ghost" leftIcon={<DownloadIcon className="h-4 w-4" />} onClick={onDownloadTemplate}>
                    Download Template
                </Button>
            </div>

            <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    const droppedFile = e.dataTransfer.files?.[0];
                    if (droppedFile) onFileSelect(droppedFile);
                }}
                className="mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stroke-light bg-slate-50 px-6 py-10 text-center transition-colors hover:border-brand-blue hover:bg-blue-50">
                <div className="rounded-full bg-white p-4 shadow-sm">
                    <UploadIcon className="h-8 w-8 text-brand-blue" />
                </div>
                <p className="mt-4 text-base font-medium text-gray-900">Drag and drop your CSV or Excel file here</p>
                <p className="mt-1 text-sm text-muted-foreground">Accepted formats: `.csv`, `.xlsx`</p>
                <span className="mt-5 inline-flex rounded-md border border-brand-blue px-4 py-2 text-sm font-medium text-brand-blue">Browse Files</span>
                <input
                    type="file"
                    className="sr-only"
                    accept=".csv,.xlsx"
                    onChange={(e) => {
                        const nextFile = e.target.files?.[0];
                        if (nextFile) onFileSelect(nextFile);
                    }}
                />
            </label>

            {fileError ? <p className="mt-3 text-sm text-destructive">{fileError}</p> : null}

            {isSplit ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800">
                        <span className="font-medium">File automatically split into {totalParts} parts.</span> Each part is queued below and will be processed in order.
                    </p>
                </div>
            ) : null}

            {file ? (
                <div className="mt-4 space-y-2">
                    {/* Active part */}
                    <div className="rounded-xl border border-brand-blue bg-blue-50 p-4">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-white p-3 shadow-sm">
                                <FileIcon className="text-brand-blue" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                                    {isSplit ? (
                                        <span className="shrink-0 rounded-full bg-brand-blue px-2 py-0.5 text-xs font-medium text-white">
                                            Part {currentPartNumber} of {totalParts}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {formatFileSize(file.size)} • {rowCount} {rowCount === 1 ? "vehicle row" : "vehicle rows"}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onRemoveFile}
                                title="Remove file"
                                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-destructive">
                                <CloseIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Queued parts */}
                    {splitParts.map((part, i) => (
                        <div key={part.filename} className="rounded-xl border border-stroke-light bg-slate-50 p-4">
                            <div className="flex items-start gap-3">
                                <div className="rounded-lg bg-white p-3">
                                    <FileIcon className="text-gray-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium text-gray-500">{part.filename}</p>
                                        <span className="shrink-0 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-500">
                                            Part {currentPartNumber + i + 1} of {totalParts}
                                        </span>
                                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Queued</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {part.parsed.rowCount} {part.parsed.rowCount === 1 ? "vehicle row" : "vehicle rows"}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : null}

            <div className="mt-6 flex justify-end">
                <Button type="button" variant="primary" disabled={!file || !!fileError} onClick={onContinue}>
                    Continue to Header Mapping
                </Button>
            </div>
        </div>
    );
}
