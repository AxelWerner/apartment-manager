import { describe, it, expect } from 'vitest';
import { GET, POST } from './ttlock-passcode';

describe('api/ttlock-passcode endpoint', () => {
  it('responds with 200 and health check on GET', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.endpoint).toBe('/api/ttlock-passcode');
  });

  it('rejects POST requests missing required fields', async () => {
    const req = new Request('http://localhost:3000/api/ttlock-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName: 'Carlos' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('requeridos');
  });

  it('generates a mock PIN when credentials are not configured', async () => {
    const origClientId = process.env.TTLOCK_CLIENT_ID;
    delete process.env.TTLOCK_CLIENT_ID;

    try {
      const req = new Request('http://localhost:3000/api/ttlock-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: 'test-booking-1',
          propertyId: 'test-prop-1',
          guestName: 'Lucia Restrepo',
          customPin: '852963',
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.pin).toBeDefined();
      expect(data.pin.pin).toBe('852963');
      expect(data.isMock).toBe(true);
    } finally {
      if (origClientId !== undefined) {
        process.env.TTLOCK_CLIENT_ID = origClientId;
      }
    }
  });

  it('returns OAuth authorization URL when action is get-oauth-url', async () => {
    process.env.TTLOCK_CLIENT_ID = 'test-client-123';
    const req = new Request('http://localhost:3000/api/ttlock-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get-oauth-url',
        propertyId: 'prop-abc',
        redirectUri: 'http://localhost:3000/settings',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.url).toContain('https://euopen.ttlock.com/oauth2/auth');
    expect(data.url).toContain('clientId=test-client-123');
    expect(data.url).toContain('state=prop-abc');
  });

  it('handles unlinking action cleanly', async () => {
    const req = new Request('http://localhost:3000/api/ttlock-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'unlink',
        propertyId: 'prop-abc',
        unlinkType: 'lock_only',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('desvinculada');
  });
});

