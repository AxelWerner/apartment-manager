import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchIcalFeed } from './ical-service';

describe('ical-service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws an error if URL is empty or invalid format', async () => {
    await expect(fetchIcalFeed('')).rejects.toThrow('A valid calendar URL is required.');
    await expect(fetchIcalFeed('ftp://example.com/cal.ics')).rejects.toThrow(
      'Calendar URL must start with http:// or https://'
    );
  });

  it('fetches calendar data through proxy endpoint', async () => {
    const mockIcsContent = 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockIcsContent),
    });
    globalThis.fetch = mockFetch;

    const result = await fetchIcalFeed('https://www.airbnb.com/calendar/ical/12345.ics?t=abc');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ical?url=https%3A%2F%2Fwww.airbnb.com%2Fcalendar%2Fical%2F12345.ics%3Ft%3Dabc',
      { headers: undefined }
    );
    expect(result).toBe(mockIcsContent);
  });

  it('passes x-api-key header when apiKey option is provided', async () => {
    const mockIcsContent = 'BEGIN:VCALENDAR\nEND:VCALENDAR';
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockIcsContent),
    });
    globalThis.fetch = mockFetch;

    await fetchIcalFeed('https://www.airbnb.com/cal.ics', { apiKey: 'my-custom-key' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ical?url=https%3A%2F%2Fwww.airbnb.com%2Fcal.ics',
      {
        headers: { 'x-api-key': 'my-custom-key' },
      }
    );
  });

  it('handles error responses from the proxy endpoint with JSON error message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Query parameter "url" is required.' }),
      text: () => Promise.resolve(''),
    });
    globalThis.fetch = mockFetch;

    await expect(fetchIcalFeed('https://www.airbnb.com/cal.ics')).rejects.toThrow(
      'Query parameter "url" is required.'
    );
  });

  it('handles error responses when json parse fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('Invalid JSON')),
      text: () => Promise.resolve('Bad Gateway'),
    });
    globalThis.fetch = mockFetch;

    await expect(fetchIcalFeed('https://www.airbnb.com/cal.ics')).rejects.toThrow(
      'Failed to fetch calendar (502)'
    );
  });
});
