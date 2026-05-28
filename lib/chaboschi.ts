export type VinLookupDemoMode = "found" | "not_found";

export type ChaboschiFoundRecord = {
    status: "found";
    provider: "Chaboschi";
    vin: string;
    make: string;
    model: string;
    variant: string;
    year: number;
    vehicleType: string;
    countryOfOrigin: string;
    regionalSpecs: string;
    bodyType: string;
    condition: string;
    mileage: number;
    inspectionSummary: string;
    inspectionProvider: string;
    inspectionDateNote: string;
    vehicleDescription: string;
    imageUrls: string[];
};

export type ChaboschiNotFoundRecord = {
    status: "not_found";
    provider: "Chaboschi";
    vin: string;
    warning: string;
};

export type ChaboschiLookupResult = ChaboschiFoundRecord | ChaboschiNotFoundRecord;

const FOUND_IMAGES = ["/seed-images/416c696dd76a1961.jpg", "/seed-images/822c80bb0b4eb6f9.jpg", "/seed-images/a1eec190c7ae0854.jpg"];
export async function lookupVinOnChaboschi(vin: string, demoMode: VinLookupDemoMode): Promise<ChaboschiLookupResult> {
    await new Promise((resolve) => setTimeout(resolve, 700));

    if (demoMode === "not_found") {
        return {
            status: "not_found",
            provider: "Chaboschi",
            vin,
            warning: "VIN was not found on Chaboschi. No inspection report is available, but you can continue with manual entry.",
        };
    }

    return {
        status: "found",
        provider: "Chaboschi",
        vin,
        make: "Toyota",
        model: "Land Cruiser",
        variant: "GXR V6",
        year: 2022,
        vehicleType: "SUV",
        countryOfOrigin: "Japan",
        regionalSpecs: "GCC",
        bodyType: "SUV",
        condition: "Grade C - Fair",
        mileage: 55000,
        inspectionSummary: "No major accident history detected\nNo fire damage detected",
        inspectionProvider: "Chaboschi",
        inspectionDateNote: "March 31, 2026",
        vehicleDescription:
            "This 2022 Toyota Levin is rated Grade C (Fair). The vehicle has higher mileage, typical for commercial or high-use vehicles. Vehicle in fair condition with some cosmetic damage and wear.",
        imageUrls: FOUND_IMAGES,
    };
}
