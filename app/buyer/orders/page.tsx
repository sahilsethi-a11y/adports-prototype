import NegotiationOrdersSection from "@/components/buyer/NegotiationOrdersSection";

export default async function Orders({
}: Readonly<PageProps<"/buyer/orders">>) {
    return (
        <div>
            <div className="mb-6">
                <h2 className="text-xl text-[#202C4A]">Order Management</h2>
                <p className="text-gray-600">Track and manage your vehicle orders</p>
            </div>
            <NegotiationOrdersSection role="buyer" />
        </div>
    );
}
