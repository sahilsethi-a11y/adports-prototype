"use client";

type Props = {
    current: number;
    total: number;
    message: string;
};

export default function BulkEnrichmentStep({ current, total, message }: Readonly<Props>) {
    const progress = total ? Math.round((current / total) * 100) : 0;

    return (
        <div className="rounded-2xl border border-stroke-light bg-white p-8">
            <h2 className="text-xl text-brand-blue">Enrichment In Progress</h2>
            <p className="mt-2 text-sm text-muted-foreground">Matching VINs, validating JATO variants, and preparing the final review data.</p>
            <div className="mt-8">
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-blue transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-gray-700">
                    <span>{message}</span>
                    <span>{progress}%</span>
                </div>
            </div>
        </div>
    );
}
