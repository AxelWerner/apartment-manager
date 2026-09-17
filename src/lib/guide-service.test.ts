import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGuestGuide, updateGuestGuide } from './guide-service';
import { supabase } from './supabase';
import { INITIAL_GUEST_GUIDE } from './mock-data';


vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
  DEFAULT_PROPERTY_ID: 'a0000000-0000-0000-0000-000000000001',
}));

describe('guide-service', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns default initial guide when localStorage and Supabase are empty', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: mockSelect,
    });

    const guide = await fetchGuestGuide();
    expect(guide.welcome_title).toBe(INITIAL_GUEST_GUIDE.welcome_title);
    expect(guide.wifi_ssid).toBe(INITIAL_GUEST_GUIDE.wifi_ssid);
    expect(guide.show_access_code).toBe(true);
  });

  it('updates guide data and respects show_access_code setting in localStorage', async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      update: mockUpdate,
    });

    const updated = await updateGuestGuide({
      show_access_code: false,
      wifi_ssid: 'New_Wifi_5G',
      access_code: '9999 #',
    });

    expect(updated.show_access_code).toBe(false);
    expect(updated.wifi_ssid).toBe('New_Wifi_5G');
    expect(updated.access_code).toBe('9999 #');

    // Retrieve again to verify persistence
    const loaded = await fetchGuestGuide();
    expect(loaded.show_access_code).toBe(false);
    expect(loaded.wifi_ssid).toBe('New_Wifi_5G');
  });
});
