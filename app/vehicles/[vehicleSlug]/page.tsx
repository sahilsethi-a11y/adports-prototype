import { ArrowLeftIcon, FileIcon } from "@/components/Icons";
import Link from "next/link";
import ImageCarousel from "@/components/vehicle-details/ImageCarousel";
import ShortList from "@/components/vehicle-details/ShortList";
import QRShare from "@/components/vehicle-details/QRShare";
import FeaturesTable from "@/components/vehicle-details/FeaturesTable";
import VehicleSpecs from "@/components/vehicle-details/VehicleSpecs";
import VehicleViewTracker from "@/components/vehicle-details/VehicleViewTracker";
import VehicleDetails, { type VehicleDetailsData } from "@/components/vehicle-details/VehicleDetails";
import type { Specification } from "@/components/vehicle-details/VehicleSpecs";
import PriceBadge from "@/elements/PriceBadge";
import Button from "@/elements/Button";
import { formatPrice } from "@/lib/utils";
import { normalizeMarketMode } from "@/lib/marketplace";
import ZeroKmQuantityCard from "@/components/vehicle-details/ZeroKmQuantityCard";
import fs from "fs/promises";
import path from "path";
import { notFound } from "next/navigation";

type Data = {
    id: string;
    imageUrls: string[];
    name: string;
    price: string;
    description: string;
    currency: string;
    condition: string;
    features: string[];
    sellerInformation: {
        id: string;
        name: string;
        address: string;
    };
    vehicleDetails: VehicleDetailsData[];
    specificationIcons: Specification[];
    isFavourite: boolean;
    vin?: string;
    brand?: string;
    model?: string;
    variant?: string;
    year?: number;
    color?: string;
    colorOptions?: string[];
    bodyType?: string;
};

type SeedVehicle = {
    id?: string;
    isFavourite?: boolean;
    user?: {
        roleMetaData?: {
            companyName?: string;
            dealershipName?: string;
        };
    };
    inventoryData?: {
        id?: string;
        mileage?: string | number;
        numberOfOwners?: string | number;
        warrantyRemaining?: string | number;
        inspectionReportUrl?: string;
        vin?: string;
    };
    inventory: {
        id: string;
        brand?: string;
        model?: string;
        variant?: string;
        year?: number;
        bodyType?: string;
        condition?: string;
        color?: string;
        colorOptions?: string[];
        city?: string;
        country?: string;
        fuelType?: string;
        transmission?: string;
        drivetrain?: string;
        engineSize?: string | number;
        seatingCapacity?: string | number;
        numberOfDoors?: string | number;
        features?: string[];
        imageUrls?: string[];
        mainImageUrl?: string;
        price?: string | number;
        currency?: string;
        description?: string;
        userId?: string;
    };
};

