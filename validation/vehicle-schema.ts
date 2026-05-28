import { z } from "zod";

export enum Status {
    DRAFT = "DRAFT",
    UNDER_REVIEW = "UNDER_REVIEW",
    AVAILABLE = "AVAILABLE",
    // Backward-compat alias — new code should use AVAILABLE or UNDER_REVIEW
    LIVE = "AVAILABLE",
    IN_NEGOTIATION = "IN_NEGOTIATION",
    LOCKED = "LOCKED",
    SOLD = "SOLD",
    REJECTED = "REJECTED",
    ARCHIVED = "ARCHIVED",
}

export enum MarketType {
    SECOND_HAND = "second_hand",
    ZERO_KM = "zero_km",
}

export enum Incoterm {
    FOB = "FOB",
    CIF = "CIF",
    CFR = "CFR",
    EXW = "EXW",
    FCA = "FCA",
    DAP = "DAP",
    FAS = "FAS",
    DDP = "DDP",
    DPU = "DPU",
}

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9a-hj-npr-z]+$/;
export const isValidVin = (vin: string) => vin.length === 17 && VIN_REGEX.test(vin);

const isValidImagePath = (value: string) => {
    if (!value) return false;
    if (value.startsWith("/")) return true;
    try { new URL(value); return true; } catch { return false; }
};

// ─── Feature categories ───────────────────────────────────────────────────────

export const FeatureCategoriesSchema = z.object({
    interior: z.object({
        seatMaterial: z.array(z.string()),
        seatFeatures: z.array(z.string()),
    }),
    exterior: z.object({
        wheels: z.array(z.string()),
        lighting: z.array(z.string()),
        roof: z.array(z.string()),
    }),
    technology: z.object({
        connectivity: z.array(z.string()),
        display: z.array(z.string()),
        audio: z.array(z.string()),
    }),
    safety: z.object({
        core: z.array(z.string()),
        advanced: z.array(z.string()),
    }),
    comfort: z.object({
        climate: z.array(z.string()),
        access: z.array(z.string()),
    }),
});

export type FeatureCategories = z.infer<typeof FeatureCategoriesSchema>;

export const emptyFeatureCategories: FeatureCategories = {
    interior: { seatMaterial: [], seatFeatures: [] },
    exterior: { wheels: [], lighting: [], roof: [] },
    technology: { connectivity: [], display: [], audio: [] },
    safety: { core: [], advanced: [] },
    comfort: { climate: [], access: [] },
};

// ─── VehicleInfo (per color config or single 2H unit) ─────────────────────────

export const VehicleInfoSchema = z.object({
    id: z.string().optional(),
    mileage: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).max(1000000).optional()
    ),
    vin: z.string().optional(),
    vinList: z.array(z.string()).optional(),
    registrationNumber: z.string().max(20).optional(),
    numberOfOwners: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(1).max(10).optional()
    ),
    warrantyRemaining: z.string().max(100).optional(),
    inspectionReportUrl: z.string().optional().or(z.literal("")),
    color: z.string().optional(),
    availableQuantity: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(1).optional()
    ),
    unitPrice: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).optional()
    ),
    incoterm: z.nativeEnum(Incoterm).optional(),
    fobPrice: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).optional()
    ),
    fobPortOfLoading: z.string().optional(),
    cifPrice: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).optional()
    ),
    cifPortOfDestination: z.string().optional(),
});

const VehiclesArraySchema = z.array(VehicleInfoSchema).min(1, "Add at least one vehicle entry");

// ─── Base schema (minimal — draft validation) ─────────────────────────────────

