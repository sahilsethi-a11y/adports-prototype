"use client";

import { getClientMarketMode, scopedStorageKey, type MarketMode } from "@/lib/marketplace";
import { MarketType, Status, type VehicleFormValues } from "@/validation/vehicle-schema";

export type LocalInventoryRecord = {
    id: string;
    createdAt: string;
    updatedAt: string;
    form: VehicleFormValues;
};

const LOCAL_INVENTORY_KEY = "inventoryListings_local";

const generateLocalInventoryId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getModeFromMarketType = (marketType?: string | null): MarketMode =>
    marketType === MarketType.ZERO_KM ? "zero_km" : "second_hand";

const getLocalInventoryStorageKey = (mode: MarketMode) => scopedStorageKey(LOCAL_INVENTORY_KEY, mode);

const readModeRecords = (mode: MarketMode) => {
    if (typeof window === "undefined") return [] as LocalInventoryRecord[];
    try {
        const raw = window.localStorage.getItem(getLocalInventoryStorageKey(mode));
        return raw ? (JSON.parse(raw) as LocalInventoryRecord[]) : [];
    } catch {
        return [];
    }
};

const writeModeRecords = (mode: MarketMode, records: LocalInventoryRecord[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getLocalInventoryStorageKey(mode), JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("local-inventory-updated", { detail: { mode } }));
};

export const listLocalInventory = (mode = getClientMarketMode()) => readModeRecords(mode);

export const getLocalInventoryById = (id: string) => {
    if (!id) return null;
    const modes: MarketMode[] = ["second_hand", "zero_km"];
    for (const mode of modes) {
        const hit = readModeRecords(mode).find((record) => record.id === id);
        if (hit) return hit;
    }
    return null;
};

export const saveLocalInventory = (form: VehicleFormValues, status: Status) => {
    const now = new Date().toISOString();
    const id = String(form.inventoryId || generateLocalInventoryId());
    const mode = getModeFromMarketType(form.marketType);
    const nextForm: VehicleFormValues = {
        ...form,
        inventoryId: id,
        status,
    };

    const existing = getLocalInventoryById(id);
    const existingMode = existing ? getModeFromMarketType(existing.form.marketType) : mode;
    const existingCreatedAt = existing?.createdAt || now;

    if (existing && existingMode !== mode) {
        writeModeRecords(
            existingMode,
            readModeRecords(existingMode).filter((record) => record.id !== id)
        );
    }

    const currentRecords = readModeRecords(mode);
    const nextRecords = [
        {
            id,
            createdAt: existingCreatedAt,
            updatedAt: now,
            form: nextForm,
        },
        ...currentRecords.filter((record) => record.id !== id),
    ];

    writeModeRecords(mode, nextRecords);
    return id;
};

export const updateLocalInventoryStatus = (id: string, status: Status.DRAFT | Status.LIVE | Status.SOLD) => {
    const existing = getLocalInventoryById(id);
    if (!existing) return false;
    const mode = getModeFromMarketType(existing.form.marketType);
    const nextRecords = readModeRecords(mode).map((record) =>
        record.id === id
            ? {
                  ...record,
                  updatedAt: new Date().toISOString(),
                  form: {
                      ...record.form,
                      status,
                  },
              }
            : record
    );
    writeModeRecords(mode, nextRecords);
    return true;
};

export const deleteLocalInventory = (id: string) => {
    const existing = getLocalInventoryById(id);
    if (!existing) return false;
    const mode = getModeFromMarketType(existing.form.marketType);
    writeModeRecords(
        mode,
        readModeRecords(mode).filter((record) => record.id !== id)
    );
    return true;
};
