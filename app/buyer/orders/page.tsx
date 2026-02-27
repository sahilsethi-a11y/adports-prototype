import NegotiationOrdersSection from "@/components/buyer/NegotiationOrdersSection";
import MarketplaceSwitch from "@/components/MarketplaceSwitch";
import { cookies } from "next/headers";
import { MARKET_MODE_COOKIE_KEY, normalizeMarketMode } from "@/lib/marketplace";

export default async function Orders({
    searchParams,
}: Readonly<PageProps<"/buyer/orders">>) {
    const cookieStore = await cookies();
    const querySearchParams = await searchParams;
    const marketMode = normalizeMarketMode(
        (querySearchParams as Record<string, string | undefined>)?.market ||
            cookieStore.get(MARKET_MODE_COOKIE_KEY)?.value
    );

    return (
        <div>
            <div className="mb-6">
                <h2 className="text-xl text-[#202C4A]">Order Management</h2>
                <MarketplaceSwitch mode={marketMode} compact className="mb-3 max-w-sm" />
                <p className="text-gray-600">Track and manage your vehicle orders</p>
            </div>
            <NegotiationOrdersSection role="buyer" />
        </div>
    );
}
