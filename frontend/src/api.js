import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

export const verifyClaim = async (text) => {
  try {
    const response = await api.post('/api/verify', { text });
    return response.data;
  } catch (error) {
    console.error('Error verifying claim:', error);
    throw error;
  }
};

export const extractMediaClaim = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await api.post('/api/media/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    console.error('Error extracting media claim:', error);
    throw error;
  }
};

export const extractUrlClaim = async (url) => {
  try {
    const response = await api.post('/api/media/extract-url', { url });
    return response.data;
  } catch (error) {
    console.error('Error extracting URL claim:', error);
    throw error;
  }
};
