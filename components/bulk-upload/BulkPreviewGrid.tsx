"use client";

import { DeleteIcon, LockIcon } from "@/components/Icons";
import type { BulkMasterData, BulkRow } from "@/lib/bulk-upload";
import { getBulkUploadFields } from "@/lib/bulk-upload";
import { MarketType } from "@/validation/vehicle-schema";

type Props = {
    marketType: MarketType;
    rows: BulkRow[];
    mode: "prevalidate" | "review";
    masterData: BulkMasterData;
    onToggleRow: (rowId: string, checked: boolean) => void;
    onDeleteRow: (rowId: string) => void;
    onChangeField: (rowId: string, field: string, value: string) => void;
};

const SOURCE_LABELS: Record<string, string> = {
    chaboschi: "Chaboschi",
    jato: "JATO",
    autocorrected: "Auto-corrected",
};

const inputBase =
    "w-full rounded-md border bg-white px-2.5 py-1.5 text-sm text-gray-900 outline-none transition-colors focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-gray-400";

const getInputBorder = (hasError: boolean, hasWarning: boolean, hasCorrection: boolean) => {
    if (hasError) return "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15";
    if (hasCorrection || hasWarning) return "border-amber-400 focus-visible:border-amber-500 focus-visible:ring-amber-400/15";
    return "border-stroke-light";
};

export default function BulkPreviewGrid({ marketType, rows, mode, masterData, onToggleRow, onDeleteRow, onChangeField }: Readonly<Props>) {
    const fields = getBulkUploadFields(marketType);

    const getFieldOptions = (field: string) => {
        if (field === "make") return masterData.brands.map((b) => b.name);
        if (field === "color") return masterData.colors;
        if (field === "condition") return masterData.conditions;
        if (field === "regional_specs") return masterData.countries;
        if (field === "currency") return masterData.currencies;
        if (field === "incoterm") return ["FOB", "CIF"];
        return [];
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-stroke-light bg-white">
            <table className="w-full min-w-[1600px] border-collapse text-sm">
                <thead>
                    <tr className="border-b border-stroke-light bg-slate-50">
                        <th className="w-10 px-3 py-3 text-left">
                            <span className="sr-only">Select</span>
                        </th>
                        <th className="w-10 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                        <th className="w-36 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                        {fields.map((field) => (
                            <th key={field.key} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {field.label}
                                {field.required ? (
                                    <span className="ml-1 text-destructive">*</span>
                                ) : (
                                    <span className="ml-1 font-normal normal-case text-gray-400">opt.</span>
                                )}
                            </th>
                        ))}
                        <th className="w-12 px-3 py-3" />
                    </tr>
                </thead>
                <tbody className="divide-y divide-stroke-light">
                    {rows.map((row, rowIndex) => {
                        const hasBlocking = row.blockingIssues.length > 0;
                        const hasWarnings = row.warnings.length > 0;

                        return (
                            <tr
                                key={row.id}
                                className={`align-top transition-colors ${
                                    hasBlocking
                                        ? "bg-red-50/30 hover:bg-red-50/50"
                                        : hasWarnings
                                          ? "bg-amber-50/20 hover:bg-amber-50/40"
                                          : "bg-white hover:bg-slate-50/60"
                                }`}>
                                {/* Checkbox */}
                                <td className="px-3 py-3">
                                    <input
                                        type="checkbox"
                                        checked={row.selected}
                                        onChange={(e) => onToggleRow(row.id, e.target.checked)}
                                        className="h-4 w-4 rounded border-stroke-light accent-brand-blue"
                                    />
                                </td>
                                {/* Row number */}
                                <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">{rowIndex + 1}</td>
                                {/* Status */}
                                <td className="px-3 py-3">
                                    <div className="flex flex-col gap-1.5">
                                        {hasBlocking ? (
                                            <span className="inline-flex w-fit items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                                {row.blockingIssues.length} blocking
                                            </span>
                                        ) : (
                                            <span className="inline-flex w-fit items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                                Valid
                                            </span>
                                        )}
                                        {hasWarnings ? (
                                            <span className="inline-flex w-fit items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                {row.warnings.length} {row.warnings.length === 1 ? "warning" : "warnings"}
                                            </span>
                                        ) : null}
                                        {mode === "review" && row.confidence !== "pending" ? (
                                            <span
                                                className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                                                    row.confidence === "high"
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                        : row.confidence === "medium"
                                                          ? "border-amber-200 bg-amber-50 text-amber-700"
                                                          : "border-red-200 bg-red-50 text-red-700"
                                                }`}>
                                                {row.confidence} confidence
                                            </span>
                                        ) : null}
                                    </div>
                                </td>
                                {/* Field cells */}
                                {fields.map((field) => {
                                    const isLocked = mode === "review" && !!row.fieldLocks[field.key];
                                    const options = getFieldOptions(field.key);
                                    const correction = row.corrections[field.key];
                                    const fieldIssues = row.blockingIssues.filter((i) => i.field === field.key);
                                    const fieldWarnings = row.warnings.filter((i) => i.field === field.key);
                                    const source = row.fieldSources[field.key];
                                    const showSourceBadge = source && source !== "seller" && SOURCE_LABELS[source];
                                    const borderClass = getInputBorder(fieldIssues.length > 0, fieldWarnings.length > 0, !!correction);

                                    return (
                                        <td key={`${row.id}-${field.key}`} className="px-3 py-3">
                                            <div className="flex min-w-[120px] flex-col gap-1">
                                                <div className="relative">
                                                    {options.length ? (
                                                        <select
                                                            value={row.values[field.key] || ""}
                                                            disabled={isLocked}
                                                            onChange={(e) => onChangeField(row.id, field.key, e.target.value)}
                                                            className={`${inputBase} ${borderClass} pr-7`}>
                                                            <option value="">—</option>
                                                            {options.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            value={row.values[field.key] || ""}
                                                            disabled={isLocked}
                                                            onChange={(e) => onChangeField(row.id, field.key, e.target.value)}
                                                            className={`${inputBase} ${borderClass}`}
                                                        />
                                                    )}
                                                    {isLocked ? (
                                                        <LockIcon className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                                    ) : null}
                                                </div>
                                                {showSourceBadge ? (
                                                    <span className="w-fit rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                        {SOURCE_LABELS[source]}
                                                    </span>
                                                ) : null}
                                                {correction ? (
                                                    <p className="text-[11px] text-amber-700">
                                                        <span className="font-medium">Suggested:</span> {correction.corrected}
                                                    </p>
                                                ) : null}
                                                {fieldIssues.map((issue) => (
                                                    <p key={issue.message} className="text-[11px] font-medium text-destructive">
                                                        {issue.message}
                                                    </p>
                                                ))}
                                                {!fieldIssues.length && fieldWarnings.map((issue) => (
                                                    <p key={issue.message} className="text-[11px] text-amber-700">
                                                        {issue.message}
                                                    </p>
                                                ))}
                                            </div>
                                        </td>
                                    );
                                })}
                                {/* Delete */}
                                <td className="px-3 py-3">
                                    <button
                                        type="button"
                                        title="Delete row"
                                        onClick={() => onDeleteRow(row.id)}
                                        className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-destructive">
                                        <DeleteIcon className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={fields.length + 4} className="px-6 py-12 text-center text-sm text-muted-foreground">
                                No rows to display.
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}
