import BulkUploadWizard from "@/components/bulk-upload/BulkUploadWizard";
import { getBrands, getFilters } from "@/lib/data";
import { MarketType } from "@/validation/vehicle-schema";

export default async function BulkAddVehiclePage({
    searchParams,
}: Readonly<{ searchParams: Promise<{ marketType?: MarketType }> }>) {
    const { marketType } = await searchParams;
    const normalizedMarketType = marketType === MarketType.ZERO_KM ? MarketType.ZERO_KM : MarketType.SECOND_HAND;
    const [brandData, filterData] = await Promise.all([getBrands(), getFilters()]);

    return (
        <main>
            <div className="container mx-auto max-w-6xl px-4 py-8">
                <BulkUploadWizard marketType={normalizedMarketType} brands={brandData.data} filterData={filterData.data} />
            </div>
        </main>
    );
}
