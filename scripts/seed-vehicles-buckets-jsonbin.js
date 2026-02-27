/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const ENV_FILE = path.join(process.cwd(), ".env.local");

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries = lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const rawValue = line.slice(idx + 1).trim();
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      return [key, value];
    });
  return Object.fromEntries(entries);
};

const envFile = parseEnvFile(ENV_FILE);
const env = { ...envFile, ...process.env };

const API_DOMAIN = env.NEXT_PUBLIC_API_DOMAIN;
if (!API_DOMAIN) {
  console.error("Missing NEXT_PUBLIC_API_DOMAIN");
  process.exit(1);
}

const safeStr = (v) => (typeof v === "string" ? v.trim() : "");
const safeNum = (v) => (typeof v === "number" ? v : Number(v));

const buildBucketKey = (inv) => {
  const brand = safeStr(inv?.brand).toLowerCase();
  const model = safeStr(inv?.model).toLowerCase();
  const variant = safeStr(inv?.variant).toLowerCase();
  const color = safeStr(inv?.color).toLowerCase();
  const year = safeNum(inv?.year);
  const condition = safeStr(inv?.condition).toLowerCase();
  const bodyType = safeStr(inv?.bodyType).toLowerCase();
  return [brand, model, variant, color, year, condition, bodyType].join("|");
};

const toBucketMeta = (vehicles, limitIds = 30) => {
  const map = new Map();
  for (const item of vehicles) {
    const inv = item?.inventory ?? {};
    const key = buildBucketKey(inv);
    if (!key) continue;
    const price = Number(inv?.price) || 0;
    const currency = safeStr(inv?.currency) || undefined;
    const id = inv?.id ?? item?.id;
    const sellerId = inv?.userId ?? item?.user?.userId;
    const sellerName = item?.user?.roleMetaData?.companyName || item?.user?.roleMetaData?.dealershipName || undefined;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        bucketKey: key,
        representativeId: id ? String(id) : undefined,
        sellerId,
        sellerName,
        brand: safeStr(inv?.brand) || undefined,
        model: safeStr(inv?.model) || undefined,
        variant: safeStr(inv?.variant) || undefined,
        color: safeStr(inv?.color) || undefined,
        year: safeNum(inv?.year) || undefined,
        condition: safeStr(inv?.condition) || undefined,
        bodyType: safeStr(inv?.bodyType) || undefined,
        count: 1,
        minPrice: price,
        maxPrice: price,
        currency,
        heroImageUrl: inv?.mainImageUrl || undefined,
        vehicleIds: id ? [String(id)] : [],
      });
    } else {
      existing.count += 1;
      existing.minPrice = Math.min(existing.minPrice, price);
      existing.maxPrice = Math.max(existing.maxPrice, price);
      existing.currency = existing.currency || currency;
      if (!existing.heroImageUrl && inv?.mainImageUrl) existing.heroImageUrl = inv.mainImageUrl;
      if (id && (!existing.vehicleIds || existing.vehicleIds.length < limitIds)) {
        existing.vehicleIds = existing.vehicleIds ? [...existing.vehicleIds, String(id)] : [String(id)];
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
};

const fetchInventoryPage = async (page) => {
  const url = `${API_DOMAIN}/inventory/api/v1/inventory/search?page=${page}&size=12`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Inventory fetch failed for page ${page}: ${res.status} ${res.statusText} ${text}`);
  }
  const json = await res.json();
  return json?.data ?? {};
};

const bucketFromSingleVehicle = (item) => {
  const inv = item?.inventory ?? {};
  const id = inv?.id ?? item?.id;
  const sellerName = item?.user?.roleMetaData?.companyName || item?.user?.roleMetaData?.dealershipName || undefined;
  const price = Number(inv?.price) || 0;
  return {
    bucketKey: `${buildBucketKey(inv)}|unit:${String(id ?? "")}`,
    representativeId: id ? String(id) : undefined,
    sellerId: inv?.userId ?? item?.user?.userId,
    sellerName,
    brand: safeStr(inv?.brand) || undefined,
    model: safeStr(inv?.model) || undefined,
    variant: safeStr(inv?.variant) || undefined,
    color: safeStr(inv?.color) || undefined,
    year: safeNum(inv?.year) || undefined,
    condition: safeStr(inv?.condition) || undefined,
    bodyType: safeStr(inv?.bodyType) || undefined,
    count: 1,
    minPrice: price,
    maxPrice: price,
    currency: safeStr(inv?.currency) || undefined,
    heroImageUrl: inv?.mainImageUrl || undefined,
    vehicleIds: id ? [String(id)] : [],
  };
};

const run = async () => {
  const firstPage = await fetchInventoryPage(1);
  const totalPages = Number(firstPage?.totalPages ?? 1);
  const vehicles = [...(firstPage?.content ?? [])];

  const batchSize = 6;
  const remainingPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
  for (let i = 0; i < remainingPages.length; i += batchSize) {
    const batch = remainingPages.slice(i, i + batchSize);
    const results = await Promise.all(batch.map((page) => fetchInventoryPage(page)));
    for (const pageData of results) {
      const list = pageData?.content ?? [];
      vehicles.push(...list);
    }
  }
  const deduped = [];
  const seen = new Set();
  for (const item of vehicles) {
    const id = String(item?.inventory?.id ?? item?.id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(item);
  }

  const grouped = toBucketMeta(deduped, 30);
  const buckets = [...grouped];

  if (buckets.length < 24) {
    const seen = new Set(buckets.map((b) => b.bucketKey));
    for (const v of deduped) {
      if (buckets.length >= 24) break;
      const fallback = bucketFromSingleVehicle(v);
      if (seen.has(fallback.bucketKey)) continue;
      seen.add(fallback.bucketKey);
      buckets.push(fallback);
    }
  }

  const buckets24 = buckets.slice(0, 24);
  const selectedBucketKeys = new Set(buckets24.map((b) => b.bucketKey));
  const selectedVehicles = deduped.filter((item) => selectedBucketKeys.has(buildBucketKey(item?.inventory ?? {})));

  const payload = {
    source: "inventory-backend",
    pagesFetched: totalPages,
    requestedBuckets: 24,
    fetchedVehicles: deduped.length,
    selectedVehicles: selectedVehicles.length,
    generatedAt: new Date().toISOString(),
    vehicles: selectedVehicles,
    buckets: buckets24,
  };

  const outPath = path.join(process.cwd(), "data", "inventory-seed.latest.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  console.log("Seed complete");
  console.log("Vehicles fetched:", vehicles.length);
  console.log("Buckets stored:", buckets24.length);
  console.log("Local snapshot:", outPath);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
