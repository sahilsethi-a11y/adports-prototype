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

const normalizeRef = (value: string) => value.trim().toLowerCase();

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
    return api.get<{ data: Record<string, unknown> }>("/masters/api/filters/map", { cacheRevalidate: 300 }); // 300 seconds or 5 min cache
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
