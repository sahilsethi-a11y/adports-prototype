"use client";
import { useState } from "react";
import SignIn from "@/components/login/SignIn";
import VerifyOtp from "@/components/login/VerifyOtp";
import { useRouter } from "next/navigation";
import { LOCAL_AUTH_COOKIE, LOCAL_AUTH_STORAGE_KEY } from "@/lib/localAuth";

export type User = {
    emailId: string;
    id?: string;
    username?: string;
    phoneNumber?: string;
    passwordTemporary?: boolean;
    roleId?: string;
    roleType?: string;
};

export default function LoginForm({ redirectUrl }: Readonly<{ redirectUrl?: string }>) {
    const [step, setStep] = useState<"signIn" | "verifyOtp">("signIn");
    const [user, setUser] = useState<User>();
    const router = useRouter();

    const persistLocalSession = (activeUser?: User) => {
        if (typeof window === "undefined" || !activeUser) return;

        const userId = activeUser.id || activeUser.username || activeUser.emailId;
        if (!userId) return;

        const username = activeUser.username || activeUser.emailId || "";
        const email = activeUser.emailId || activeUser.username || "";
        const roleType = (activeUser.roleType || "buyer").toLowerCase();

        const normalizedUser = {
            userId,
            id: userId,
            username,
            emailId: email,
            email,
            name: username || email,
            roleType,
            otpVerified: true,
            passwordTemporary: Boolean(activeUser.passwordTemporary),
        };

        window.localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(normalizedUser));
        document.cookie = `${LOCAL_AUTH_COOKIE}=${encodeURIComponent(userId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        window.dispatchEvent(new Event("adpg-auth-changed"));
    };

    const routeByRole = (activeUser?: User, opts?: { hardRedirect?: boolean }) => {
        if (!activeUser) return;
        const pushTo = (href: string) => {
            if (opts?.hardRedirect && typeof window !== "undefined") {
                window.location.assign(href);
                return;
            }
            router.push(href);
            router.refresh();
        };

        if (redirectUrl) {
            pushTo(redirectUrl);
            return;
        }
        switch (activeUser.roleType?.toLowerCase()) {
            case "admin":
                pushTo("/admin/dashboard");
                break;
            case "seller":
                pushTo("/seller/dashboard");
                break;
            case "buyer":
                pushTo("/buyer/dashboard");
                break;
            case "dealer":
                pushTo("/dealer/dashboard");
                break;
            default:
                break;
        }
    };

    const signInCallback = (nextUser: User, opts?: { skipOtp?: boolean }) => {
        setUser(nextUser);
        if (opts?.skipOtp) {
            persistLocalSession(nextUser);
            routeByRole(nextUser, { hardRedirect: true });
            return;
        }
        setUser(nextUser);
        setStep("verifyOtp");
    };

    const verifyOtpCallback = () => {
        persistLocalSession(user);
        if (user?.passwordTemporary) {
            router.push("/reset-password");
            return;
        }
        routeByRole(user);
    };

    const renderStep = () => {
        switch (step) {
            case "signIn":
                return <SignIn successCallback={signInCallback} />;
            case "verifyOtp":
                return <VerifyOtp actionType="login" successCallback={verifyOtpCallback} handleBack={() => setStep("signIn")} user={user} />;
            default:
                return <></>;
        }
    };

    return <div className="px-4 py-8 bg-gray-50">{renderStep()}</div>;
}
