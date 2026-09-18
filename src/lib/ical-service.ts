/**
 * Service to fetch and handle .ics / iCal calendar feeds via the proxy endpoint.
 */

export interface IcalFetchOptions {
  /** Custom proxy endpoint URL, defaults to '/api/ical' */
  proxyEndpoint?: string;
  /** Optional API Key for proxy authentication */
  apiKey?: string;
}

/**
 * Default external calendar URLs from environment variables
 */
export const DEFAULT_ICAL_URLS = {
  airbnb:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AIRBNB_ICAL_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_AIRBNB_ICAL_URL) ||
    '',
  booking:
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BOOKING_ICAL_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_BOOKING_ICAL_URL) ||
    '',
};

/**
 * Fetches the raw text content of an .ics calendar file using the serverless proxy.
 *
 * @param calendarUrl - The external iCal URL (e.g. from Airbnb, Booking.com, Google Calendar). If omitted, falls back to VITE_AIRBNB_ICAL_URL.
 * @param options - Optional configuration options
 * @returns The raw string content of the .ics file
 */
export async function fetchIcalFeed(
  calendarUrl?: string,
  options: IcalFetchOptions = {}
): Promise<string> {
  const targetUrl = (calendarUrl || DEFAULT_ICAL_URLS.airbnb || '').trim();

  if (!targetUrl) {
    throw new Error('A valid calendar URL is required.');
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    throw new Error('Calendar URL must start with http:// or https://');
  }

  const endpoint = options.proxyEndpoint || '/api/ical';
  const proxyUrl = `${endpoint}?url=${encodeURIComponent(targetUrl)}`;

  const apiKey =
    options.apiKey ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ICAL_PROXY_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_ICAL_PROXY_API_KEY) ||
    '';

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(proxyUrl, {
    headers: Object.keys(headers).length > 0 ? headers : undefined,
  });

  if (!response.ok) {
    let errorMessage = `Failed to fetch calendar (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) {
        errorMessage = data.error;
      }
    } catch {
      // Non-JSON error response
    }
    throw new Error(errorMessage);
  }

  return response.text();
}
