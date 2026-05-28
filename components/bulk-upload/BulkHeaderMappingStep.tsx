"use client";

import { useState } from "react";
import Button from "@/elements/Button";
import Modal from "@/elements/Modal";
import Select, { type Option } from "@/elements/Select";
import { getBulkUploadFields } from "@/lib/bulk-upload";
import { MarketType } from "@/validation/vehicle-schema";

type Props = {
    marketType: MarketType;
    headers: string[];
    rows: Record<string, string>[];
    mappings: Record<string, string | null>;
    onSetFieldMapping: (fieldKey: string, sellerHeader: string | null) => void;
    onBack: () => void;
    onSaveDraft: () => void;
    onConfirm: () => void;
};

const getSampleValues = (header: string, rows: Record<string, string>[]): string[] => {
    const seen = new Set<string>();
    const samples: string[] = [];
    for (const row of rows) {
        const val = row[header]?.trim();
        if (val && !seen.has(val)) {
            seen.add(val);
            samples.push(val);
        }
        if (samples.length === 3) break;
    }
    return samples;
};

export default function BulkHeaderMappingStep({ marketType, headers, rows, mappings, onSetFieldMapping, onBack, onSaveDraft, onConfirm }: Readonly<Props>) {
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const platformFields = getBulkUploadFields(marketType);
    const requiredFields = platformFields.filter((f) => f.required);

    // Reverse map: fieldKey → sellerHeader
    const reverseMap: Record<string, string> = {};
    Object.entries(mappings).forEach(([header, fieldKey]) => {
        if (fieldKey && fieldKey !== "__ignore__") reverseMap[fieldKey] = header;
    });

    const mappedSellerHeaders = new Set(Object.values(reverseMap));
    const unmappedRequiredFields = requiredFields.filter((f) => !reverseMap[f.key]);

    const headerOptions: Option<string>[] = [
        { value: "__none__", label: "Not mapped" },
        ...headers.map((h) => ({ value: h, label: h })),
    ];

    // Seller headers that aren't mapped to any platform field and aren't ignored
    const unmappedSellerHeaders = headers.filter((h) => !mappedSellerHeaders.has(h) && mappings[h] !== "__ignore__");

    return (
        <div className="rounded-2xl border border-stroke-light bg-white p-6">
            <div className="flex flex-col gap-2">
                <h2 className="text-xl text-brand-blue">Header Mapping</h2>
                <p className="text-sm text-muted-foreground">Match each platform field to the corresponding column in your file. All required fields must be mapped before you can continue.</p>
            </div>

            {unmappedRequiredFields.length > 0 ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-medium text-amber-900">Required fields still unmapped</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {unmappedRequiredFields.map((field) => (
                            <span key={field.key} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-900">
                                {field.label}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-700">All required fields are mapped.</p>
                </div>
            )}

            {/* Platform fields — fully listed */}
            <div className="mt-6 overflow-hidden rounded-xl border border-stroke-light">
                <div className="grid grid-cols-[0.6fr_1.6fr_1.6fr] gap-4 border-b border-stroke-light bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <div>Platform Field</div>
                    <div>Your File Column</div>
                    <div>Sample Values</div>
                </div>
                <div className="divide-y divide-stroke-light">
                    {platformFields.map((field) => {
                        const selectedHeader = reverseMap[field.key] ?? null;
                        const samples = selectedHeader ? getSampleValues(selectedHeader, rows) : [];

                        return (
                            <div key={field.key} className="grid grid-cols-[0.6fr_1.6fr_1.6fr] gap-4 px-4 py-4">
                                <div className="flex flex-col justify-center gap-1">
                                    <p className="text-sm font-medium text-gray-900">{field.label}</p>
                                    <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${field.required ? "bg-red-50 text-red-700" : "bg-slate-100 text-gray-500"}`}>
                                        {field.required ? "Required" : "Optional"}
                                    </span>
                                </div>
                                <Select
                                    options={headerOptions}
                                    value={selectedHeader ?? "__none__"}
                                    onChange={(value) => onSetFieldMapping(field.key, value === "__none__" ? null : String(value))}
                                    placeholder="Select your column"
                                    border="bg-input-background"
                                    searchable
                                />
                                <div className="flex flex-wrap items-center gap-1">
                                    {samples.length > 0 ? (
                                        samples.map((val) => (
                                            <span key={val} className="max-w-[160px] truncate rounded bg-slate-100 px-2 py-0.5 text-xs text-gray-600" title={val}>
                                                {val}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-xs text-gray-400">{selectedHeader ? "No data" : "—"}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Unmapped seller headers — compact */}
            {unmappedSellerHeaders.length > 0 ? (
                <div className="mt-4 rounded-xl border border-stroke-light bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Unmatched file columns ({unmappedSellerHeaders.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {unmappedSellerHeaders.map((h) => (
                            <span key={h} className="rounded-full border border-stroke-light bg-white px-3 py-1 text-xs text-gray-500">
                                {h}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="mt-6 flex justify-between gap-3">
                <Button type="button" variant="ghost" onClick={onBack}>
                    Back
                </Button>
                <div className="flex gap-3">
                    <Button type="button" variant="ghost" onClick={onSaveDraft}>
                        Save Draft
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                            if (unmappedRequiredFields.length > 0) {
                                setConfirmModalOpen(true);
                            } else {
                                onConfirm();
                            }
                        }}>
                        Confirm Mapping
                    </Button>
                </div>
            </div>

            <Modal isOpen={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} showCloseButton>
                <div className="p-2">
                    <h3 className="text-lg text-brand-blue">Unmapped Required Fields</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        The following required fields have no column mapped. Rows missing these fields will be flagged as blocking errors in the pre-validation step and will need to be filled in manually.
                    </p>
                    <div className="mt-4 divide-y divide-stroke-light rounded-xl border border-stroke-light">
                        {unmappedRequiredFields.map((field) => (
                            <div key={field.key} className="flex items-center justify-between px-4 py-3">
                                <span className="text-sm font-medium text-gray-900">{field.label}</span>
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Not mapped</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={() => setConfirmModalOpen(false)}>
                            Go Back
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => {
                                setConfirmModalOpen(false);
                                onConfirm();
                            }}>
                            Continue Anyway
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
