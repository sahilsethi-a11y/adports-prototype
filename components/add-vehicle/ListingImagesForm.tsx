"use client";

import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, UploadIcon } from "@/components/Icons";
import { Dispatch, SetStateAction } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import Image from "@/elements/Image";
import message from "@/elements/message";
import { uploadFile } from "@/lib/data";
import Button from "@/elements/Button";
import { ZodTreeError } from "@/validation/shared-schema";
import { getJatoImageUrls } from "@/lib/jato";

const MAX_IMAGES = 10;
const LOCAL_ZERO_KM_SEED = ["/seed-images/01a925d2f23d5cc8.jpg", "/seed-images/17fdcb05542259d5.jpg"];

type PropsT = {
    formState: FormState;
    updateFormField: (name: keyof FormState, value: unknown) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    errors?: ZodTreeError;
};

export default function ListingImagesForm({ formState, updateFormField, setStep, handleSubmit, errors }: Readonly<PropsT>) {
    const isZeroKm = formState.marketType === "zero_km";
    const images = formState.imageUrls || [];
    const mainImage = formState.mainImageUrl || "";
    const hasChaboschiImages = !isZeroKm && formState.vinLookupStatus === "found" && images.length > 0;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        if (images.length + files.length > MAX_IMAGES) {
            message.error(`Maximum ${MAX_IMAGES} images allowed.`);
            e.target.value = "";
            return;
        }
        try {
            const uploads = await Promise.all(
                Array.from(files).map((file) => uploadFile<{ data: { fileLocation: string } }>(file))
            );
            const newImages = [...images, ...uploads.map((r) => r.data.fileLocation)];
            updateFormField("imageUrls", newImages);
            if (!mainImage && newImages.length) updateFormField("mainImageUrl", newImages[0]);
            e.target.value = "";
        } catch {
            message.error("Failed to upload image(s)");
        }
    };

    const removeImage = (img: string) => {
        const next = images.filter((i) => i !== img);
        updateFormField("imageUrls", next);
        if (img === mainImage) updateFormField("mainImageUrl", next[0] || "");
    };

    const loadManufacturerImages = () => {
        if (isZeroKm) {
            updateFormField("imageUrls", LOCAL_ZERO_KM_SEED);
            updateFormField("mainImageUrl", LOCAL_ZERO_KM_SEED[0]);
            message.success("Manufacturer images loaded.");
            return;
        }
        const urls = getJatoImageUrls({
            make: formState.brand,
            model: formState.model,
            variant: formState.variant,
            year: formState.year,
            defaultColor: formState.color,
            vehicleColors: (formState.vehicles || []).map((v) => v.color || ""),
        });
        if (!urls.length) {
            message.error("Unable to resolve manufacturer images.");
            return;
        }
        updateFormField("imageUrls", urls);
        updateFormField("mainImageUrl", urls[0]);
        message.success("Manufacturer images loaded.");
    };

    return (
        <div>
            <div className="border rounded-xl p-4 mb-6 border-stroke-light">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-brand-blue">Vehicle Images</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Upload up to {MAX_IMAGES} images ({images.length}/{MAX_IMAGES})
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="ghost" onClick={loadManufacturerImages} className="border-brand-blue">
                            {isZeroKm ? "Use Manufacturer Images" : "Load JATO Images"}
                        </Button>
                        <label className="justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all text-primary-foreground h-9 px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 flex items-center text-white cursor-pointer">
                            <UploadIcon className="h-4 w-4" /> Upload
                            <input name="image" type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*" />
                        </label>
                    </div>
                </div>

                {/* Info banners */}
                {hasChaboschiImages && (
                    <div className="mb-4 rounded-lg border border-brand-blue/20 bg-brand-blue/5 px-3 py-2 text-xs text-brand-blue">
                        🔵 Images were pre-loaded from the Chaboschi inspection report. You can keep them or upload replacements.
                    </div>
                )}
                {isZeroKm && (
                    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                        For zero-km vehicles, you can use manufacturer reference images or upload your own per-color photos.
                    </div>
                )}

                {/* Errors */}
                {[
                    ...(errors?.properties?.imageUrls?.errors ?? []),
                    ...(errors?.properties?.mainImageUrl?.errors ?? []),
                ].map((err: string) => (
                    <span key={err} className="text-xs text-destructive mb-2 block">{err}</span>
                ))}

                {/* Image grid */}
                {images.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {images.map((img) => (
                            <div key={img} className="relative h-48 w-full group rounded-lg overflow-hidden border border-stroke-light">
                                <Image
                                    fill
                                    height={192}
                                    width={192}
                                    src={img}
                                    alt="vehicle image"
                                    className="object-cover"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                                <button
                                    onClick={() => removeImage(img)}
                                    type="button"
                                    className="hidden group-hover:flex absolute top-2 right-2 p-1.5 cursor-pointer bg-red-600 text-white rounded-md hover:bg-red-700 z-10">
                                    <CloseIcon className="h-3 w-3" />
                                </button>
                                {mainImage !== img && (
                                    <button
                                        onClick={() => updateFormField("mainImageUrl", img)}
                                        type="button"
                                        className="hidden group-hover:block cursor-pointer absolute inset-x-0 bottom-0 py-1.5 text-xs text-white bg-black/50 backdrop-blur-sm text-center hover:bg-black/70 z-10">
                                        Set as main
                                    </button>
                                )}
                                {mainImage === img && (
                                    <span className="absolute bottom-2 left-2 rounded-lg bg-brand-blue px-2 py-0.5 text-[10px] font-semibold text-white">
                                        Main Image
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted py-16 text-center">
                        <UploadIcon className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No images yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Click Upload or load manufacturer images</p>
                    </div>
                )}
            </div>

            <div className="pt-6 border-t border-stroke-light flex justify-between">
                <Button type="button" variant="ghost" leftIcon={<ArrowLeftIcon className="h-3.5 w-3.5" />} onClick={() => setStep((p) => p - 1)}>
                    Previous
                </Button>
                <Button type="button" rightIcon={<ArrowRightIcon className="h-3.5 w-3.5" />} onClick={handleSubmit}>
                    Next
                </Button>
            </div>
        </div>
    );
}
