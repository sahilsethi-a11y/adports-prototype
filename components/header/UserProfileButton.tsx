"use client";
import { useEffect, useRef, useState } from "react";
import { UserIcon, UserCircleIcon, LogoutIcon, MessageSquareIcon } from "@/components/Icons";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import type { User } from "@/components/header/Header";
import message from "@/elements/message";
import { LOCAL_AUTH_COOKIE, LOCAL_AUTH_STORAGE_KEY } from "@/lib/localAuth";

type ApiUser = Partial<User> & {
    id?: string;
    emailId?: string;
};

const normalizeUser = (raw?: ApiUser): User | undefined => {
    if (!raw) return undefined;
    const userId = raw.userId || raw.id;
    if (!userId) return undefined;

    return {
        userId,
        username: raw.username || raw.email || raw.emailId || "",
        name: raw.name || raw.username || raw.email || raw.emailId || "",
        email: raw.email || raw.emailId || raw.username || "",
        roleType: raw.roleType || "",
        otpVerified: Boolean(raw.otpVerified),
    };
};

export default function UserProfileButton({ user }: Readonly<{ user?: User }>) {
    const [loginDropdown, setLoginDropdown] = useState(false);
    const normalizedPropUser = normalizeUser(user);
    const [hydratedUser, setHydratedUser] = useState<User | undefined>(() => {
        if (typeof window === "undefined") return undefined;
        const localRaw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
        if (!localRaw) return undefined;
        try {
            return normalizeUser(JSON.parse(localRaw) as ApiUser);
        } catch {
            window.localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
            return undefined;
        }
    });
    const ref = useRef<HTMLDivElement | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    useOutsideClick(ref, () => setLoginDropdown(false));

    useEffect(() => {
        if (normalizedPropUser?.userId) {
            return;
        }

        const syncFromLocal = () => {
            if (typeof window === "undefined") return;
            try {
                const localRaw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
                if (!localRaw) {
                    setHydratedUser(undefined);
                    return;
                }
                const parsed = normalizeUser(JSON.parse(localRaw) as ApiUser);
                setHydratedUser(parsed);
            } catch {
                setHydratedUser(undefined);
            }
        };

        const runAsync = () => {
            window.setTimeout(syncFromLocal, 0);
        };

        runAsync();
        window.addEventListener("storage", runAsync);
        window.addEventListener("adpg-auth-changed", runAsync);

        return () => {
            window.removeEventListener("storage", runAsync);
            window.removeEventListener("adpg-auth-changed", runAsync);
        };
    }, [normalizedPropUser, pathname]);

    const activeUser = normalizedPropUser ?? hydratedUser;

    const navigateToDashboard = () => {
        setLoginDropdown(false);
        switch (activeUser?.roleType?.toLowerCase()) {
            case "admin":
                router.push("/admin/dashboard");
                break;
            case "seller":
                router.push("/seller/dashboard");
                break;
            case "buyer":
                router.push("/buyer/dashboard");
                break;
            case "dealer":
                router.push("/dealer/dashboard");
                break;
            default:
                break;
        }
    };

    const logout = async () => {
        setLoginDropdown(false);
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
            document.cookie = `${LOCAL_AUTH_COOKIE}=; path=/; max-age=0; samesite=lax`;
            window.dispatchEvent(new Event("adpg-auth-changed"));
        }
        setHydratedUser(undefined);
        message.success({ title: "Logged out successfully", duration: 1000 });
        router.push("/");
        router.refresh();
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setLoginDropdown((prev) => !prev)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-md">
                <UserCircleIcon className="h-4 w-4" />
            </button>
            {loginDropdown && (
                <div className="absolute border-black/10 bg-white rounded-md border shadow-md text-brand-blue overflow-y-auto w-50 z-50 right-0 top-10">
                    {activeUser?.userId ? (
                        <>
                            <div className="px-3 py-2 border-b border-stroke-light">
                                <p className="font-medium text-sm">{activeUser.name || activeUser.username}</p>
                                <p className="text-xs text-muted-foreground">{activeUser.email}</p>
                                <span className="bg-accent inline-block mt-1 px-2 py-1 rounded-lg text-xs font-medium text-black">{activeUser.roleType}</span>
                            </div>
                            <ul>
                                <li className="p-1">
                                    <button onClick={navigateToDashboard} title="dashboard" className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent text-sm/7">
                                        <UserIcon className="h-4 w-4 mr-2 text-light-gray-4" />
                                        Dashboard
                                    </button>
                                    <Link
                                        onClick={() => setLoginDropdown(false)}
                                        href="/my-negotiations"
                                        title="My Negotiations"
                                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent text-sm/7">
                                        <MessageSquareIcon className="h-4 w-4 mr-2 text-light-gray-4" />
                                        Negotiations
                                    </Link>
                                    <button type="button" onClick={logout} className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent text-sm/7">
                                        <LogoutIcon className="h-4 w-4 mr-2 text-light-gray-4" />
                                        Logout
                                    </button>
                                </li>
                            </ul>
                        </>
                    ) : (
                        <ul>
                            <li className="p-1">
                                <Link onClick={() => setLoginDropdown(false)} href="/login" title="Login" className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent text-sm/7">
                                    <UserIcon className="h-4 w-4 mr-2 text-light-gray-4" />
                                    Login
                                </Link>
                                <Link onClick={() => setLoginDropdown(false)} href="/signup" title="signup" className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent text-sm/7">
                                    <UserCircleIcon className="h-4 w-4 mr-2 text-light-gray-4" />
                                    Sign Up
                                </Link>
                            </li>
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
