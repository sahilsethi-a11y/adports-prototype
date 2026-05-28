import { cache } from "react";
import { api } from "@/lib/api/client-request";

export type Brand = {
    displayName: string;
    id: string;
    name: string;
};

export type Model = {
    displayName: string;
    id: string;
    modelId: string;
    modelName: string;
};

export type Variant = {
    id: string;
    variantName: string;
    oemId: string;
    modelId: string;
};

type FilterOption = {
    label: string;
    value: string;
    hex?: string;
};

type FilterMap = Record<string, unknown>;

const FALLBACK_CITIES_BY_COUNTRY: Record<string, { id: string; name: string }[]> = {
    AE: [
        { id: "ae-dubai", name: "Dubai" },
        { id: "ae-abu-dhabi", name: "Abu Dhabi" },
        { id: "ae-sharjah", name: "Sharjah" },
        { id: "ae-ajman", name: "Ajman" },
        { id: "ae-ras-al-khaimah", name: "Ras Al Khaimah" },
        { id: "ae-fujairah", name: "Fujairah" },
        { id: "ae-umm-al-quwain", name: "Umm Al Quwain" },
    ],
    CN: [
        { id: "cn-shanghai", name: "Shanghai" },
        { id: "cn-beijing", name: "Beijing" },
        { id: "cn-guangzhou", name: "Guangzhou" },
        { id: "cn-shenzhen", name: "Shenzhen" },
        { id: "cn-hangzhou", name: "Hangzhou" },
        { id: "cn-ningbo", name: "Ningbo" },
        { id: "cn-qingdao", name: "Qingdao" },
    ],
};

const FALLBACK_BRAND_MODEL_VARIANTS: Record<string, Record<string, string[]>> = {
    byd: {
        "Qin Plus": ["Hybrid", "EV", "DM-i"],
        Han: ["EV", "DM-i"],
        Song: ["Plus DM-i", "Pro"],
    },
    toyota: {
        Corolla: ["LE", "XLE", "Hybrid"],
        Levin: ["TNGA 1.5L CVT", "Hybrid"],
        Camry: ["SE", "XSE"],
    },
    nissan: {
        Patrol: ["SE", "LE", "NISMO"],
        Altima: ["S", "SV", "SL"],
    },
    kia: {
        Sportage: ["LX", "EX", "GT-Line"],
        K5: ["LXS", "GT-Line"],
    },
    hyundai: {
        Elantra: ["SE", "SEL", "Limited"],
        Tucson: ["SE", "SEL", "N Line"],
    },
    honda: {
        Civic: ["LX", "EX", "Sport"],
        Accord: ["EX", "Touring"],
    },
};