export const baseSchema = z.object({
    inventoryId: z.string().optional(),
    marketType: z.enum(MarketType, { message: "Please select vehicle type" }),
    status: z.nativeEnum(Status),
    // VIN
    vin: z.string().optional(),
    vinLookupStatus: z.enum([
        "idle", "found", "not_found",
        "duplicate_same_seller", "duplicate_other_seller",
        "blocked_negotiation", "blocked_sold",
    ]).optional(),
    vinLookupMessage: z.string().optional(),
    vinLookupProvider: z.string().optional(),
    chaboschiLockedFields: z.array(z.string()).optional(),
    // Inspection metadata
    inspectionSummary: z.string().optional(),
    inspectionProvider: z.string().optional(),
    inspectionDateNote: z.string().optional(),
    vehicleDescription: z.string().optional(),
    fetchedMileage: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).optional()
    ),
    // Vehicle identity
    vehicleType: z.string().optional(),
    countryOfOrigin: z.string().optional(),
    brand: z.string().min(1, "Please select a vehicle make"),
    model: z.string().min(1, "Please select a vehicle model"),
    variant: z.string().min(1, "Please select a vehicle variant"),
    year: z.preprocess(
        Number,
        z.number().min(1900, "Please enter a valid year").max(new Date().getFullYear(), `Year cannot be in the future`)
    ),
    regionalSpecs: z.string().min(1, "Please select regional specifications"),
    bodyType: z.string().min(1, "Please select vehicle body type"),
    condition: z.string().optional(),
    conditionSource: z.enum(["chaboschi", "manual"]).optional(),
    color: z.string().optional(),
    city: z.string().min(1, "Please select city"),
    country: z.string().min(1, "Please select country"),
    // Commercial
    maxDiscountMargin: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).max(100).optional()
    ),
    price: z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
        z.number().min(0).optional()
    ),
    allowPriceNegotiations: z.boolean().nullable().optional(),
    negotiationNotes: z.string().nullable().optional(),
    currency: z.string().optional(),
    // Tech specs
    fuelType: z.string().optional(),
    transmission: z.string().optional(),
    drivetrain: z.string().optional(),
    engineSize: z.string().optional(),
    batterySize: z.string().optional(),
    electricRange: z.string().optional(),
    cylinders: z.preprocess(Number, z.number().max(16).optional()),
    horsepower: z.preprocess(Number, z.number().max(2000).optional()),
    seatingCapacity: z.preprocess(Number, z.number().max(15).optional()),
    numberOfDoors: z.preprocess(Number, z.number().max(6).optional()),
    // Dimensions (optional, mm)
    vehicleLength: z.string().optional(),
    vehicleWidth: z.string().optional(),
    vehicleHeight: z.string().optional(),
    vehicleWheelbase: z.string().optional(),
    // Features
    featureCategories: FeatureCategoriesSchema.optional(),
    features: z.array(z.string()).optional(),
    // Images
    imageUrls: z.array(z.string()).optional(),
    mainImageUrl: z.string().optional(),
    description: z.string().optional(),
    // Vehicles array
    vehicles: z.array(VehicleInfoSchema).optional(),
});

// ─── Full listing schema (publish validation) ──────────────────────────────────

const fullListingObjectSchema = baseSchema.extend({
    imageUrls: z.array(z.string()).min(1, "Please upload at least one image").max(20),
    mainImageUrl: z.string().refine(isValidImagePath, "Please select a main image"),
    featureCategories: FeatureCategoriesSchema,
    vehicles: VehiclesArraySchema,
});

