import TransactionOrderPage from "@/components/orders/TransactionOrderPage";

export default async function BuyerOrderTransactionPage({ params }: Readonly<{ params: Promise<{ conversationId: string }> }>) {
    const { conversationId } = await params;
    return <TransactionOrderPage conversationId={conversationId} role="buyer" />;
}