const FALLBACK_FILTERS: Record<string, FilterOption[]> = {
    country: [
        { label: "United Arab Emirates", value: "AE" },
        { label: "China", value: "CN" },
        { label: "India", value: "IN" },
        { label: "Saudi Arabia", value: "SA" },
        { label: "Oman", value: "OM" },
        { label: "Qatar", value: "QA" },
        { label: "Bahrain", value: "BH" },
        { label: "Kuwait", value: "KW" },
    ],
    bodyType: [
        { label: "Sedan", value: "Sedan" },
        { label: "SUV", value: "SUV" },
        { label: "Hatchback", value: "Hatchback" },
        { label: "Coupe", value: "Coupe" },
        { label: "Convertible", value: "Convertible" },
        { label: "Pickup", value: "Pickup" },
        { label: "Van", value: "Van" },
        { label: "Wagon", value: "Wagon" },
    ],
    fuelTypeOptions: [
        { label: "Petrol", value: "Petrol" },
        { label: "Diesel", value: "Diesel" },
        { label: "Hybrid", value: "Hybrid" },
        { label: "Electric", value: "Electric" },
        { label: "Plug-in Hybrid", value: "Plug-in Hybrid" },
        { label: "CNG", value: "CNG" },
    ],
    transmissionOptions: [
        { label: "Automatic", value: "Automatic" },
        { label: "Manual", value: "Manual" },
        { label: "CVT", value: "CVT" },
        { label: "DCT", value: "DCT" },
    ],
    regionalSpecsOptions: [
        { label: "GCC Specs", value: "GCC Specs" },
        { label: "American Specs", value: "American Specs" },
        { label: "European Specs", value: "European Specs" },
        { label: "Japanese Specs", value: "Japanese Specs" },
        { label: "Chinese Specs", value: "Chinese Specs" },
        { label: "Korean Specs", value: "Korean Specs" },
    ],
    drivetrainOptions: [
        { label: "FWD", value: "FWD" },
        { label: "RWD", value: "RWD" },
        { label: "AWD", value: "AWD" },
        { label: "4WD", value: "4WD" },
    ],
    bodyConditionOptions: [
        { label: "New", value: "New" },
        { label: "Excellent", value: "Excellent" },
        { label: "Good", value: "Good" },
        { label: "Fair", value: "Fair" },
    ],
    currency: [
        { label: "AED", value: "AED" },
        { label: "USD", value: "USD" },
        { label: "CNY", value: "CNY" },
        { label: "OMR", value: "OMR" },
        { label: "SAR", value: "SAR" },
    ],
    colors: [
        { label: "White", value: "White", hex: "#F8FAFC" },
        { label: "Black", value: "Black", hex: "#111827" },
        { label: "Silver", value: "Silver", hex: "#CBD5E1" },
        { label: "Gray", value: "Gray", hex: "#6B7280" },
        { label: "Blue", value: "Blue", hex: "#2563EB" },
        { label: "Red", value: "Red", hex: "#DC2626" },
    ],
};

const normalizeRef = (value: string) => value.trim().toLowerCase();

const isOptionArray = (value: unknown): value is FilterOption[] =>
    Array.isArray(value) &&
    value.every((item) => typeof item === "object" && item !== null && "value" in item && "label" in item);

const cloneFallback = (key: keyof typeof FALLBACK_FILTERS): FilterOption[] => FALLBACK_FILTERS[key].map((item) => ({ ...item }));

const firstOptionArray = (data: FilterMap, keys: string[], fallbackKey?: keyof typeof FALLBACK_FILTERS): FilterOption[] => {
    for (const key of keys) {
        const value = data[key];
        if (isOptionArray(value) && value.length > 0) {
            return value;
        }
    }
    return fallbackKey ? cloneFallback(fallbackKey) : [];
};

const normalizeFilters = (data?: FilterMap | null): FilterMap => {
    const raw = data ?? {};

    return {
        ...raw,
        country: firstOptionArray(raw, ["country", "countryOptions", "countries", "locationCountries"], "country"),
        bodyType: firstOptionArray(raw, ["bodyType", "bodyTypeOptions", "bodyTypes"], "bodyType"),
        fuelTypeOptions: firstOptionArray(raw, ["fuelTypeOptions", "fuelType", "fuelTypes"], "fuelTypeOptions"),
        transmissionOptions: firstOptionArray(raw, ["transmissionOptions", "transmission", "transmissions"], "transmissionOptions"),
        regionalSpecsOptions: firstOptionArray(raw, ["regionalSpecsOptions", "regionalSpecs", "specsOptions"], "regionalSpecsOptions"),
        drivetrainOptions: firstOptionArray(raw, ["drivetrainOptions", "drivetrain", "drivetrains"], "drivetrainOptions"),
        bodyConditionOptions: firstOptionArray(raw, ["bodyConditionOptions", "bodyCondition", "conditionOptions"], "bodyConditionOptions"),
        currency: firstOptionArray(raw, ["currency", "currencyOptions", "currencies"], "currency"),
        colors: firstOptionArray(raw, ["colors", "colorOptions"], "colors"),
    };
};

const FALLBACK_BRANDS: Brand[] = Object.keys(FALLBACK_BRAND_MODEL_VARIANTS).map((brand) => ({
    id: brand,
    name: brand.charAt(0).toUpperCase() + brand.slice(1),
    displayName: brand.charAt(0).toUpperCase() + brand.slice(1),
}));