const toLocalDetailsData = (seed: SeedVehicle, marketMode: "second_hand" | "zero_km"): Data => {
    const inv = seed.inventory;
    const invData = seed.inventoryData;
    const year = Number(inv.year) || undefined;
    const brand = inv.brand || "";
    const model = inv.model || "";
    const variant = inv.variant || "";
    const name = [year, brand, model, variant].filter(Boolean).join(" ").trim() || "Vehicle";
    const images = (inv.imageUrls && inv.imageUrls.length ? inv.imageUrls : [inv.mainImageUrl || "/seed-images/01a925d2f23d5cc8.jpg"]).filter(Boolean) as string[];
    const sellerName = seed.user?.roleMetaData?.companyName || seed.user?.roleMetaData?.dealershipName || "Unknown Seller";
    const address = [inv.city, inv.country].filter(Boolean).join(", ");
    const mileageRaw = invData?.mileage ?? "";
    const mileage = marketMode === "zero_km" ? "" : String(mileageRaw || "");
    const numberOfOwners = String(invData?.numberOfOwners ?? "N/A");
    const warrantyRemaining = String(invData?.warrantyRemaining ?? "N/A");
    const inspectionReportUrl = marketMode === "zero_km" ? "" : String(invData?.inspectionReportUrl || "");
    const palette = ["White", "Black", "Silver", "Blue", "Red", "Gray"];
    const c1 = inv.color || "White";
    const c2 = palette[(inv.id?.length || 0) % palette.length];
    const c3 = palette[((inv.id?.length || 0) + 2) % palette.length];
    const seedColorOptions = Array.isArray(inv.colorOptions) ? inv.colorOptions.filter(Boolean) : [];
    const colorOptions = Array.from(new Set([c1, ...seedColorOptions, c2, c3].filter(Boolean)));

    const specificationIcons: Specification[] = [
        { key: "Fuel", value: inv.fuelType || "N/A", icon: "/assets/car.svg" },
        { key: "Transmission", value: inv.transmission || "N/A", icon: "/assets/clock.svg" },
        { key: "Body", value: inv.bodyType || "N/A", icon: "/assets/briefcase.svg" },
        { key: "Drivetrain", value: inv.drivetrain || "N/A", icon: "/assets/target.svg" },
        { key: "Engine", value: String(inv.engineSize || "N/A"), icon: "/assets/trend-up.svg" },
        { key: "Seats", value: String(inv.seatingCapacity || "N/A"), icon: "/assets/users.svg" },
    ];

    return {
        id: inv.id,
        imageUrls: images,
        name,
        price: String(inv.price ?? "0"),
        description: inv.description || "No description available.",
        currency: inv.currency || "USD",
        condition: marketMode === "zero_km" ? "" : inv.condition || "",
        features: inv.features || [],
        sellerInformation: {
            id: inv.userId || "",
            name: sellerName,
            address,
        },
        vehicleDetails: [
            {
                id: invData?.id || inv.id,
                mileage,
                numberOfOwners,
                warrantyRemaining,
                inspectionReportUrl,
            },
        ],
        specificationIcons,
        isFavourite: Boolean(seed.isFavourite),
        vin: invData?.vin || "",
        brand,
        model,
        variant,
        year,
        color: inv.color || "",
        colorOptions,
        bodyType: inv.bodyType || "",
    };
};

