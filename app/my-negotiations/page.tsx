import NegotiationList, { type Negotiation } from "@/components/negotiations/NegotiationList";
import { cookies } from "next/headers";
import Link from "next/link";
import { getDemoUserByToken } from "@/lib/localAuth";
import { MARKET_MODE_COOKIE_KEY, normalizeMarketMode } from "@/lib/marketplace";
import MarketplaceSwitch from "@/components/MarketplaceSwitch";

export default async function MyNegotiations({ searchParams }: Readonly<PageProps<"/my-negotiations">>) {
    const cookieStore = await cookies();
    const tokenValue = cookieStore.get("userToken")?.value || "";
    const querySearchParams = await searchParams;
    const marketMode = normalizeMarketMode(
        (querySearchParams as Record<string, string | undefined>)?.market || cookieStore.get(MARKET_MODE_COOKIE_KEY)?.value
    );
    const localUser = getDemoUserByToken(tokenValue);
    const roleType = localUser?.roleType;
    const resolvedUserId = localUser?.userId || tokenValue;
    const data: Negotiation = {
        content: [],
        currentPage: 1,
        first: true,
        last: true,
        size: 10,
        totalItems: 0,
        totalPages: 1,
    };

    // Local-only negotiations mode: list is hydrated on client from local negotiation index.

    return (
        <main className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl text-brand-blue mb-2">My Negotiations</h1>
                <MarketplaceSwitch mode={marketMode} compact className="mb-3 max-w-sm" />
                <p className="text-gray-600">Track your ongoing vehicle negotiations and agreements</p>
            </div>
            <NegotiationList data={data} userId={resolvedUserId} roleType={roleType} marketMode={marketMode} />
            {!data?.content?.length ? (
                <div className="text-center text-gray-600 mt-20 p-8 rounded-lg border border-dashed border-gray-300">
                    <p className="mb-4">You have no negotiations at the moment.</p>
                    <p>
                        Browse{" "}
                        <Link className="text-brand-blue underline" href="/vehicles">
                            vehicles
                        </Link>{" "}
                        and start negotiating today!
                    </p>
                </div>
            ) : null}
        </main>
    );
}
