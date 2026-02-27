"use client";
import { useEffect } from "react";

interface PropsT {
    vehicleId: string;
}

export default function VehicleViewTracker({ vehicleId }: PropsT) {
    useEffect(() => {
        if (!vehicleId) return;

        const STORAGE_KEY = "last_viewed_vehicle_id";
        const VIEWS_KEY = "localVehicleViewCounts";

        try {
            const lastId = sessionStorage.getItem(STORAGE_KEY);

            if (lastId === vehicleId) return;

            sessionStorage.setItem(STORAGE_KEY, vehicleId);
            const raw = window.localStorage.getItem(VIEWS_KEY);
            const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
            map[String(vehicleId)] = Number(map[String(vehicleId)] || 0) + 1;
            window.localStorage.setItem(VIEWS_KEY, JSON.stringify(map));

        } catch (error) {
            console.error("Error accessing sessionStorage:", error);
        }

    }, [vehicleId]);

    return null;
}
