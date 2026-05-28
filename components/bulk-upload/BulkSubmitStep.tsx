"use client";

import Button from "@/elements/Button";

type Props = {
    total: number;
    validCount: number;
    warningCount: number;
    hasBlockingErrors: boolean;
    submitLoading: boolean;
    submittedIds: string[];
    onBack: () => void;
    onSubmit: () => void;
    onUploadMore: () => void;
    onViewListings: () => void;
};

export default function BulkSubmitStep({ total, validCount, warningCount, hasBlockingErrors, submitLoading, submittedIds, onBack, onSubmit, onUploadMore, onViewListings }: Readonly<Props>) {
    const submitted = submittedIds.length > 0;

    return (
        <div className="rounded-2xl border border-stroke-light bg-white p-6">
            <h2 className="text-xl text-brand-blue">{submitted ? "Submission Complete" : "Submit Listings"}</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-stroke-light bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Vehicles</p>
                    <p className="mt-2 text-2xl font-semibold text-gray-900">{total}</p>
                </div>
                <div className="rounded-xl border border-stroke-light bg-emerald-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-emerald-700">Successfully Validated</p>
                    <p className="mt-2 text-2xl font-semibold text-emerald-900">{validCount}</p>
                </div>
                <div className="rounded-xl border border-stroke-light bg-amber-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-amber-700">Warnings</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-900">{warningCount}</p>
                </div>
            </div>

            {submitted ? (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm font-medium text-emerald-900">Created listing IDs</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {submittedIds.map((id) => (
                            <span key={id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-emerald-900">
                                {id}
                            </span>
                        ))}
                    </div>
                    <div className="mt-5 flex gap-3">
                        <Button type="button" variant="ghost" onClick={onUploadMore}>
                            Upload More
                        </Button>
                        <Button type="button" variant="primary" onClick={onViewListings}>
                            View Listings
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="mt-6 flex justify-between gap-3">
                    <Button type="button" variant="ghost" onClick={onBack}>
                        Back
                    </Button>
                    <Button type="button" variant="primary" disabled={hasBlockingErrors} loading={submitLoading} onClick={onSubmit}>
                        Submit Listings
                    </Button>
                </div>
            )}
        </div>
    );
}
