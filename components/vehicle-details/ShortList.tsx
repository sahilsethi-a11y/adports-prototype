"use client";
import { HeartIcon } from "@/components/Icons";
import { useState } from "react";
type PropsT = {
    inventoryId?: string;
    onlyHeart?: boolean;
    cls?: string;
    isLike: boolean;
    iconCls?: string;
};

export default function ShortList({
    onlyHeart = false,
    cls,
    iconCls = "w-5 h-5",
    inventoryId,
    isLike: initialIsLike = false,
}: Readonly<PropsT>) {
    const [isLike, setIsLike] = useState(initialIsLike);
    const STORAGE_KEY = "localShortlistedInventoryIds";

    const readLocalShortlist = () => {
        if (typeof window === "undefined") return new Set<string>();
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? (JSON.parse(raw) as string[]) : [];
            return new Set(parsed.map(String));
        } catch {
            return new Set<string>();
        }
    };

    const writeLocalShortlist = (set: Set<string>) => {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
        } catch {}
    };

    const handleShortList = async () => {
        const id = String(inventoryId || "");
        if (!id) return;
        const shortlist = readLocalShortlist();
        if (shortlist.has(id)) {
            shortlist.delete(id);
            writeLocalShortlist(shortlist);
            setIsLike(false);
            return;
        }
        shortlist.add(id);
        writeLocalShortlist(shortlist);
        setIsLike(true);
    };
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                handleShortList();
            }}
            className={`flex items-center gap-2  ${
                isLike ? "text-brand-blue" : "text-[#8f9193]"
            } ${cls}`}
        >
            <HeartIcon
                className={`${iconCls} ${isLike ? "fill-current" : ""}`}
            />
            {!onlyHeart && <span className="text-sm">Shortlist</span>}
        </button>
    );
}
