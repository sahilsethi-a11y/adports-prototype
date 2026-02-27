import CartPageClient from "@/components/buyer/CartPageClient";
import { type Cart } from "@/components/buyer/CartList";
import { cookies } from "next/headers";
import { MARKET_MODE_COOKIE_KEY, normalizeMarketMode } from "@/lib/marketplace";

export default async function MyCart() {
    const cookieStore = await cookies();
    const marketMode = normalizeMarketMode(cookieStore.get(MARKET_MODE_COOKIE_KEY)?.value);
    return (
        <main className="container mx-auto px-4 lg:px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl text-brand-blue">My Cart</h1>
            </div>
            <CartPageClient list={[] as Cart[]} marketMode={marketMode} />
        </main>
    );
}
