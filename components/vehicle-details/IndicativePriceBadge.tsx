import { AlertCircleIcon } from "@/components/Icons";

const INDICATIVE_PRICE_MESSAGE = "Indicative price only. Final price is subject to the seller's quotation.";

export default function IndicativePriceBadge({ className = "" }: Readonly<{ className?: string }>) {
    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            <span className="inline-flex items-center justify-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                Indicative
            </span>
            <button
                type="button"
                title={INDICATIVE_PRICE_MESSAGE}
                aria-label={INDICATIVE_PRICE_MESSAGE}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-amber-700 hover:bg-amber-50"
            >
                <AlertCircleIcon className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