const getFallbackModels = (brand: string): Model[] => {
    const key = normalizeRef(brand);
    const models = FALLBACK_BRAND_MODEL_VARIANTS[key];
    if (!models) return [];
    return Object.keys(models).map((modelName) => ({
        id: `${key}-${normalizeRef(modelName).replace(/\s+/g, "-")}`,
        displayName: modelName,
        modelId: modelName,
        modelName,
    }));
};

const getFallbackVariants = (model: string): Variant[] => {
    const normalizedModel = normalizeRef(model);
    const hit = Object.entries(FALLBACK_BRAND_MODEL_VARIANTS).find(([, modelMap]) =>
        Object.keys(modelMap).some((name) => normalizeRef(name) === normalizedModel)
    );
    if (!hit) return [];
    const [brandKey, modelMap] = hit;
    const modelName = Object.keys(modelMap).find((name) => normalizeRef(name) === normalizedModel);
    if (!modelName) return [];

    return modelMap[modelName].map((variantName) => ({
        id: `${brandKey}-${normalizeRef(modelName).replace(/\s+/g, "-")}-${normalizeRef(variantName).replace(/\s+/g, "-")}`,
        variantName,
        oemId: brandKey,
        modelId: modelName,
    }));
};

export const getFilters = async () => {
    try {
        const res = await api.get<{ data: Record<string, unknown> }>("/masters/api/filters/map", { cacheRevalidate: 300 }); // 300 seconds or 5 min cache
        return { ...res, data: normalizeFilters(res.data) };
    } catch {
        return { data: normalizeFilters() };
    }
};

export const getBrands = cache(async () => {
    try {
        return await api.get<{ data: Brand[] }>("/masters/api/v1/mtoc/brands");
    } catch {
        return { data: FALLBACK_BRANDS };
    }
});

export const getModals = cache(async (brand: string) => {
    try {
        const res = await api.get<{ data: Model[] }>("/masters/api/v1/mtoc/brands/models", { params: { ref: brand } });
        if (res?.data?.length) return res;
        return { data: getFallbackModels(brand) };
    } catch {
        return { data: getFallbackModels(brand) };
    }
});

export const getVariants = cache(async (model: string) => {
    try {
        const res = await api.get<{ data: Variant[] }>("/masters/api/v1/mtoc/models/variants", { params: { ref: model } });
        if (res?.data?.length) return res;
        return { data: getFallbackVariants(model) };
    } catch {
        return { data: getFallbackVariants(model) };
    }
});

export const getCountryDetails = cache(async (countryCode: string) => {
    try {
        return await api.get<{ data: { id: string }[] }>("/masters/api/v1/locations/roots/" + countryCode);
    } catch {
        return { data: [] };
    }
});

export const getCities = cache(async (countryCode: string) => {
    const normalizedCode = (countryCode || "").trim().toUpperCase();
    try {
        const res = await getCountryDetails(normalizedCode);
        const countryId = res.data?.[0]?.id;
        if (!countryId) {
            return { data: FALLBACK_CITIES_BY_COUNTRY[normalizedCode] ?? [] };
        }

        const cities = await api.get<{ data: { id: string; name: string }[] }>(`/masters/api/v1/locations/${countryId}/children`);
        if (!cities?.data?.length) {
            return { data: FALLBACK_CITIES_BY_COUNTRY[normalizedCode] ?? [] };
        }
        return cities;
    } catch {
        return { data: FALLBACK_CITIES_BY_COUNTRY[normalizedCode] ?? [] };
    }
});

export const uploadFile = async <T>(file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    return api.post<T>("/users/api/v1/users/upload", { body: formData });
};

// ─── Feature options (predefined, PRD §9.9) ───────────────────────────────────

