/**
 * Google Maps API initialization
 * This module loads the Google Maps API library
 */

export function useGoogleMapsScript() {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.'
    );
  }

  // The script is loaded via the layout.tsx file
  // This function is kept for reference and future validation
  return {
    apiKey,
    isLoaded: typeof window !== 'undefined' && (window as any).google?.maps,
  };
}
