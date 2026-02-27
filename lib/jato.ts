type JatoImageInput = {
    make: string;
    model: string;
    variant: string;
    year: number | string;
    color: string;
};

const JATO_IMAGE_BASE_URL = process.env.NEXT_PUBLIC_JATO_IMAGE_BASE_URL || "https://images.jato.com";

export const buildJatoImageUrl = (input: JatoImageInput) => {
    const params = new URLSearchParams({
        make: input.make,
        model: input.model,
        variant: input.variant,
        year: String(input.year),
        color: input.color,
    });

    return `${JATO_IMAGE_BASE_URL}/vehicle-image?${params.toString()}`;
};

export const getJatoImageUrls = (params: {
    make: string;
    model: string;
    variant: string;
    year: number | string;
    defaultColor?: string;
    vehicleColors?: string[];
}) => {
    const colors = Array.from(new Set([...(params.vehicleColors || []), params.defaultColor || ""].map((i) => i.trim()).filter(Boolean)));

    return colors.map((color) =>
        buildJatoImageUrl({
            make: params.make,
            model: params.model,
            variant: params.variant,
            year: params.year,
            color,
        })
    );
};
