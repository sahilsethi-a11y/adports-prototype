import { ArrowLeftIcon } from "@/components/Icons";
import { NegotiationInfo, type Message } from "@/components/negotiations/Conversation";
import NegotiationClientWrapper from "@/components/negotiations/NegotiationClientWrapper";
import Link from "next/link";
import { cookies } from "next/headers";
import { getDemoUserByToken } from "@/lib/localAuth";
import { MARKET_MODE_COOKIE_KEY, normalizeMarketMode } from "@/lib/marketplace";

type Vehicle = {
    id: string;
    brand: string;
    model: string;
    variant: string;
    currency: string;
    mainImageUrl: string;
    imageUrls: string[];
    price: number;
    status: string;
    year: string;
};

type Data = {
    vehicle: Vehicle;
    conversation: {
        chats: Message[];
    };
    user: {
        organisationName: string;
    };
    negotiationInfo: NegotiationInfo;
};

const buildLocalVehicle = (vehicleId: string): Vehicle => ({
    id: vehicleId,
    brand: "Vehicle",
    model: "Group",
    variant: "",
    currency: "USD",
    mainImageUrl: "/seed-images/01a925d2f23d5cc8.jpg",
    imageUrls: ["/seed-images/01a925d2f23d5cc8.jpg"],
    price: 0,
    status: "LIVE",
    year: new Date().getFullYear().toString(),
});

export default async function MyConversation({
    params,
    searchParams,
}: {
    params: Promise<{ conversationId: string }>;
    searchParams?: Promise<{ seller?: string; market?: string }>;
}) {
    const cookieStore = await cookies();
    const tokenValue = cookieStore.get("userToken")?.value || "";
    const localUser = getDemoUserByToken(tokenValue);

    const { conversationId } = await params;
    const searchParamsResolved = await searchParams;
    const marketMode = normalizeMarketMode(searchParamsResolved?.market || cookieStore.get(MARKET_MODE_COOKIE_KEY)?.value);
    const userData: { data?: { roleType?: string; userId?: string } } = {
        data: {
            roleType: localUser?.roleType,
            userId: localUser?.userId || tokenValue,
        },
    };
    const resolvedUserId = userData.data?.userId || tokenValue;
    const sellerQuery = typeof searchParamsResolved?.seller === "string" ? decodeURIComponent(searchParamsResolved.seller) : "";
    const sellerId = conversationId.split("_")[1] ?? "";
    const fallbackVehicleId = conversationId.split("_")[2] ?? "";
    const resolvedVehicleId = fallbackVehicleId;
    const localData: Data = {
        vehicle: buildLocalVehicle(resolvedVehicleId),
        conversation: { chats: [] },
        user: { organisationName: sellerQuery || "Seller" },
        negotiationInfo: {
            started: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            status: "ongoing",
            agreedPrice: "",
            agreedPriceLocked: false,
            userPrice: "",
            userPriceLocked: false,
            roleType: userData.data?.roleType || "buyer",
        },
    };

    return (
        <main className="container mx-auto px-4 py-8 max-w-7xl min-h-screen flex flex-col pb-32">
            <div className="flex md:items-center md:flex-row space-x-4 flex-col gap-4 items-start mb-8">
                <Link
                    title="Back to negotiations"
                    href={`/my-negotiations?market=${marketMode}`}
                    className="rounded-lg hover:bg-accent md:px-2 hover:text-brand-blue flex items-center justify-center gap-2 text-xs py-2 text-brand-blue">
                    <ArrowLeftIcon className="h-3.5 w-3.5" /> Back to Conversations
                </Link>
            </div>

            {/* Main layout: Left column (items + conversation) + Right column (status + proposal) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
                {/* Client Wrapper - Manages shared discount state */}
                <NegotiationClientWrapper
                    negotiationStatus={localData.negotiationInfo?.status}
                    negotiationInfo={localData.negotiationInfo}
                    initialChats={localData.conversation?.chats ?? []}
                    currency={localData.vehicle?.currency || "USD"}
                    sellerName={sellerQuery}
                    sellerId={sellerId}
                    userId={resolvedUserId}
                    role={userData.data?.roleType}
                    enableRoleToggle={true}
                    conversationId={conversationId}
                    vehicleId={resolvedVehicleId}
                    marketMode={marketMode}
                />
            </div>
        </main>
    );
}
