import FilterBar from "@/components/FilterBar";
import VehicleCardListing from "@/components/inventory-listing/VehicleCardListing";
import { getBrands, getFilters } from "@/lib/data";
import fs from "fs/promises";
import path from "path";
import MarketplaceSwitch from "@/components/MarketplaceSwitch";
import { normalizeMarketMode, type MarketMode } from "@/lib/marketplace";

export type Content = {
    id: string;
    inventory: Inventory;
    user: userData;
    isFavourite: boolean;
};
export type Data = {
    content: Content[];
    totalItems: number;
    totalElements: number;
    totalPages: number;
    size: number;
    last: boolean;
    currentPage: number;
};

type userData = {
    roleMetaData: {
        companyName?: string;
        dealershipName?: string;
    };
};

export type Inventory = {
    id: string;
    brand: string;
    model: string;
    condition: string;
    year: number;
    bodyType: string;
    city: string;
    country: string;
    fuelType: string;
    transmission: string;
    mainImageUrl: string;
    bulkPurchaseAvailable: boolean;
    vehicleUrl: string;
    price: string;
    userId: string;
    inventoryList: string[];
    views: string;
    currency: string;
    marketType?: MarketMode;
    colorOptions?: string[];
};

export default async function VehicleListing({ searchParams }: Readonly<PageProps<"/vehicles">>) {
    const querySearchParams = await searchParams;
    const marketMode = normalizeMarketMode((querySearchParams as Record<string, string | undefined>).market);
    const newQuery = {
        ...querySearchParams,
        fuelType: querySearchParams.fuelType ?? [],
        drivetrain: querySearchParams.drivetrain ?? [],
        sortBy: "price",
        sortOrder: "asc",
        market: marketMode,
    };

    let data: Data = {
        content: [],
        totalItems: 0,
        totalElements: 0,
        totalPages: 0,
        size: 12,
        last: true,
        currentPage: 1,
    };

    try {
        const filePath = path.join(process.cwd(), "data", "inventory-seed.latest.json");
        const raw = await fs.readFile(filePath, "utf8");
        const payload = JSON.parse(raw) as {
            vehicles?: Content[];
            buckets?: unknown[];
        };
        const sourceVehicles = payload?.vehicles ?? [];
        const colorPalette = ["White", "Black", "Silver", "Blue", "Red", "Gray"];
        const secondHandVehicles = sourceVehicles.map((v) => ({
            ...v,
            inventory: {
                ...v.inventory,
                marketType: "second_hand" as const,
                colorOptions: [v.inventory?.color].filter(Boolean) as string[],
            },
        }));
        const zeroKmVehicles = sourceVehicles.map((v, idx) => {
            const c1 = colorPalette[idx % colorPalette.length];
            const c2 = colorPalette[(idx + 2) % colorPalette.length];
            return {
                ...v,
                inventory: {
                    ...v.inventory,
                    year: Math.max(Number(v.inventory?.year || 0), 2024),
                    marketType: "zero_km" as const,
                    condition: "",
                    color: c1,
                    colorOptions: Array.from(new Set([c1, c2, v.inventory?.color].filter(Boolean))) as string[],
                },
                inventoryData: {
                    ...(v as any).inventoryData,
                    mileage: "",
                    inspectionReportUrl: "",
                },
            };
        });
        const vehicles = (marketMode === "zero_km" ? zeroKmVehicles : secondHandVehicles) as Content[];
        data = {
            content: vehicles,
            totalItems: vehicles.length,
            totalElements: vehicles.length,
            totalPages: Math.max(1, Math.ceil(vehicles.length / 12)),
            size: 12,
            last: true,
            currentPage: 1,
        };
    } catch {}

    const allContent = data.content;
    const cartInventoryIds: string[] = [];

    const brandRes = getBrands();
    const filterRes = getFilters();

    return (
        <main className="text-[#4a5565] container mx-auto px-4 lg:px-6 py-8">
            <MarketplaceSwitch mode={marketMode} compact className="mb-3 max-w-sm" />
            <FilterBar
                brandRes={brandRes}
                filterRes={filterRes}
                parentCls="border border-stroke-light"
                selectCls="bg-input-background"
                isLabel={false}
                isClear={true}
                initialFilters={querySearchParams}
            />
            <VehicleCardListing
                key={JSON.stringify(querySearchParams)}
                initialData={allContent}
                last={true}
                currentPage={data.currentPage}
                querySearchParams={newQuery}
                totalItems={data.totalItems}
                totalPages={data.totalPages}
                pageSize={data.size}
                cartInventoryIds={cartInventoryIds}
                marketMode={marketMode}
            />
        </main>
    );
}
