import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import fs from "fs/promises";
import path from "path";

const baseUrl = process.env.NEXT_PUBLIC_JSONBIN_BASE_URL || "https://api.jsonbin.io/v3";
const masterKey = process.env.JSONBIN_MASTER_KEY || process.env.NEXT_PUBLIC_JSONBIN_MASTER_KEY;
const binId = process.env.JSONBIN_BIN_ID;

type RecordShape = {
    cartsByConversation?: Record<string, unknown>;
    ordersByConversation?: Record<string, unknown>;
};

const LOCAL_STORE_FILE = path.join(process.cwd(), "data", "negotiation-store.local.json");

async function readBin(): Promise<RecordShape> {
    if (!masterKey || !binId) {
        throw new Error("Missing JSONBIN_MASTER_KEY (or NEXT_PUBLIC_JSONBIN_MASTER_KEY) or JSONBIN_BIN_ID");
    }
    const res = await fetch(`${baseUrl}/b/${binId}/latest`, {
        headers: {
            "X-Master-Key": masterKey,
        },
        cache: "no-store",
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`JSONBin read failed: ${res.status} ${res.statusText} ${text}`);
    }

    const data = await res.json();
    return data?.record ?? {};
}

async function writeBin(record: RecordShape) {
    if (!masterKey || !binId) {
        throw new Error("Missing JSONBIN_MASTER_KEY (or NEXT_PUBLIC_JSONBIN_MASTER_KEY) or JSONBIN_BIN_ID");
    }
    const res = await fetch(`${baseUrl}/b/${binId}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            "X-Master-Key": masterKey,
        },
        body: JSON.stringify(record),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`JSONBin write failed: ${res.status} ${res.statusText} ${text}`);
    }
}

async function readLocalStore(): Promise<RecordShape> {
    try {
        const raw = await fs.readFile(LOCAL_STORE_FILE, "utf8");
        const parsed = JSON.parse(raw) as RecordShape;
        return {
            cartsByConversation: parsed.cartsByConversation ?? {},
            ordersByConversation: parsed.ordersByConversation ?? {},
        };
    } catch {
        return {
            cartsByConversation: {},
            ordersByConversation: {},
        };
    }
}

async function writeLocalStore(record: RecordShape) {
    await fs.writeFile(
        LOCAL_STORE_FILE,
        JSON.stringify(
            {
                cartsByConversation: record.cartsByConversation ?? {},
                ordersByConversation: record.ordersByConversation ?? {},
            },
            null,
            2
        ),
        "utf8"
    );
}

async function readStore(): Promise<{ record: RecordShape; source: "bin" | "local" }> {
    try {
        const record = await readBin();
        return { record, source: "bin" };
    } catch {
        const record = await readLocalStore();
        return { record, source: "local" };
    }
}

async function writeStore(record: RecordShape, source: "bin" | "local") {
    if (source === "bin") {
        try {
            await writeBin(record);
            return;
        } catch {
            await writeLocalStore(record);
            return;
        }
    }
    await writeLocalStore(record);
}

async function readMergedStore(): Promise<{ record: RecordShape; source: "bin" | "local" }> {
    const local = await readLocalStore();
    try {
        const bin = await readBin();
        return {
            source: "bin",
            record: {
                cartsByConversation: {
                    ...(local.cartsByConversation ?? {}),
                    ...(bin.cartsByConversation ?? {}),
                },
                ordersByConversation: {
                    ...(local.ordersByConversation ?? {}),
                    ...(bin.ordersByConversation ?? {}),
                },
            },
        };
    } catch {
        return { record: local, source: "local" };
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get("role") || "buyer";
        const userId = (await cookies()).get("userToken")?.value || "";
        const { record } = await readMergedStore();
        const orders = record?.ordersByConversation ?? {};

        const list = Object.values(orders).filter((o: any) => {
            if (!userId) return false;
            if (o?.isDemoVisibleToAll === true) return true;
            if (role === "seller") return o?.sellerId === userId;
            return o?.buyerId === userId;
        });

        return NextResponse.json({ orders: list });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            conversationId?: string;
            seedDemo?: boolean;
            orderPayload?: Record<string, unknown>;
        };

        const { record, source } = await readStore();
        const orders = record?.ordersByConversation ?? {};
        const carts = record?.cartsByConversation ?? {};

        if (body?.seedDemo) {
            const demoConversationId = `demo-order-${Date.now()}`;
            const demoOrder = {
                conversationId: demoConversationId,
                buyerId: "local-buyer-001",
                sellerId: "local-seller-001",
                logisticsPartner: "UGR",
                items: [
                    {
                        bucketKey: "demo-bucket-001",
                        name: "2024 Toyota Camry 2.5L",
                        totalUnits: 2,
                        unitPrice: 5756,
                        currency: "USD",
                        discountPercent: 0,
                        total: 11512,
                    },
                ],
                totals: {
                    total: 11512,
                    downpayment: 1151.2,
                    pending: 10360.8,
                },
                status: "confirmed-order",
                createdAt: new Date().toISOString(),
                isDemoVisibleToAll: true,
            };

            await writeStore(
                {
                    ...record,
                    ordersByConversation: {
                        ...orders,
                        [demoConversationId]: demoOrder,
                    },
                },
                source
            );

            return NextResponse.json({ status: "OK", conversationId: demoConversationId });
        }

        if (!body?.conversationId) {
            return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
        }

        if (body.orderPayload) {
            const payload = body.orderPayload as any;
            const nextOrders = {
                ...orders,
                [body.conversationId]: {
                    ...payload,
                    conversationId: body.conversationId,
                    status: "confirmed-order",
                    createdAt: new Date().toISOString(),
                },
            };
            await writeStore(
                {
                    ...record,
                    ordersByConversation: nextOrders,
                },
                source
            );
            return NextResponse.json({ status: "OK", conversationId: body.conversationId });
        }

        const cart = (carts as Record<string, any>)[body.conversationId];
        if (!cart) {
            return NextResponse.json({ error: "Cart not found" }, { status: 404 });
        }

        const nextOrders = {
            ...orders,
            [body.conversationId]: {
                ...cart,
                status: "confirmed-order",
                createdAt: new Date().toISOString(),
            },
        };

        const nextCarts = { ...carts };
        delete (nextCarts as Record<string, unknown>)[body.conversationId];

        await writeStore(
            {
                ...record,
                cartsByConversation: nextCarts,
                ordersByConversation: nextOrders,
            },
            source
        );

        return NextResponse.json({ status: "OK" });
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}
