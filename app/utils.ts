export const API_URL = process.env.EXPO_API_URL ?? 'http://localhost:5000';
export const BASE_IMAGE_URL = process.env.EXPO_BASE_URL || 'http://localhost:5000/api/community/posts/image/';

// url for getting the display image from google drive
export function getDisplayImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl) return '';
    const match = imageUrl.match(/[?&]id=([^&]+)/);
    if (match && imageUrl.includes('uc?id=')) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
    }
    return imageUrl;
};

// Authentication headers
export const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};