import InventoryTab, { Data } from "@/components/seller/InventoryTab";
import { getBrands, getFilters } from "@/lib/data";

export default async function Inventory() {
    const brandRes = getBrands();
    const filterRes = getFilters();
    const [brandData, filterData] = await Promise.all([brandRes, filterRes]);
    const emptyData: Data = {
        content: [],
        first: true,
        last: true,
        number: false,
        size: 10,
        totalPages: 1,
        currentPage: 1,
        totalItems: 0,
    };

    return (
        <main>
            <InventoryTab data={emptyData} filterData={filterData.data} brands={brandData.data} />
        </main>
    );
}