export default async function page({
    params,
    searchParams,
}: {
    params: Promise<{ vehicleSlug: string }>;
    searchParams?: Promise<{ sellerId?: string; market?: string; units?: string }>;
}) {
    const { vehicleSlug } = await params;
    const resolvedSearchParams = await searchParams;
    const sellerIdFromQuery =
        typeof resolvedSearchParams?.sellerId === "string" ? decodeURIComponent(resolvedSearchParams.sellerId) : undefined;
    const marketMode = normalizeMarketMode(resolvedSearchParams?.market);
    const availableUnits = Math.max(1, Number(resolvedSearchParams?.units || "1") || 1);

    const filePath = path.join(process.cwd(), "data", "inventory-seed.latest.json");
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as { vehicles?: SeedVehicle[] };
    const seedVehicle = (payload.vehicles || []).find((v) => String(v?.inventory?.id || v?.id) === String(vehicleSlug));
    if (!seedVehicle) notFound();
    const data = toLocalDetailsData(seedVehicle, marketMode);
    const vin = data.vin || "";

    return (
        <main className="container mx-auto px-4 lg:px-6">
            <VehicleViewTracker vehicleId={vehicleSlug} />
            <div className="min-h-screen bg-white">
                <div className="bg-white border-b py-4 border-gray-100">
                    <Link
                        href={marketMode === "zero_km" ? "/vehicles?market=zero_km" : "/vehicles"}
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white px-6 h-9 py-2 border bg-white">
                        <ArrowLeftIcon className="h-4 w-4 mr-2" />
                        Back to Vehicle Listings
                    </Link>
                </div>
                {data && (
                    <div className="py-15">
                        <div className="lg:grid lg:grid-cols-[5fr_2fr] gap-15 items-start">
                            <div className="">
                                <div className="space-y-[21px]">
                                    <ImageCarousel images={data.imageUrls} />
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {data?.condition && (
                                            <span className="font-medium w-fit whitespace-nowrap bg-white text-gray-700 border border-gray-300 text-sm px-3 py-1.5 rounded-md shadow-sm">
                                                {data.condition}
                                            </span>
                                        )}
                                        <span
                                            className={`font-medium w-fit whitespace-nowrap border  text-sm px-3 py-1.5 rounded-md ${
                                                data.vehicleDetails.length > 1 ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-50 text-gray-600 border-gray-300"
                                            }`}>
                                            {data.vehicleDetails.length > 1 ? "Bulk Purchase available" : "Bulk Purchase unavailable"}
                                        </span>
                                        <span className="font-medium w-fit whitespace-nowrap border border-transparent bg-brand-blue text-white text-sm px-3 py-1.5 rounded-md">Verified Dealer</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-6">
                                        <ShortList inventoryId={vehicleSlug} isLike={data?.isFavourite} />
                                        <QRShare vehicleUrl={`/vehicles/${vehicleSlug}`} />
                                    </div>
                                    <div className="space-y-6">
                                        <VehicleSpecs data={data.specificationIcons} />
                                        <div className="bg-white rounded-xl border border-[rgba(36,39,44,0.1)] p-4 md:p-7.5">
                                            <h3 className="text-xl font-semibold text-black mb-4">Description</h3>
                                            <p className="text-[15px] text-[#4d4f53] leading-5.5">{data.description}</p>
                                        </div>
                                        <VehicleDetails data={data.vehicleDetails} hideInspectionReport={marketMode === "zero_km"} />
                                        {data.features.length > 0 && <FeaturesTable data={data.features} />}
                                    </div>
                                </div>
                            </div>
                            <div className="w-full space-y-6 lg:sticky lg:top-24 self-start">
                                <div className="bg-white rounded-xl border border-stroke-light p-7.5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-right flex gap-1 items-center">
                                            <div className="text-[30px] font-bold text-brand-blue">{formatPrice(data.price, data.currency)}</div>
                                            <PriceBadge />
                                        </div>
                                    </div>
                                    <div className="text-[16px] text-[#4d4f53] mb-6">{data.name}</div>
                                    {marketMode === "zero_km" ? null : (
                                        <div className="mb-6 flex flex-col gap-3">
                                            {vin ? (
                                                <a
                                                    href={`https://report.adpgauto.com/${encodeURIComponent(vin)}`}
                                                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all shrink-0 outline-none h-9 px-4 py-2 w-full border border-brand-blue text-gray-800 hover:bg-brand-blue hover:text-white"
                                                    rel="noopener noreferrer">
                                                    <FileIcon className="w-4 h-4" />
                                                    View Inspection Report
                                                </a>
                                            ) : (
                                                <Button variant="outline" className="w-full" disabled>
                                                    <FileIcon className="w-4 h-4 mr-2" />
                                                    View Inspection Report
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {marketMode === "zero_km" ? (
                                    <ZeroKmQuantityCard
                                        marketMode={marketMode}
                                        vehicleId={data.id}
                                        availableUnits={availableUnits}
                                        name={data.name}
                                        year={data.year}
                                        location={data.sellerInformation?.address || ""}
                                        price={Number(data.price) || 0}
                                        currency={data.currency || "USD"}
                                        mainImageUrl={data.imageUrls?.[0] || ""}
                                        sellerId={data.sellerInformation?.id || sellerIdFromQuery}
                                        sellerCompany={data.sellerInformation?.name || "Unknown Seller"}
                                        brand={data.brand}
                                        model={data.model}
                                        variant={data.variant}
                                        color={data.color}
                                        colorOptions={data.colorOptions}
                                        condition={data.condition}
                                        bodyType={data.bodyType}
                                    />
                                ) : null}
                                <SellerCard sellerInfo={data.sellerInformation} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}

const SellerCard = ({
    sellerInfo,
}: Readonly<{
    sellerInfo: {
        name: string;
        address: string;
        id: string;
    };
}>) => {
    return (
        <div className="bg-white rounded-xl border border-stroke-light p-7.5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-brand-blue">Seller Information</h3>
                <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1  text-brand-blue border-brand-blue">
                    Verified
                </span>
            </div>
            <div className="space-y-3">
                <div>
                    <div className="text-base font-semibold text-black">{sellerInfo.name}</div>
                    <div className="text-xs text-[#4d4f53]">{sellerInfo.address}</div>
                </div>
                <Link
                    href={`/seller-details/${sellerInfo.id}`}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all shrink-0 outline-none h-9 px-4 py-2 w-full mt-4 border border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white">
                    View Seller Profile
                </Link>
            </div>
        </div>
    );
};