export const FEATURE_OPTIONS = {
    interior: {
        seatMaterial: [
            "Leather", "Semi-Leather", "Fabric", "Alcantara",
            "Synthetic Leather", "Nappa Leather", "Suede",
        ],
        seatFeatures: [
            "Heated Front Seats", "Cooled Front Seats", "Heated Rear Seats",
            "Power Adjustable (Driver)", "Power Adjustable (Passenger)",
            "Memory Seats", "Massage Seats", "Lumbar Support",
            "Ventilated Front Seats", "Reclining Rear Seats",
        ],
    },
    exterior: {
        wheels: [
            "17\" Alloy", "18\" Alloy", "19\" Alloy", "20\" Alloy",
            "21\" Alloy", "22\" Alloy", "Steel Wheels",
            "Diamond-Cut Alloys", "Run-Flat Tyres",
        ],
        lighting: [
            "LED Headlights", "Xenon Headlights", "Laser Headlights",
            "Adaptive Headlights", "LED DRLs", "Ambient Lighting",
            "Rear LED Lights", "Fog Lights", "Matrix LED",
        ],
        roof: [
            "Sunroof", "Panoramic Sunroof", "Moonroof",
            "Convertible Roof", "Glass Roof", "Fixed Roof", "Retractable Hardtop",
        ],
    },
    technology: {
        connectivity: [
            "Bluetooth", "Apple CarPlay", "Android Auto",
            "Wireless Charging", "Wi-Fi Hotspot", "USB-A", "USB-C",
            "NFC Key", "OTA Updates",
        ],
        display: [
            "7\" Touchscreen", "8\" Touchscreen", "10\" Touchscreen",
            "12\" Touchscreen", "14\" Touchscreen",
            "HUD (Head-Up Display)", "Digital Instrument Cluster",
            "Dual Screen", "Rear Seat Screens", "Augmented Reality HUD",
        ],
        audio: [
            "4-Speaker System", "6-Speaker System", "8-Speaker System",
            "Bose", "Harman Kardon", "Bang & Olufsen",
            "Sony Premium Audio", "Meridian", "Burmester",
            "Active Noise Cancellation",
        ],
    },
    safety: {
        core: [
            "ABS", "ESC (Electronic Stability Control)",
            "Front Airbags", "Side Airbags", "Curtain Airbags", "Knee Airbag",
            "Rear Parking Sensors", "Front Parking Sensors",
            "Rear Camera", "360° Camera", "ISOFIX",
        ],
        advanced: [
            "Adaptive Cruise Control", "Lane Keep Assist",
            "Lane Departure Warning", "Blind Spot Monitor",
            "Automatic Emergency Braking", "Forward Collision Warning",
            "Rear Cross-Traffic Alert", "Driver Attention Monitor",
            "Traffic Sign Recognition", "Pedestrian Detection",
            "Night Vision",
        ],
    },
    comfort: {
        climate: [
            "Dual-Zone Climate Control", "Tri-Zone Climate Control",
            "Quad-Zone Climate Control", "Rear AC Vents",
            "Rear Seat Heater Controls", "Air Purifier",
        ],
        access: [
            "Keyless Entry", "Push-Button Start", "Remote Start",
            "Auto-Fold Mirrors", "Power Tailgate",
            "Foot-Activated Tailgate", "Soft-Close Doors",
            "Auto-Dimming Mirrors", "Rain-Sensing Wipers", "Auto Headlights",
        ],
    },
} as const;

export const VEHICLE_TYPES = [
    "Sedan", "SUV", "Pickup Truck", "Hatchback", "Coupe",
    "Crossover", "Van", "Minivan", "Convertible", "Wagon",
    "Sports Car", "Electric Vehicle", "Other",
];

export const COUNTRIES_OF_ORIGIN = [
    { label: "United Arab Emirates", value: "AE" },
    { label: "China", value: "CN" },
    { label: "Japan", value: "JP" },
    { label: "South Korea", value: "KR" },
    { label: "Germany", value: "DE" },
    { label: "United States", value: "US" },
    { label: "United Kingdom", value: "GB" },
    { label: "France", value: "FR" },
    { label: "Italy", value: "IT" },
    { label: "Sweden", value: "SE" },
    { label: "Czech Republic", value: "CZ" },
    { label: "Mexico", value: "MX" },
    { label: "India", value: "IN" },
    { label: "Thailand", value: "TH" },
    { label: "Malaysia", value: "MY" },
];
