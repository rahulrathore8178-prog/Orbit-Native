import { API_URL, getAuthHeaders } from '@/lib/utils';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

// ⚠️ Must match your Orbital schema's visibility values (same ones the web modal used).
export const VISIBILITY = { OPEN: 'open', PRIVATE: 'private' } as const;
export type Visibility = (typeof VISIBILITY)[keyof typeof VISIBILITY];

export const NAME_MIN = 3;
export const NAME_MAX = 50;
export const DESC_MAX = 500;
const IMAGE_MAX_MB = 5;

export type PickedImage = { uri: string; name: string; type: string };

export type SubmitResult =
    | { status: 'ok'; orbital: unknown }
    | { status: 'invalid' } // name too short: nothing was sent
    | { status: 'error' } // request failed: `serverError` explains why
    | { status: 'busy' }; // already submitting

/**
 * All the state + logic of the "create orbital" form: fields, validation, picture picking
 * and the POST to /api/orbital/new. The UI lives in CreateOrbitalSheet.
 * The draft lives as long as the Orbitals screen does, so closing the sheet never loses typing.
 */
export function useCreateOrbital() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [visibility, setVisibility] = useState<Visibility>(VISIBILITY.OPEN);
    const [image, setImage] = useState<PickedImage | null>(null);

    const [nameError, setNameError] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // something worth keeping: drives the draft dot on the + button and the "Clear" action
    const isDirty = name.trim().length > 0 || description.trim().length > 0 || image !== null;

    const changeName = useCallback((text: string) => {
        setName(text);
        setNameError(null);
    }, []);

    const pickImage = useCallback(async () => {
        setImageError(null);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true, // square crop, the picture is shown as a circle
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled) return;

        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > IMAGE_MAX_MB * 1024 * 1024) {
            setImageError(`Image must be under ${IMAGE_MAX_MB} MB.`);
            return;
        }
        setImage({
            uri: asset.uri,
            name: asset.fileName ?? `orbital-${Date.now()}.jpg`,
            type: asset.mimeType ?? 'image/jpeg',
        });
    }, []);

    const removeImage = useCallback(() => {
        setImage(null);
        setImageError(null);
    }, []);

    const reset = useCallback(() => {
        setName('');
        setDescription('');
        setVisibility(VISIBILITY.OPEN);
        setImage(null);
        setNameError(null);
        setImageError(null);
        setServerError(null);
    }, []);

    const submit = useCallback(async (): Promise<SubmitResult> => {
        if (submitting) return { status: 'busy' };

        const trimmed = name.trim();
        if (trimmed.length < NAME_MIN) {
            setNameError(`Give your orbital a name with at least ${NAME_MIN} characters.`);
            return { status: 'invalid' };
        }

        setNameError(null);
        setServerError(null);
        setSubmitting(true);
        try {
            const form = new FormData();
            form.append('name', trimmed);
            form.append('description', description.trim());
            form.append('visibility', visibility);
            // On React Native a file part is { uri, name, type } (the web version appended a File).
            if (image) form.append('media', { uri: image.uri, name: image.name, type: image.type } as any);

            const { data } = await axios.post(`${API_URL}/api/orbital/new`, form, {
                withCredentials: true,
                timeout: 30000,
                headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
            });

            reset();
            return { status: 'ok', orbital: data };
        } catch (err) {
            if (__DEV__ && axios.isAxiosError(err)) {
                console.log('create orbital failed', {
                    url: err.config?.url,
                    status: err.response?.status,
                    message: err.message,
                });
            }
            setServerError(
                (axios.isAxiosError(err) && err.response?.data?.message) || "Couldn't create the orbital. Try again."
            );
            return { status: 'error' };
        } finally {
            setSubmitting(false);
        }
    }, [submitting, name, description, visibility, image, reset]);

    return {
        // fields
        name,
        description,
        visibility,
        image,
        // field setters
        changeName,
        setDescription,
        setVisibility,
        pickImage,
        removeImage,
        // state
        nameError,
        imageError,
        serverError,
        submitting,
        isDirty,
        // actions
        submit,
        reset,
    };
}

export type CreateOrbitalForm = ReturnType<typeof useCreateOrbital>;