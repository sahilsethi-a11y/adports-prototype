export type LocalAuthUser = {
    userId: string;
    id: string;
    username: string;
    emailId: string;
    email: string;
    name: string;
    roleType: "buyer" | "seller";
    otpVerified: boolean;
    passwordTemporary: boolean;
};

export const LOCAL_AUTH_STORAGE_KEY = "adpg_local_auth_user";
export const LOCAL_AUTH_COOKIE = "userToken";

type DemoCredential = {
    username: string;
    password: string;
    user: LocalAuthUser;
};

export const DEMO_CREDENTIALS: DemoCredential[] = [
    {
        username: "buyer@adpg.local",
        password: "buyer123",
        user: {
            userId: "local-buyer-001",
            id: "local-buyer-001",
            username: "buyer@adpg.local",
            emailId: "buyer@adpg.local",
            email: "buyer@adpg.local",
            name: "Demo Buyer",
            roleType: "buyer",
            otpVerified: true,
            passwordTemporary: false,
        },
    },
    {
        username: "seller@adpg.local",
        password: "seller123",
        user: {
            userId: "local-seller-001",
            id: "local-seller-001",
            username: "seller@adpg.local",
            emailId: "seller@adpg.local",
            email: "seller@adpg.local",
            name: "Demo Seller",
            roleType: "seller",
            otpVerified: true,
            passwordTemporary: false,
        },
    },
];

export const getDemoUser = (username: string, password: string): LocalAuthUser | null => {
    const found = DEMO_CREDENTIALS.find((d) => d.username === username.trim().toLowerCase() && d.password === password);
    return found?.user ?? null;
};

export const getDemoUserByToken = (token?: string | null): LocalAuthUser | null => {
    if (!token) return null;
    const found = DEMO_CREDENTIALS.find((d) => d.user.userId === token || d.user.id === token);
    return found?.user ?? null;
};

