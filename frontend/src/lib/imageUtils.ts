import React from 'react';

// Utility functions for handling image URLs with fallbacks

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://aisocial.dev";
const LOCAL_API_URL = "http://localhost:3000";

/**
 * Get a reliable image URL with fallbacks
 * @param imageUrl - The original image URL
 * @returns A URL that should work in both development and production
 */
export function getImageUrl(imageUrl: string): string {
  if (!imageUrl) {
    return '/placeholder.svg'; // Fallback to local placeholder
  }

  // If it's already a full URL, return it as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it's a relative path, try to construct the full URL
  if (imageUrl.startsWith('/')) {
    return `${API_BASE_URL}${imageUrl}`;
  }

  // If it's just a filename, construct the uploads URL
  return `${API_BASE_URL}/uploads/${imageUrl}`;
}

/**
 * Get multiple fallback URLs for an image
 * @param imageUrl - The original image URL
 * @returns Array of URLs to try in order
 */
export function getImageUrlFallbacks(imageUrl: string): string[] {
  if (!imageUrl) {
    return ['/placeholder.svg'];
  }

  const urls: string[] = [];

  // If it's already a full URL, add it first
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    urls.push(imageUrl);
  } else {
    // Try production URL first
    if (imageUrl.startsWith('/')) {
      urls.push(`${API_BASE_URL}${imageUrl}`);
    } else {
      urls.push(`${API_BASE_URL}/uploads/${imageUrl}`);
    }

    // Try local development URL as fallback
    if (imageUrl.startsWith('/')) {
      urls.push(`${LOCAL_API_URL}${imageUrl}`);
    } else {
      urls.push(`${LOCAL_API_URL}/uploads/${imageUrl}`);
    }
  }

  // Add placeholder as final fallback
  urls.push('/placeholder.svg');

  return urls;
}

/**
 * React component for displaying images with fallbacks
 */
export function ImageWithFallback({ 
  src, 
  alt, 
  className = "", 
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }): React.JSX.Element {
  const [currentSrc, setCurrentSrc] = React.useState(src);
  const [errorCount, setErrorCount] = React.useState(0);
  const fallbackUrls = React.useMemo(() => getImageUrlFallbacks(src), [src]);

  const handleError = () => {
    setErrorCount(prev => {
      const next = prev + 1;
      if (next < fallbackUrls.length) {
        setCurrentSrc(fallbackUrls[next]);
      }
      return next;
    });
  };

  React.useEffect(() => {
    setCurrentSrc(src);
    setErrorCount(0);
  }, [src]);

  return React.createElement('img', {
    src: currentSrc,
    alt: alt,
    className: className,
    onError: handleError,
    ...props
  });
}

/**
 * Hook for getting image URLs with fallbacks
 */
export function useImageUrl(imageUrl: string): string {
  const [currentUrl, setCurrentUrl] = React.useState(imageUrl);
  const [errorCount, setErrorCount] = React.useState(0);
  const fallbackUrls = React.useMemo(() => getImageUrlFallbacks(imageUrl), [imageUrl]);

  const testImage = React.useCallback(async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  React.useEffect(() => {
    const testUrls = async () => {
      for (let i = 0; i < fallbackUrls.length; i++) {
        const url = fallbackUrls[i];
        if (await testImage(url)) {
          setCurrentUrl(url);
          setErrorCount(0);
          return;
        }
      }
      // If all URLs fail, use the last fallback
      setCurrentUrl(fallbackUrls[fallbackUrls.length - 1]);
    };

    testUrls();
  }, [imageUrl, fallbackUrls, testImage]);

  return currentUrl;
}
