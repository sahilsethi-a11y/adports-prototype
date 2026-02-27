"use client";

import Button from "@/elements/Button";
import { MessageSquareIcon } from "@/components/Icons";
import message from "@/elements/message";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getDemoUserByToken, LOCAL_AUTH_COOKIE, LOCAL_AUTH_STORAGE_KEY, type LocalAuthUser } from "@/lib/localAuth";
import { getClientMarketMode, scopedStorageKey } from "@/lib/marketplace";

type User = {
    name: string;
    username: string;
    email: string;
    roleType: string;
    userId: string;
    otpVerified: boolean;
};

export default function NegotiatePriceButton({
    vehicleId,
    peerId,
    sellerName,
}: Readonly<{ vehicleId: string; peerId: string; sellerName?: string }>) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [disabled, setDisabled] = useState(false);
    const pathname = usePathname();

    const createConversationId = (buyerId: string, marketMode: string) => {
        if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
            return `${buyerId}_${peerId}_${vehicleId}_${marketMode}_${crypto.randomUUID()}`;
        }
        return `${buyerId}_${peerId}_${vehicleId}_${marketMode}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    };

    const handleNegotiatePrice = async () => {
        try {
            setLoading(true);
            let activeUser: User | null = null;
            if (typeof window !== "undefined") {
                try {
                    const raw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
                    const localUser = raw ? (JSON.parse(raw) as LocalAuthUser) : null;
                    if (localUser?.roleType) {
                        activeUser = {
                            name: localUser.name,
                            username: localUser.username,
                            email: localUser.email,
                            roleType: localUser.roleType,
                            userId: localUser.userId,
                            otpVerified: true,
                        };
                    }
                } catch {}
                if (!activeUser) {
                    const token = document.cookie
                        .split("; ")
                        .find((row) => row.startsWith(`${LOCAL_AUTH_COOKIE}=`))
                        ?.split("=")[1];
                    const cookieUser = getDemoUserByToken(token ? decodeURIComponent(token) : null);
                    if (cookieUser?.roleType) {
                        activeUser = {
                            name: cookieUser.name,
                            username: cookieUser.username,
                            email: cookieUser.email,
                            roleType: cookieUser.roleType,
                            userId: cookieUser.userId,
                            otpVerified: true,
                        };
                        window.localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(cookieUser));
                    }
                }
            }

            if (activeUser?.roleType?.toLocaleLowerCase() === "buyer") {
                if (typeof window !== "undefined") {
                    document.cookie = `${LOCAL_AUTH_COOKIE}=${encodeURIComponent(activeUser.userId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
                }
                const buyerName = activeUser.name || activeUser.username;
                const marketMode = getClientMarketMode();
                const NEGOTIATIONS_LOCAL_KEY = scopedStorageKey("negotiationsByConversation_local", marketMode);
                const conversationId = createConversationId(activeUser.userId, marketMode);
                if (typeof window !== "undefined") {
                    try {
                        const raw = window.localStorage.getItem(NEGOTIATIONS_LOCAL_KEY);
                        const map = raw ? (JSON.parse(raw) as Record<string, any>) : {};
                        const prev = map[conversationId] ?? {};
                        map[conversationId] = {
                            ...prev,
                            conversationId,
                            buyerId: activeUser.userId,
                            sellerId: peerId,
                            itemId: vehicleId,
                            roleType: "buyer",
                            buyerName,
                            sellerName,
                            status: prev.status || "ongoing",
                            marketMode,
                            startedAt: prev.startedAt || new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        };
                        window.localStorage.setItem(NEGOTIATIONS_LOCAL_KEY, JSON.stringify(map));
                    } catch {}
                }
                router.push(`/my-negotiations/${conversationId}?market=${marketMode}`);
            } else {
                message.info("Only buyers can negotiate the price.");
                setDisabled(true);
            }
        } catch {
            message.info("Please login to negotiate the price.");
            router.push("/login?redirectUrl=" + encodeURIComponent(pathname));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="outline" disabled={disabled} className="w-full" loading={loading} onClick={() => handleNegotiatePrice()}>
            <MessageSquareIcon className="w-4 h-4 mr-2" />
            Start quotation
        </Button>
    );
}
