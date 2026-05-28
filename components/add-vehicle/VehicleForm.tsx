"use client";

import { ChangeEvent, FormEvent, JSX, useEffect, useReducer, useState } from "react";
import { DollerIcon, EyeIcon, FileIcon, SettingIcon, StarIcon, UploadIcon } from "@/components/Icons";
import Stepper from "@/components/add-vehicle/Stepper";
import VehicleIdentityForm from "@/components/add-vehicle/VehicleIdentityForm";
import VehicleDetailsForm from "@/components/add-vehicle/VehicleDetailsForm";
import CommercialDetailsForm from "@/components/add-vehicle/CommercialDetailsForm";
import TechSpecsForm from "@/components/add-vehicle/TechSpecsForm";
import FeaturesChecklistForm from "@/components/add-vehicle/FeaturesChecklistForm";
import ListingImagesForm from "@/components/add-vehicle/ListingImagesForm";
import ReviewForm from "@/components/add-vehicle/ReviewForm";
import { useRouter, usePathname } from "next/navigation";

import { type Brand } from "@/lib/data";
import { z } from "zod";
import { scrollToField } from "@/lib/utils";

import {
    baseSchema,
    step1IdentitySchema,
    step2DetailsSchema,
    step3CommercialSchema,
    step4TechSpecsSchema,
    step5FeaturesSchema,
    step6ImagesSchema,
    fullListingSchema,
    MarketType,
    Status,
    VehicleInfoSchema,
    emptyFeatureCategories,
    type VehicleFormValues,
    type FeatureCategories,
} from "@/validation/vehicle-schema";
import message from "@/elements/message";
import Button from "@/elements/Button";
import { clearFieldError, type ZodTreeError } from "@/validation/shared-schema";
import { getLocalInventoryById, saveLocalInventory } from "@/lib/localInventory";

type PropsT = {
    topSection: JSX.Element;
    brands?: Brand[];
    filterData?: Record<string, unknown>;
    intialData?: FormState;
    listingId?: string;
    step: string;
    initialMarketType?: MarketType;
};

export type Step = {
    label: string;
    icon: JSX.Element;
};

export type FormState = VehicleFormValues;
export type VehicleInfo = z.infer<typeof VehicleInfoSchema>;

type FormAction =
    | { type: "UPDATE_FIELD"; field: keyof FormState; value: unknown }
    | { type: "SET_ALL"; fields: FormState }
    | { type: "RESET" };

const initialFormState: FormState = {
    marketType: MarketType.SECOND_HAND,
    status: Status.DRAFT,
    vin: "",
    vinLookupStatus: "idle",
    vinLookupMessage: "",
    vinLookupProvider: "",
    chaboschiLockedFields: [],
    inspectionSummary: "",
    inspectionProvider: "",
    inspectionDateNote: "",
    vehicleDescription: "",
    fetchedMileage: undefined,
    vehicleType: "",
    countryOfOrigin: "",
    brand: "",
    model: "",
    variant: "",
    year: 0,
    regionalSpecs: "",
    bodyType: "",
    condition: "",
    conditionSource: undefined,
    color: "",
    city: "",
    country: "",
    maxDiscountMargin: undefined,
    price: 0,
    allowPriceNegotiations: false,
    negotiationNotes: "",
    currency: "",
    fuelType: "",
    transmission: "",
    drivetrain: "",
    engineSize: "",
    batterySize: "",
    electricRange: "",
    cylinders: 0,
    horsepower: 0,
    seatingCapacity: 0,
    numberOfDoors: 0,
    vehicleLength: "",
    vehicleWidth: "",
    vehicleHeight: "",
    vehicleWheelbase: "",
    featureCategories: emptyFeatureCategories,
    features: [],
    imageUrls: [],
    mainImageUrl: "",
    description: "",
    vehicles: [],
};

function formReducer(state: FormState, action: FormAction): FormState {
    switch (action.type) {
        case "UPDATE_FIELD":
            return { ...state, [action.field]: action.value };
        case "SET_ALL":
            return action.fields;
        case "RESET":
            return initialFormState;
        default:
            return state;
    }
}

