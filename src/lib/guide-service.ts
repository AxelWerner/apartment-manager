import { supabase, DEFAULT_PROPERTY_ID } from './supabase';
import type { GuestGuideData } from '@/types/database';
import { INITIAL_GUEST_GUIDE } from './mock-data';

const STORAGE_KEY = 'apt_mgr_guest_guide';

function getLocalGuide(): GuestGuideData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GUEST_GUIDE));
      return INITIAL_GUEST_GUIDE;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_GUEST_GUIDE;
  }
}

function setLocalGuide(data: GuestGuideData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Failed to save guest guide to localStorage:', err);
  }
}

export async function fetchGuestGuide(propertyId: string = DEFAULT_PROPERTY_ID): Promise<GuestGuideData> {
  try {
    // Attempt to fetch from Supabase if stored in a custom column or table
    const targetId = propertyId || DEFAULT_PROPERTY_ID;
    const { data, error } = await supabase
      .from('properties')
      .select('id, name, address, city, check_in_time, check_out_time')
      .eq('id', targetId)
      .single();


    const localData = getLocalGuide();

    if (!error && data) {
      // Sync basic property info with guide if updated
      const merged: GuestGuideData = {
        ...localData,
        property_id: data.id || DEFAULT_PROPERTY_ID,
        address: data.address || localData.address,
        check_in_time: data.check_in_time ? data.check_in_time.slice(0, 5) : localData.check_in_time,
        check_out_time: data.check_out_time ? data.check_out_time.slice(0, 5) : localData.check_out_time,
      };
      setLocalGuide(merged);
      return merged;
    }
  } catch {
    // Fallback to local
  }
  return getLocalGuide();
}

export async function updateGuestGuide(updates: Partial<GuestGuideData>): Promise<GuestGuideData> {
  const current = getLocalGuide();
  const updated: GuestGuideData = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  setLocalGuide(updated);

  try {
    // If Supabase properties can sync checkin/checkout times and address
    if (updates.check_in_time || updates.check_out_time || updates.address) {
      await supabase.from('properties').update({
        check_in_time: updates.check_in_time,
        check_out_time: updates.check_out_time,
        address: updates.address,
      }).eq('id', DEFAULT_PROPERTY_ID);
    }
  } catch {
    // Ignore remote failure, local is updated
  }

  return updated;
}
