/**
 * Geolocation Utility
 * Get location data from IP address
 */

import { GeoLocation } from '@/../../packages/db';

/**
 * Get geolocation from IP address
 * Uses ip-api.com free tier (with limits) or can be swapped for other services
 *
 * Free alternatives:
 * - ip-api.com (45 req/min limit)
 * - ipapi.co
 * - geojs.io
 */
export async function getGeolocationFromIp(ip: string): Promise<GeoLocation | null> {
  try {
    // Skip private IPs
    if (isPrivateIp(ip)) {
      return {
        city: 'Private Network',
        country: 'Local',
        isVpn: false,
      };
    }

    // Use ip-api.com free tier
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,city,timezone,isp,query`, {
      method: 'GET',
      headers: {
        'User-Agent': 'MediLocker/1.0',
      },
    });

    if (!response.ok) {
      console.warn(`Geolocation lookup failed for ${ip}: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'success') {
      console.warn(`Geolocation API returned error for ${ip}:`, data);
      return null;
    }

    // Detect potential VPN usage (heuristic)
    const isVpn = await detectVpn(ip, data);

    return {
      country: data.country,
      city: data.city,
      timezone: data.timezone,
      isp: data.isp,
      isVpn,
    };
  } catch (error) {
    console.error('Error fetching geolocation:', error);
    return null;
  }
}

/**
 * Check if IP is private/local
 */
function isPrivateIp(ip: string): boolean {
  const privateRanges = [
    /^127\./,           // Loopback
    /^192\.168\./,      // Private
    /^10\./,            // Private
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private
    /^::1$/,            // IPv6 loopback
    /^fc[0-9a-f]{2}:/i, // IPv6 private
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Simple VPN detection heuristic
 * Checks if ISP is known VPN provider or datacenter
 */
async function detectVpn(ip: string, geoData: any): Promise<boolean> {
  const vpnProviders = [
    'vpn',
    'datacenter',
    'hosting',
    'aws',
    'azure',
    'google cloud',
    'linode',
    'digitalocean',
    'vultr',
    'ovh',
  ];

  const isp = (geoData.isp || '').toLowerCase();

  // Check if ISP contains VPN keywords
  if (vpnProviders.some(provider => isp.includes(provider))) {
    return true;
  }

  // Check for known VPN IP ranges (simplified)
  // In production, use a VPN IP database service
  try {
    const response = await fetch(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`, {
      method: 'GET',
      headers: {
        'Key': process.env.ABUSEIPDB_API_KEY || '',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      // High abuse score might indicate VPN/proxy
      return data.data?.abuseConfidenceScore > 50;
    }
  } catch {
    // Silently fail - VPN detection is optional
  }

  return false;
}

/**
 * Get location from browser Geolocation API
 * (For frontend use only)
 */
export async function getGeolocationFromBrowser(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null); // User denied or error
      },
      { timeout: 5000 }
    );
  });
}

/**
 * Format geolocation for display
 */
export function formatGeolocation(geoLocation?: GeoLocation): string {
  if (!geoLocation) {
    return 'Unknown location';
  }

  const parts = [];

  if (geoLocation.city) {
    parts.push(geoLocation.city);
  }

  if (geoLocation.country) {
    parts.push(geoLocation.country);
  }

  if (parts.length === 0) {
    return 'Unknown location';
  }

  return parts.join(', ');
}

/**
 * Get location string from IP for quick display
 */
export async function getLocationString(ip: string): Promise<string> {
  const geoData = await getGeolocationFromIp(ip);
  return formatGeolocation(geoData) || 'Unknown';
}
