import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    turbopack: {
        root: path.resolve(__dirname),
    },
    logging: {
        fetches: {
            fullUrl: true,
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
            {
                protocol: "https",
                hostname: "preprodblobadp.blob.core.windows.net",
            },
            {
                protocol: "https",
                hostname: "example.com",
            },
            {
                protocol: "https",
                hostname: "images.jato.com",
            },
        ],
    },
};

export default nextConfig;
