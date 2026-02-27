/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const JSON_PATH = path.join(process.cwd(), "data", "inventory-seed.latest.json");
const OUT_DIR = path.join(process.cwd(), "public", "seed-images");

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

const isBlobUrl = (value) => typeof value === "string" && value.includes("blob.core.windows.net");

const extFromContentType = (contentType) => {
  if (!contentType) return "";
  const ct = contentType.toLowerCase();
  if (ct.includes("image/jpeg") || ct.includes("image/jpg")) return ".jpg";
  if (ct.includes("image/png")) return ".png";
  if (ct.includes("image/webp")) return ".webp";
  if (ct.includes("image/gif")) return ".gif";
  if (ct.includes("image/avif")) return ".avif";
  return "";
};

const extFromUrl = (url) => {
  const clean = String(url || "").split("?")[0].toLowerCase();
  const parsed = path.extname(clean);
  if (parsed && parsed.length <= 5) return parsed;
  return "";
};

const downloadImage = async (url, keySeed) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image download failed: ${response.status} ${response.statusText} ${url}`);
  }
  const contentType = response.headers.get("content-type") || "";
  const ext = extFromContentType(contentType) || extFromUrl(url) || ".jpg";
  const hash = crypto.createHash("sha1").update(String(keySeed)).digest("hex").slice(0, 16);
  const fileName = `${hash}${ext}`;
  const absPath = path.join(OUT_DIR, fileName);
  const relPath = `/seed-images/${fileName}`;
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(absPath, bytes);
  return relPath;
};

const scrubBlobUrls = (input) => {
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i += 1) {
      const next = input[i];
      if (typeof next === "string" && isBlobUrl(next)) {
        input[i] = "";
      } else if (next && typeof next === "object") {
        scrubBlobUrls(next);
      }
    }
    return;
  }
  if (!input || typeof input !== "object") return;
  for (const key of Object.keys(input)) {
    const next = input[key];
    if (typeof next === "string" && isBlobUrl(next)) {
      input[key] = "";
    } else if (next && typeof next === "object") {
      scrubBlobUrls(next);
    }
  }
};

const pickSourceUrl = (bucket, representativeVehicle, anyBucketVehicle) => {
  const candidates = [
    bucket?.heroImageUrl,
    representativeVehicle?.inventory?.mainImageUrl,
    representativeVehicle?.inventory?.imageUrls?.[0],
    anyBucketVehicle?.inventory?.mainImageUrl,
    anyBucketVehicle?.inventory?.imageUrls?.[0],
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("http")) return candidate;
  }
  return "";
};

const run = async () => {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Missing file: ${JSON_PATH}`);
  }
  const raw = fs.readFileSync(JSON_PATH, "utf8");
  const payload = JSON.parse(raw);
  const buckets = Array.isArray(payload?.buckets) ? payload.buckets : [];
  const vehicles = Array.isArray(payload?.vehicles) ? payload.vehicles : [];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const byId = new Map();
  const byBucket = new Map();
  for (const vehicle of vehicles) {
    const id = String(vehicle?.inventory?.id ?? vehicle?.id ?? "");
    if (id) byId.set(id, vehicle);
    const key = buildBucketKey(vehicle?.inventory ?? {});
    if (!byBucket.has(key)) byBucket.set(key, []);
    byBucket.get(key).push(vehicle);
  }

  let localized = 0;
  for (const bucket of buckets) {
    const rep = byId.get(String(bucket?.representativeId ?? ""));
    const bucketVehicles = byBucket.get(String(bucket?.bucketKey ?? "")) || [];
    const sourceUrl = pickSourceUrl(bucket, rep, bucketVehicles[0]);
    if (!sourceUrl) continue;

    const localPath = await downloadImage(sourceUrl, bucket?.bucketKey || sourceUrl);
    bucket.heroImageUrl = localPath;

    for (const vehicle of bucketVehicles) {
      if (!vehicle.inventory) continue;
      vehicle.inventory.mainImageUrl = localPath;
      vehicle.inventory.imageUrls = [localPath];
    }
    localized += 1;
  }

  scrubBlobUrls(payload);

  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2));
  console.log("Localization complete");
  console.log("Buckets localized:", localized);
  console.log("Output directory:", OUT_DIR);
  console.log("Updated JSON:", JSON_PATH);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

