import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadMedia } from './storage';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(),
    },
  },
  DEFAULT_PROPERTY_ID: 'test-property-id',
}));

describe('uploadMedia storage helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads file to Supabase storage and returns public URL on success', async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: { path: 'receipts/12345.jpg' },
      error: null,
    });
    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://storage.supabase.co/apartment-media/receipts/12345.jpg' },
    });

    (supabase.storage.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    });

    const file = new File(['dummy content'], 'receipt.jpg', { type: 'image/jpeg' });
    const url = await uploadMedia(file, 'receipts');

    expect(supabase.storage.from).toHaveBeenCalledWith('apartment-media');
    expect(mockUpload).toHaveBeenCalled();
    expect(mockGetPublicUrl).toHaveBeenCalledWith('receipts/12345.jpg');
    expect(url).toBe('https://storage.supabase.co/apartment-media/receipts/12345.jpg');
  });

  it('falls back to data URL when Supabase returns an error', async () => {
    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('Storage bucket not accessible'),
    });

    (supabase.storage.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    });

    const file = new File(['test image data'], 'damage.png', { type: 'image/png' });
    const url = await uploadMedia(file, 'damages');

    // Should return base64 data URL
    expect(url).toMatch(/^data:image\/png;base64,/);
  });

  it('falls back to data URL when network throws an exception', async () => {
    const mockUpload = vi.fn().mockRejectedValue(new Error('Network failure'));

    (supabase.storage.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      upload: mockUpload,
      getPublicUrl: vi.fn(),
    });

    const file = new File(['photo content'], 'evidence.jpg', { type: 'image/jpeg' });
    const url = await uploadMedia(file, 'damages');

    expect(url).toMatch(/^data:image\/jpeg;base64,/);
  });
});
