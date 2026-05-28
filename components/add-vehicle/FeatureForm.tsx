import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "@/components/Icons";
import { ChangeEvent, Dispatch, SetStateAction, useState, KeyboardEvent } from "react";
import type { FormState } from "@/components/add-vehicle/VehicleForm";
import Input from "@/elements/Input";
import Button from "@/elements/Button";
import { ZodTreeError } from "@/validation/shared-schema";
import message from "@/elements/message";

type PropsT = {
    formState: FormState;
    updateFormField: (name: Partial<keyof FormState>, value: string[], errorPath?: (string | number)[]) => void;
    setStep: Dispatch<SetStateAction<number>>;
    handleSubmit: () => void;
    errors?: ZodTreeError;
};

export default function FeatureForm({ formState, errors, updateFormField, setStep, handleSubmit }: Readonly<PropsT>) {
    const [feature, setFeature] = useState("");
    const [features, setFeatures] = useState<string[]>(formState.features ?? []);
    const [error, setError] = useState<string>("");
    const [isFetching, setIsFetching] = useState(false);

    const handleFeatureChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value } = e.target;
        setFeature(value);
        setError("");
    };

    const handleKeyboardEvent = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addFeature();
        }
    };

    const addFeature = () => {
        if (!feature) return;
        if (features.includes(feature)) {
            setError("Feature already added");
            return;
        }
        if (features.length >= 20) {
            setError("You can add up to 20 features only");
            return;
        }
        setFeature("");
        const allFeatures = [...features, feature];
        setFeatures(allFeatures);
        updateFormField("features", allFeatures);
    };

    const removeFeature = (feature: string) => {
        const allFeatures = features.filter((f) => f !== feature);
        setFeatures(allFeatures);
        updateFormField("features", allFeatures);
    };

    const handleFetchFeatures = async () => {
        if (!formState.brand || !formState.model || !formState.variant || !formState.year) {
            message.error("Select make, model, variant and year before fetching features.");
            return;
        }

        setIsFetching(true);
        await new Promise((resolve) => setTimeout(resolve, 700));

        const modelName = String(formState.model || "").toLowerCase();
        const fetchedFeatures = [
            "Apple CarPlay",
            "Android Auto",
            "Reverse Camera",
            "Bluetooth",
            "Keyless Entry",
            "Cruise Control",
            "LED Headlights",
            "ABS",
            "Airbags",
            modelName.includes("patrol") || modelName.includes("sportage") || modelName.includes("tucson") || modelName.includes("song") || modelName.includes("rav4")
                ? "Panoramic Sunroof"
                : "Fabric Seats",
            modelName.includes("ev") || modelName.includes("hybrid") ? "Driver Assist System" : "Parking Sensors",
            modelName.includes("patrol") || modelName.includes("land cruiser") ? "360 Camera" : "Touchscreen Infotainment",
        ];

        const merged = Array.from(new Set([...features, ...fetchedFeatures])).slice(0, 20);
        setFeatures(merged);
        updateFormField("features", merged);
        setIsFetching(false);
        message.success("Features fetched from JATO (prototype mock).");
    };

    return (
        <form>
            <div className="border rounded-xl p-4 mb-6 border-stroke-light">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h3 className="text-brand-blue">Vehicle Features</h3>
                        <p className="text-xs text-muted-foreground mt-1">Add features manually or fetch a starter list from the prototype JATO step.</p>
                    </div>
                    <Button type="button" loading={isFetching} onClick={handleFetchFeatures} variant="outline" className="border-brand-blue text-brand-blue">
                        Fetch
                    </Button>
                </div>
                <div className="flex space-x-2 mb-2">
                    <Input
                        type="text"
                        name="feature"
                        value={feature}
                        onChange={handleFeatureChange}
                        onKeyDown={handleKeyboardEvent}
                        maxLength={50}
                        parentClassName="flex-1"
                        placeholder="Add a feature (e.g., Leather Seats, Navigation)"
                    />
                    <Button type="button" onClick={addFeature} className="whitespace-nowrap">
                        Add Feature
                    </Button>
                </div>
                {errors?.properties?.features?.errors?.map((err: string) => (
                    <span key={err} className="text-xs text-destructive mt-1 block">
                        {err}
                    </span>
                ))}
                {error && <span className="text-xs text-destructive mt-1 block">{error}</span>}
                {features.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {features.map((i: string) => (
                            <div key={i} className="rounded-md border text-xs font-medium truncate border-transparent bg-accent hover:bg-accent/90 gap-3 flex items-center justify-between p-2">
                                <span className="truncate block">{i}</span>
                                <button type="button" onClick={() => removeFeature(i)} className="cursor-pointer">
                                    <CloseIcon className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center py-8">No features added yet. Add some features to make your listing more attractive.</p>
                )}
            </div>
            <div className="pt-6 border-t border-stroke-light">
                <div className="flex space-x-3 justify-between">
                    <Button type="button" variant="ghost" leftIcon={<ArrowLeftIcon className="h-3.5 w-3.5" />} onClick={() => setStep((prev) => prev - 1)}>
                        Previous
                    </Button>
                    <Button type="button" rightIcon={<ArrowRightIcon className="h-3.5 w-3.5" />} onClick={() => handleSubmit()}>
                        Next
                    </Button>
                </div>
            </div>
        </form>
    );
}
