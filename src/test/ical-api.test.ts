import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../../api/ical';
import type { VercelRequest, VercelResponse } from '@vercel/node';

function createMockReqRes(options: {
  method?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}) {
  const req = {
    method: options.method || 'GET',
    query: options.query || {},
    headers: options.headers || {},
  } as unknown as VercelRequest;

  const resHeaders: Record<string, string> = {};
  let statusCode = 200;
  let sentData: unknown = null;

  const res = {
    setHeader: vi.fn((key: string, value: string) => {
      resHeaders[key] = value;
    }),
    status: vi.fn((code: number) => {
      statusCode = code;
      return res;
    }),
    json: vi.fn((data: unknown) => {
      sentData = data;
      return res;
    }),
    send: vi.fn((data: unknown) => {
      sentData = data;
      return res;
    }),
    end: vi.fn(() => {
      return res;
    }),
  } as unknown as VercelResponse;

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getSentData: () => sentData,
    getHeaders: () => resHeaders,
  };
}

describe('Vercel Serverless Function: api/ical', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  });

  it('handles OPTIONS request for CORS preflight', async () => {
    const { req, res, getStatusCode } = createMockReqRes({ method: 'OPTIONS' });
    await handler(req, res);
    expect(getStatusCode()).toBe(200);
    expect(res.end).toHaveBeenCalled();
  });

  it('returns 405 for unsupported HTTP methods', async () => {
    const { req, res, getStatusCode, getSentData } = createMockReqRes({ method: 'POST' });
    await handler(req, res);
    expect(getStatusCode()).toBe(405);
    expect(getSentData()).toEqual({ error: 'Method not allowed. Use GET.' });
  });

  it('returns 400 if url query param is missing and no env default exists', async () => {
    delete process.env.AIRBNB_ICAL_URL;
    delete process.env.VITE_AIRBNB_ICAL_URL;
    const { req, res, getStatusCode, getSentData } = createMockReqRes({ method: 'GET', query: {} });
    await handler(req, res);
    expect(getStatusCode()).toBe(400);
    expect(getSentData()).toEqual({
      error: 'Query parameter "url" or AIRBNB_ICAL_URL env variable is required.',
    });
  });

  it('uses default AIRBNB_ICAL_URL env variable if query param is not supplied', async () => {
    process.env.AIRBNB_ICAL_URL = 'https://www.airbnb.com/calendar/ical/default.ics';
    const mockIcsText = 'BEGIN:VCALENDAR\nSUMMARY:Default Listing\nEND:VCALENDAR';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockIcsText),
    });

    const { req, res, getStatusCode, getSentData } = createMockReqRes({
      method: 'GET',
      query: {},
    });

    await handler(req, res);

    expect(getStatusCode()).toBe(200);
    expect(getSentData()).toBe(mockIcsText);
  });

  it('enforces API key when ICAL_PROXY_API_KEY is configured', async () => {
    process.env.ICAL_PROXY_API_KEY = 'secret-test-key';

    // Without key -> 401
    const { req: req1, res: res1, getStatusCode: getCode1 } = createMockReqRes({
      method: 'GET',
      query: { url: 'https://www.airbnb.com/cal.ics' },
    });
    await handler(req1, res1);
    expect(getCode1()).toBe(401);

    // With invalid key -> 401
    const { req: req2, res: res2, getStatusCode: getCode2 } = createMockReqRes({
      method: 'GET',
      query: { url: 'https://www.airbnb.com/cal.ics' },
      headers: { 'x-api-key': 'wrong-key' },
    });
    await handler(req2, res2);
    expect(getCode2()).toBe(401);

    // With valid key in header -> 200
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('VCAL'),
    });
    const { req: req3, res: res3, getStatusCode: getCode3 } = createMockReqRes({
      method: 'GET',
      query: { url: 'https://www.airbnb.com/cal.ics' },
      headers: { 'x-api-key': 'secret-test-key' },
    });
    await handler(req3, res3);
    expect(getCode3()).toBe(200);
  });

  it('returns 400 if url protocol is not http/https', async () => {
    const { req, res, getStatusCode, getSentData } = createMockReqRes({
      method: 'GET',
      query: { url: 'javascript:alert(1)' },
    });
    await handler(req, res);
    expect(getStatusCode()).toBe(400);
    expect(getSentData()).toEqual({
      error: 'Invalid URL protocol. Only HTTP and HTTPS are supported.',
    });
  });

  it('proxies external .ics content successfully with correct headers', async () => {
    const mockIcsText = 'BEGIN:VCALENDAR\nSUMMARY:Test Reservation\nEND:VCALENDAR';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockIcsText),
    });

    const { req, res, getStatusCode, getSentData } = createMockReqRes({
      method: 'GET',
      query: { url: 'https://www.airbnb.com/calendar/ical/123.ics' },
    });

    await handler(req, res);

    expect(getStatusCode()).toBe(200);
    expect(getSentData()).toBe(mockIcsText);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar; charset=utf-8');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=600'
    );
  });

  it('handles upstream fetch error status codes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { req, res, getStatusCode, getSentData } = createMockReqRes({
      method: 'GET',
      query: { url: 'https://www.airbnb.com/calendar/ical/notfound.ics' },
    });

    await handler(req, res);

    expect(getStatusCode()).toBe(404);
    expect(getSentData()).toEqual({
      error: 'Failed to fetch iCal feed (404): Not Found',
    });
  });
});