const steps: Step[] = [
    { label: "Identity", icon: <FileIcon className="h-4.5 w-4.5" /> },
    { label: "Details", icon: <SettingIcon className="h-4.5 w-4.5" /> },
    { label: "Commercial", icon: <DollerIcon className="h-4.5 w-4.5" /> },
    { label: "Tech Specs", icon: <SettingIcon className="h-4.5 w-4.5" /> },
    { label: "Features", icon: <StarIcon className="h-4.5 w-4.5" /> },
    { label: "Images", icon: <UploadIcon className="h-4.5 w-4.5" /> },
    { label: "Review", icon: <EyeIcon className="h-4.5 w-4.5" /> },
];

export default function VehicleForm({
    topSection, brands, filterData, intialData, listingId, step: initialStep,
    initialMarketType = MarketType.SECOND_HAND,
}: Readonly<PropsT>) {
    const [step, setStep] = useState(initialStep ? Number(initialStep) : 1);
    const [formState, dispatch] = useReducer(formReducer, intialData ?? { ...initialFormState, marketType: initialMarketType });
    const [errors, setErrors] = useState<ZodTreeError>();
    const [draftLoading, setDraftLoading] = useState(false);
    const [publishLoading, setPublishLoading] = useState(false);

    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (intialData) {
            dispatch({
                type: "SET_ALL",
                fields: {
                    ...initialFormState,
                    ...intialData,
                    marketType: intialData.marketType || initialMarketType,
                    featureCategories: intialData.featureCategories ?? emptyFeatureCategories,
                },
            });
        }
    }, [intialData, initialMarketType]);

    useEffect(() => {
        if (intialData) return;
        dispatch({ type: "UPDATE_FIELD", field: "marketType", value: initialMarketType });
    }, [initialMarketType, intialData]);

    useEffect(() => {
        if (intialData || !listingId || typeof window === "undefined") return;
        const localRecord = getLocalInventoryById(listingId);
        if (!localRecord) return;
        dispatch({
            type: "SET_ALL",
            fields: {
                ...initialFormState,
                ...localRecord.form,
                featureCategories: (localRecord.form as Partial<FormState>).featureCategories ?? emptyFeatureCategories,
            },
        });
    }, [intialData, listingId]);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        updateFormField(name as keyof FormState, value);
    };

    const updateFormField = (name: keyof FormState, value: unknown, errorPath?: (string | number)[]) => {
        clearFieldError(errors, errorPath || [name]);
        dispatch({ type: "UPDATE_FIELD", field: name, value });
    };

    const validateDraft = () => {
        const result = baseSchema.safeParse({ ...formState, status: Status.DRAFT });
        if (!result.success) {
            setErrors(z.treeifyError(result.error) as ZodTreeError);
            return false;
        }
        setErrors(undefined);
        return true;
    };

    const getPreparedPayload = (status: Status) => {
        const payload: FormState = { ...formState, status };
        // Flatten featureCategories into legacy features array
        const cats = payload.featureCategories;
        if (cats) {
            payload.features = [
                ...cats.interior.seatMaterial, ...cats.interior.seatFeatures,
                ...cats.exterior.wheels, ...cats.exterior.lighting, ...cats.exterior.roof,
                ...cats.technology.connectivity, ...cats.technology.display, ...cats.technology.audio,
                ...cats.safety.core, ...cats.safety.advanced,
                ...cats.comfort.climate, ...cats.comfort.access,
            ];
        }
        if (payload.marketType === MarketType.ZERO_KM) {
            const firstUnitPrice = payload.vehicles?.find((v) => Number(v?.unitPrice) > 0)?.unitPrice ?? 0;
            const normalizedPrice = Number(payload.price) > 0 ? Number(payload.price) : Number(firstUnitPrice) || 0;
            payload.price = normalizedPrice > 0 ? normalizedPrice : undefined;
        }
        return payload;
    };

    const handleSaveDraft = async () => {
        if (!validateDraft()) return;
        setDraftLoading(true);
        try {
            const payload = getPreparedPayload(Status.DRAFT);
            const id = saveLocalInventory(payload, Status.DRAFT);
            message.success("Draft saved locally");
            router.replace(`${pathname}?id=${id}&step=${step}`);
        } catch {
            message.error("Failed to save draft");
        } finally {
            setDraftLoading(false);
        }
    };

    const handlePublish = async () => {
        const result = fullListingSchema.safeParse(getPreparedPayload(Status.UNDER_REVIEW));
        if (!result.success) {
            setErrors(z.treeifyError(result.error) as ZodTreeError);
            message.error("Please fix the errors before submitting");
            return;
        }
        setPublishLoading(true);
        try {
            const payload = getPreparedPayload(Status.UNDER_REVIEW);
            saveLocalInventory(payload, Status.UNDER_REVIEW);
            message.success("Listing submitted for review");
            router.push("/seller/inventory");
        } catch {
            message.error("Failed to submit listing");
        } finally {
            setPublishLoading(false);
        }
    };

    // Step validators
    const validateAndAdvance = (schema: z.ZodTypeAny, data: unknown) => {
        const result = schema.safeParse(data);
        if (!result.success) {
            const formattedErrors = z.treeifyError(result.error) as ZodTreeError;
            setErrors(formattedErrors);
            const firstField = formattedErrors.properties ? Object.keys(formattedErrors.properties)[0] : null;
            if (firstField) scrollToField(firstField);
            message.error("Please fix the errors before proceeding");
            return false;
        }
        setErrors(undefined);
        setStep((prev) => prev + 1);
        return true;
    };

    const handleStep1Submit = (e: FormEvent) => {
        e.preventDefault();
        validateAndAdvance(step1IdentitySchema, formState);
    };

    const handleStep2Submit = (e: FormEvent) => {
        e.preventDefault();
        validateAndAdvance(step2DetailsSchema, formState);
    };

    const handleStep3Submit = () => {
        validateAndAdvance(step3CommercialSchema, formState);
    };

    const handleStep4Submit = () => {
        validateAndAdvance(step4TechSpecsSchema, formState);
    };

    const handleStep5Submit = () => {
        validateAndAdvance(step5FeaturesSchema, formState);
    };

    const handleStep6Submit = () => {
        validateAndAdvance(step6ImagesSchema, formState);
    };

    const sharedProps = {
        formState,
        updateFormField,
        handleInputChange,
        setStep,
        filterData,
        brands,
        errors,
    };

    const renderSteps = () => {
        switch (step) {
            case 1:
                return <VehicleIdentityForm {...sharedProps} handleSubmit={handleStep1Submit} />;
            case 2:
                return <VehicleDetailsForm {...sharedProps} handleSubmit={handleStep2Submit} />;
            case 3:
                return (
                    <CommercialDetailsForm
                        {...sharedProps}
                        handleSubmit={handleStep3Submit}
                        updateVehicleField={(vehicles) => updateFormField("vehicles", vehicles)}
                    />
                );
            case 4:
                return <TechSpecsForm {...sharedProps} handleSubmit={handleStep4Submit} />;
            case 5:
                return <FeaturesChecklistForm {...sharedProps} handleSubmit={handleStep5Submit} />;
            case 6:
                return <ListingImagesForm {...sharedProps} handleSubmit={handleStep6Submit} />;
            case 7:
                return (
                    <ReviewForm
                        {...sharedProps}
                        handleSubmit={handlePublish}
                        handleSaveDraft={handleSaveDraft}
                        publishLoading={publishLoading}
                        draftLoading={draftLoading}
                    />
                );
            default:
                return <div>Something went wrong</div>;
        }
    };

    return (
        <div>
            <div className="flex md:items-center md:justify-between mb-6 flex-col md:flex-row gap-10">
                {topSection}
                <div className="flex space-x-3 text-xs">
                    <Button disabled type="button" variant="outline" leftIcon={<EyeIcon className="h-3.5 w-3.5" />}>
                        Preview
                    </Button>
                    <Button loading={draftLoading} variant="ghost" onClick={handleSaveDraft} type="button" leftIcon={<FileIcon className="h-3.5 w-3.5" />} className="border-brand-blue">
                        Save Draft
                    </Button>
                </div>
            </div>
            <Stepper currentStep={step} steps={steps} setStep={setStep} />
            <div>{renderSteps()}</div>
        </div>
    );
}
