import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateRandomPin,
  fetchPropertyLock,
  savePropertyLock,
  fetchBookingPins,
  generateBookingPin,
} from './ttlock-service';

describe('ttlock-service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('generateRandomPin', () => {
    it('generates a 6-digit numeric string', () => {
      const pin = generateRandomPin();
      expect(pin).toMatch(/^\d{6}$/);
    });

    it('generates different pins across calls', () => {
      const pins = new Set(Array.from({ length: 10 }, () => generateRandomPin()));
      expect(pins.size).toBeGreaterThan(1);
    });
  });

  describe('propertyLock operations', () => {
    it('returns null when no lock is configured', async () => {
      const lock = await fetchPropertyLock('non-existent-prop');
      expect(lock).toBeNull();
    });

    it('saves and retrieves a property lock', async () => {
      const saved = await savePropertyLock({
        property_id: 'prop-100',
        lock_id: 998877,
        lock_name: 'Apto 401 Principal',
      });

      expect(saved.property_id).toBe('prop-100');
      expect(saved.lock_id).toBe(998877);
      expect(saved.lock_name).toBe('Apto 401 Principal');

      const retrieved = await fetchPropertyLock('prop-100');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.lock_id).toBe(998877);
    });
  });

  describe('generateBookingPin & fetchBookingPins', () => {
    it('generates a mock one-time PIN when edge function is unavailable', async () => {
      const pinObj = await generateBookingPin({
        bookingId: 'book-123',
        propertyId: 'prop-100',
        checkIn: '2026-10-27',
        checkOut: '2026-10-30',
        guestName: 'Carlos Montoya',
      });

      expect(pinObj).toBeDefined();
      expect(pinObj.booking_id).toBe('book-123');
      expect(pinObj.property_id).toBe('prop-100');
      expect(pinObj.pin).toMatch(/^\d{6}$/);
      expect(pinObj.pin_type).toBe('one_time');
      expect(pinObj.status).toBe('active');
      expect(pinObj.is_mock).toBe(true);

      const pins = await fetchBookingPins('prop-100', 'book-123');
      expect(pins.length).toBeGreaterThanOrEqual(1);
      expect(pins[0].pin).toBe(pinObj.pin);
    });

    it('supports custom pin generation if provided', async () => {
      const pinObj = await generateBookingPin({
        bookingId: 'book-456',
        propertyId: 'prop-100',
        checkIn: '2026-10-28',
        checkOut: '2026-10-31',
        customPin: '123456',
      });

      expect(pinObj.pin).toBe('123456');
    });
  });
});