export const fullListingSchema = fullListingObjectSchema.superRefine((data, ctx) => {
    if (data.marketType === MarketType.SECOND_HAND) {
        if (!data.condition?.trim()) {
            ctx.addIssue({ code: "custom", message: "Please select vehicle condition", path: ["condition"] });
        }
        if (!data.color?.trim()) {
            ctx.addIssue({ code: "custom", message: "Please select color", path: ["color"] });
        }
        if (!data.price || data.price < 1) {
            ctx.addIssue({ code: "custom", message: "Price must be greater than 0", path: ["price"] });
        }
        const vinCount = new Map<string, number>();
        for (const v of data.vehicles) {
            const n = (v.vin || "").trim().toUpperCase();
            if (n) vinCount.set(n, (vinCount.get(n) ?? 0) + 1);
        }
        for (const [i, v] of data.vehicles.entries()) {
            const vin = (v.vin || "").trim().toUpperCase();
            if (!vin) ctx.addIssue({ code: "custom", message: "Please enter VIN", path: ["vehicles", i, "vin"] });
            else if (!isValidVin(vin)) ctx.addIssue({ code: "custom", message: "Please enter a valid 17-character VIN", path: ["vehicles", i, "vin"] });
            else if ((vinCount.get(vin) ?? 0) > 1) ctx.addIssue({ code: "custom", message: "Duplicate VIN", path: ["vehicles", i, "vin"] });
            if (v.mileage === undefined || v.mileage < 0) {
                ctx.addIssue({ code: "custom", message: "Please enter valid mileage", path: ["vehicles", i, "mileage"] });
            }
            if (v.incoterm === Incoterm.FOB) {
                if (!v.fobPrice) ctx.addIssue({ code: "custom", message: "Enter FOB price", path: ["vehicles", i, "fobPrice"] });
                if (!v.fobPortOfLoading?.trim()) ctx.addIssue({ code: "custom", message: "Enter port of loading", path: ["vehicles", i, "fobPortOfLoading"] });
            }
            if (v.incoterm === Incoterm.CIF) {
                if (!v.cifPrice) ctx.addIssue({ code: "custom", message: "Enter CIF price", path: ["vehicles", i, "cifPrice"] });
                if (!v.cifPortOfDestination?.trim()) ctx.addIssue({ code: "custom", message: "Enter port of destination", path: ["vehicles", i, "cifPortOfDestination"] });
            }
        }
        return;
    }

    // Zero-km
    const vinCount = new Map<string, number>();
    for (const v of data.vehicles) {
        for (const vi of v.vinList || []) {
            const n = (vi || "").trim().toUpperCase();
            if (n) vinCount.set(n, (vinCount.get(n) ?? 0) + 1);
        }
    }
    for (const [i, v] of data.vehicles.entries()) {
        if (!v.color?.trim()) {
            ctx.addIssue({ code: "custom", message: "Select color for this configuration", path: ["vehicles", i, "color"] });
        }
        if (v.mileage !== undefined && v.mileage > 100) {
            ctx.addIssue({ code: "custom", message: "Zero-km mileage cannot exceed 100 km", path: ["vehicles", i, "mileage"] });
        }
        for (const [vi, vinItem] of (v.vinList || []).entries()) {
            const n = (vinItem || "").trim().toUpperCase();
            if (!n) continue;
            if (!isValidVin(n)) ctx.addIssue({ code: "custom", message: "Invalid 17-character VIN", path: ["vehicles", i, "vinList", vi] });
            else if ((vinCount.get(n) ?? 0) > 1) ctx.addIssue({ code: "custom", message: "Duplicate VIN", path: ["vehicles", i, "vinList", vi] });
        }
    }
    const hasCommercial = data.vehicles.some((v) => (v.fobPrice ?? 0) > 0 || (v.cifPrice ?? 0) > 0);
    if (hasCommercial && !data.currency?.trim()) {
        ctx.addIssue({ code: "custom", message: "Please select currency", path: ["currency"] });
    }
});

export type VehicleFormValues = z.infer<typeof fullListingSchema>;

// ─── Step schemas ─────────────────────────────────────────────────────────────

export const step1IdentitySchema = baseSchema.pick({
    marketType: true, brand: true, model: true, variant: true, year: true,
    regionalSpecs: true, bodyType: true, country: true, city: true,
}).extend({
    color: z.string().optional(),
    vehicleType: z.string().optional(),
    countryOfOrigin: z.string().optional(),
});

export const step2DetailsSchema = z.object({
    vehicles: z.array(VehicleInfoSchema).min(1, "Add at least one vehicle entry"),
    description: z.string().optional(),
    condition: z.string().optional(),
});

export const step3CommercialSchema = z.object({
    currency: z.string().optional(),
    price: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(0).optional()),
    maxDiscountMargin: z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(0).max(100).optional()),
    vehicles: z.array(VehicleInfoSchema).min(1),
    allowPriceNegotiations: z.boolean().nullable().optional(),
    negotiationNotes: z.string().nullable().optional(),
});

export const step4TechSpecsSchema = z.object({
    fuelType: z.string().optional(),
    transmission: z.string().optional(),
    drivetrain: z.string().optional(),
    engineSize: z.string().optional(),
    batterySize: z.string().optional(),
    electricRange: z.string().optional(),
    cylinders: z.preprocess(Number, z.number().max(16).optional()),
    horsepower: z.preprocess(Number, z.number().max(2000).optional()),
    seatingCapacity: z.preprocess(Number, z.number().max(15).optional()),
    numberOfDoors: z.preprocess(Number, z.number().max(6).optional()),
    vehicleLength: z.string().optional(),
    vehicleWidth: z.string().optional(),
    vehicleHeight: z.string().optional(),
    vehicleWheelbase: z.string().optional(),
});

export const step5FeaturesSchema = z.object({
    featureCategories: FeatureCategoriesSchema.optional(),
});

export const step6ImagesSchema = z.object({
    imageUrls: z.array(z.string()).min(1, "Please upload at least one image"),
    mainImageUrl: z.string().refine(isValidImagePath, "Please select a main image"),
});

// ─── Backward-compat aliases ──────────────────────────────────────────────────

export const basicInfoFormSchema = step1IdentitySchema;
export const detailFormSchema = step2DetailsSchema;
export const featureFormSchema = step5FeaturesSchema;
export const imageFormSchema = step6ImagesSchema;
export const priceFormSchema = step3CommercialSchema;
