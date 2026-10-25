import { supabase, DEFAULT_PROPERTY_ID } from './supabase';
import type { BookingTtlockPin, PropertyLock } from '@/types/database';

const STORAGE_KEYS = {
  pins: 'apt_mgr_ttlock_pins',
  locks: 'apt_mgr_property_locks',
};

function getLocal<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw) as T;
  } catch {
    return defaultVal;
  }
}

function setLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function generateRandomPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Fetches the physical TTLock configured for a property.
 */
export async function fetchPropertyLock(propertyId: string): Promise<PropertyLock | null> {
  const pId = propertyId || DEFAULT_PROPERTY_ID;

  try {
    const { data, error } = await supabase
      .from('property_locks')
      .select('*')
      .eq('property_id', pId)
      .maybeSingle();

    if (!error && data) {
      return data as PropertyLock;
    }
  } catch (err) {
    console.warn('Supabase fetchPropertyLock error, checking local storage:', err);
  }

  // Fallback to local storage
  const localLocks = getLocal<PropertyLock[]>(STORAGE_KEYS.locks, []);
  const found = localLocks.find((l) => l.property_id === pId);
  return found || null;
}

/**
 * Fetches all physical TTLock locks configured across properties.
 */
export async function fetchAllPropertyLocks(): Promise<PropertyLock[]> {
  const localLocks = getLocal<PropertyLock[]>(STORAGE_KEYS.locks, []);
  try {
    const { data, error } = await supabase
      .from('property_locks')
      .select('*');

    if (!error && data) {
      const dbPropIds = new Set(data.map((d: PropertyLock) => d.property_id));
      const missingLocal = localLocks.filter((ll) => !dbPropIds.has(ll.property_id));
      return [...data, ...missingLocal] as PropertyLock[];
    }
  } catch (err) {
    console.warn('Supabase fetchAllPropertyLocks error, checking local storage:', err);
  }

  return localLocks;
}

/**
 * Saves or updates a physical lock for a property.
 */
export async function savePropertyLock(
  lockData: Partial<PropertyLock> & { property_id: string; lock_id: number }
): Promise<PropertyLock> {
  const payload = {
    ...lockData,
    is_active: lockData.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('property_locks')
      .upsert(payload, { onConflict: 'property_id' })
      .select()
      .single();

    if (!error && data) {
      // Sync local storage
      const current = getLocal<PropertyLock[]>(STORAGE_KEYS.locks, []);
      const updated = current.filter((l) => l.property_id !== payload.property_id).concat(data as PropertyLock);
      setLocal(STORAGE_KEYS.locks, updated);
      return data as PropertyLock;
    }
  } catch (err) {
    console.warn('Supabase savePropertyLock error, falling back to local:', err);
  }

  // Local storage fallback
  const current = getLocal<PropertyLock[]>(STORAGE_KEYS.locks, []);
  const saved: PropertyLock = {
    id: lockData.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'lock-' + Date.now()),
    property_id: lockData.property_id,
    lock_id: lockData.lock_id,
    lock_name: lockData.lock_name || null,
    gateway_id: lockData.gateway_id || null,
    is_active: payload.is_active,
    created_at: new Date().toISOString(),
    updated_at: payload.updated_at,
  };

  const updated = current.filter((l) => l.property_id !== saved.property_id).concat(saved);
  setLocal(STORAGE_KEYS.locks, updated);
  return saved;
}

/**
 * Fetches all generated PINs, optionally filtered by property or booking.
 */
export async function fetchBookingPins(
  propertyId?: string,
  bookingId?: string
): Promise<BookingTtlockPin[]> {
  try {
    let query = supabase.from('booking_ttlock_pins').select('*');
    if (bookingId) {
      query = query.eq('booking_id', bookingId);
    } else if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (!error && data) {
      // Merge with any local offline pins
      const localPins = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
      const dbIds = new Set(data.map((d: BookingTtlockPin) => d.id));
      const missingLocal = localPins.filter((lp) => lp.id && !dbIds.has(lp.id));
      const combined = [...data, ...missingLocal] as BookingTtlockPin[];
      combined.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      if (bookingId) return combined.filter((p) => p.booking_id === bookingId);
      if (propertyId) return combined.filter((p) => p.property_id === propertyId);
      return combined;
    }
  } catch (err) {
    console.warn('Supabase fetchBookingPins error, using local fallback:', err);
  }

  // Local storage fallback
  const localPins = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
  if (bookingId) return localPins.filter((p) => p.booking_id === bookingId);
  if (propertyId) return localPins.filter((p) => p.property_id === propertyId);
  return localPins;
}

export interface GeneratePinParams {
  bookingId: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guestName?: string;
  customPin?: string;
  lockId?: number;
  generatedBy?: string;
}

function getApiUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin && !window.location.origin.startsWith('null')) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/**
 * Generates a One-Time PIN for a booking.
 * Connects directly to the physical TTLock lock via /api/ttlock-passcode (Gateway).
 * If the TTLock API returns an error, it throws the error so the user is properly alerted.
 */
export async function generateBookingPin(params: GeneratePinParams): Promise<BookingTtlockPin> {
  const { bookingId, propertyId, checkIn, checkOut, guestName, customPin, lockId, generatedBy } = params;

  // 1. Attempt execution via /api/ttlock-passcode (Vite dev server or Vercel serverless)
  try {
    const apiUrl = getApiUrl('/api/ttlock-passcode');
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        propertyId,
        checkIn,
        checkOut,
        guestName,
        customPin,
        lockId,
        generatedBy,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.pin) {
        // Save to local cache for instant UI availability, preserving all previous pins in history
        const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
        const updatedLocal = current.map((p) =>
          p.booking_id === bookingId && (p.status === 'active' || p.status === 'mock')
            ? { ...p, status: 'revoked' as const }
            : p
        );
        const withoutSameId = updatedLocal.filter((p) => p.id && p.id !== data.pin.id);
        setLocal(STORAGE_KEYS.pins, [data.pin, ...withoutSameId]);
        return data.pin as BookingTtlockPin;
      }
      if (data.error) {
        throw new Error(data.error);
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error) {
        throw new Error(errData.error);
      }
      // If 404 or not found, try fallback
      if (res.status !== 404) {
        throw new Error(`Error en el servidor de cerraduras (${res.status})`);
      }
    }
  } catch (apiErr: unknown) {
    const isNetworkOrUrlError =
      apiErr instanceof Error &&
      (apiErr.message.includes('Failed to fetch') ||
        apiErr.message.includes('Failed to parse URL') ||
        apiErr.message.includes('Invalid URL') ||
        apiErr.message.includes('404'));

    // If it's an explicit API business error, propagate it! Do NOT silently swallow and mock!
    if (apiErr instanceof Error && !isNetworkOrUrlError) {
      throw apiErr;
    }
    console.info('API /api/ttlock-passcode not reachable, checking Supabase Edge Function...', apiErr);

    // Fallback: Try Supabase Edge Function if /api/ttlock-passcode is unreachable
    try {
      const { data, error } = await supabase.functions.invoke('ttlock-passcode', {
        body: {
          bookingId,
          propertyId,
          checkIn,
          checkOut,
          guestName,
          customPin,
          lockId,
        },
      });

      if (!error && data && data.success && data.pin) {
        const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
        setLocal(STORAGE_KEYS.pins, [data.pin, ...current.filter((p) => p.id !== data.pin.id)]);
        return data.pin as BookingTtlockPin;
      }
    } catch (edgeErr: unknown) {
      console.warn('Neither /api/ttlock-passcode nor Supabase Edge Function were reachable:', edgeErr);
    }
  }

  // 2. Offline / simulation fallback only if completely disconnected
  const lock = await fetchPropertyLock(propertyId);
  const targetLockId = lockId || lock?.lock_id || 10001;
  const pinCode = customPin || generateRandomPin();

  const newPin: BookingTtlockPin = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'pin-' + Date.now(),
    booking_id: bookingId,
    property_id: propertyId,
    lock_id: targetLockId,
    keyboard_pwd_id: Date.now(),
    pin: pinCode,
    pin_type: 'one_time',
    status: 'active',
    valid_from: new Date().toISOString(),
    valid_to: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    is_mock: true,
    error_message: 'PIN de simulación (servidor TTLock no disponible localmente)',
    generated_by: generatedBy || null,
    created_at: new Date().toISOString(),
  };

  try {
    const { data: dbData, error: dbErr } = await supabase
      .from('booking_ttlock_pins')
      .insert(newPin)
      .select()
      .single();

    if (!dbErr && dbData) {
      const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
      setLocal(STORAGE_KEYS.pins, [dbData as BookingTtlockPin, ...current]);
      return dbData as BookingTtlockPin;
    }
  } catch (insertErr) {
    console.warn('Could not insert pin into Supabase, saving locally:', insertErr);
  }

  const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
  setLocal(STORAGE_KEYS.pins, [newPin, ...current]);
  return newPin;
}

export interface TtlockPasscodeItem {
  keyboardPwdId: number;
  keyboardPwd: string;
  keyboardPwdName?: string;
  keyboardPwdType?: number;
  startDate?: number;
  endDate?: number;
  status?: number;
}

export interface TtlockRecordItem {
  recordId: number;
  lockDate: number;
  keyboardPwd?: string;
  username?: string;
  success?: number;
}

/**
 * Synchronizes and queries passcodes and unlock records from the physical TTLock lock.
 */
export async function syncLockRecordsAndPasscodes(lockId?: number): Promise<{
  passcodes: TtlockPasscodeItem[];
  records: TtlockRecordItem[];
}> {
  try {
    const validLockId = lockId && lockId !== 10001 ? lockId : undefined;
    const lockParam = validLockId ? `&lockId=${validLockId}` : '';
    const [passRes, recRes] = await Promise.all([
      fetch(getApiUrl(`/api/ttlock-passcode?action=passcodes${lockParam}`)),
      fetch(getApiUrl(`/api/ttlock-passcode?action=records${lockParam}`)),
    ]);

    const passData = passRes.ok ? await passRes.json() : { list: [] };
    const recData = recRes.ok ? await recRes.json() : { list: [] };

    return {
      passcodes: passData.list || [],
      records: recData.list || [],
    };
  } catch (err) {
    console.warn('Error syncing TTLock passcodes/records:', err);
    return { passcodes: [], records: [] };
  }
}

/**
 * Checks whether a specific PIN code exists in the physical TTLock lock.
 */
export async function verifyPinOnLock(
  pinCode: string,
  lockId?: number,
  propertyId?: string
): Promise<{ verified: boolean; keyboardPwdId?: number; passcodeItem?: TtlockPasscodeItem }> {
  try {
    const validLockId = lockId && lockId !== 10001 ? lockId : undefined;
    const params = new URLSearchParams({ action: 'passcodes' });
    if (validLockId) params.set('lockId', validLockId.toString());
    if (propertyId) params.set('propertyId', propertyId);

    const res = await fetch(getApiUrl(`/api/ttlock-passcode?${params.toString()}`));
    if (!res.ok) return { verified: false };
    const data = await res.json();
    const list: TtlockPasscodeItem[] = data.list || [];
    const found = list.find((p) => p.keyboardPwd === pinCode);
    if (found) {
      return { verified: true, keyboardPwdId: found.keyboardPwdId, passcodeItem: found };
    }

    // If active passcodes list was successfully retrieved and PIN is missing, revoke it in DB & cache
    if (Array.isArray(data.list)) {
      try {
        await supabase
          .from('booking_ttlock_pins')
          .update({ status: 'revoked' })
          .eq('pin', pinCode);

        const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
        const updatedCache = current.map((p) =>
          p.pin === pinCode ? { ...p, status: 'revoked' as const, is_mock: false } : p
        );
        setLocal(STORAGE_KEYS.pins, updatedCache);
      } catch {
        // Ignore DB/cache error
      }
    }

    return { verified: false };
  } catch (err) {
    console.warn('Error verifying PIN on lock:', err);
    return { verified: false };
  }
}

/**
 * Updates booking PIN status if any unlock record matches the PIN in the physical lock,
 * and marks PIN as 'revoked' (borrado/desactivado) if it is no longer present in the lock.
 */
export async function updatePinsFromLockRecords(
  pins: BookingTtlockPin[],
  lockId?: number,
  propertyId?: string
): Promise<BookingTtlockPin[]> {
  try {
    const validLockId = lockId && lockId !== 10001 ? lockId : undefined;
    const effectivePropId = propertyId || pins.find((p) => p.property_id)?.property_id;

    const recParams = new URLSearchParams({ action: 'records' });
    const passParams = new URLSearchParams({ action: 'passcodes' });
    if (validLockId) {
      recParams.set('lockId', validLockId.toString());
      passParams.set('lockId', validLockId.toString());
    }
    if (effectivePropId) {
      recParams.set('propertyId', effectivePropId);
      passParams.set('propertyId', effectivePropId);
    }

    const [recRes, passRes] = await Promise.all([
      fetch(getApiUrl(`/api/ttlock-passcode?${recParams.toString()}`)),
      fetch(getApiUrl(`/api/ttlock-passcode?${passParams.toString()}`)),
    ]);

    const recordsData = recRes.ok ? await recRes.json() : { list: [] };
    const passData = passRes.ok ? await passRes.json() : { list: [] };

    const records: TtlockRecordItem[] = recordsData.list || [];
    const activePasscodes: TtlockPasscodeItem[] = passData.list || [];
    const hasPasscodesList = Array.isArray(passData.list);

    const updatedPins = await Promise.all(
      pins.map(async (p) => {
        // 1. Check if used to unlock the door
        const matchingRecord = records.find(
          (r) => r.keyboardPwd === p.pin && r.success === 1
        );
        if (matchingRecord) {
          if (p.status === 'used' && p.used_at) return p;
          const usedAt = new Date(matchingRecord.lockDate).toISOString();
          const updated: BookingTtlockPin = {
            ...p,
            status: 'used',
            used_at: usedAt,
          };

          try {
            await supabase
              .from('booking_ttlock_pins')
              .update({ status: 'used', used_at: usedAt })
              .eq('id', p.id);
          } catch {
            // Ignore DB update error
          }
          return updated;
        }

        // 2. If it was active but not used, check if it's still available in TTLock
        if ((p.status === 'active' || p.status === 'mock') && hasPasscodesList) {
          const isStillInLock = activePasscodes.some(
            (ap) =>
              (p.keyboard_pwd_id && ap.keyboardPwdId === p.keyboard_pwd_id) ||
              ap.keyboardPwd === p.pin
          );

          if (!isStillInLock) {
            const updated: BookingTtlockPin = {
              ...p,
              status: 'revoked',
              is_mock: false,
            };

            try {
              await supabase
                .from('booking_ttlock_pins')
                .update({ status: 'revoked' })
                .eq('id', p.id);
            } catch {
              // Ignore DB update error
            }
            return updated;
          }
        }

        return p;
      })
    );

    // Save to local cache
    const current = getLocal<BookingTtlockPin[]>(STORAGE_KEYS.pins, []);
    const updatedMap = new Map(updatedPins.map((p) => [p.id, p]));
    const newMerged = current.map((p) => updatedMap.get(p.id) || p);
    setLocal(STORAGE_KEYS.pins, newMerged);

    return updatedPins;
  } catch (err) {
    console.warn('Error updating pins from lock records/passcodes:', err);
    return pins;
  }
}

/**
 * Gets the TTLock OAuth authorization URL to connect an account.
 */
export async function getTtlockOAuthUrl(propertyId: string, redirectUri: string): Promise<string> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'get-oauth-url',
      propertyId,
      redirectUri,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success || !data.url) {
    throw new Error(data.error || 'No se pudo obtener la URL de autorización de TTLock');
  }
  return data.url;
}

/**
 * Connects a TTLock account via direct credentials (password grant) and stores access tokens.
 */
export async function connectTtlockAccount(params: {
  propertyId: string;
  username: string;
  password: string;
}): Promise<{ success: boolean; account_email?: string; message?: string; locks?: Array<{ lockId: number; lockName: string; lockAlias?: string }> }> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'connect-account',
      propertyId: params.propertyId,
      username: params.username,
      password: params.password,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al conectar la cuenta de TTLock');
  }
  return data;
}

/**
 * Exchanges the OAuth authorization code for TTLock tokens and saves to property_locks.
 */
export async function exchangeTtlockCode(
  code: string,
  propertyId: string,
  redirectUri: string
): Promise<{ success: boolean; message?: string; openid?: number; locks?: Array<{ lockId: number; lockName: string; lockAlias?: string }> }> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'exchange-code',
      code,
      propertyId,
      redirectUri,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al conectar la cuenta de TTLock');
  }
  return data;
}

/**
 * Fetches locks from the connected TTLock account for a property.
 */
export async function fetchAccountLocks(
  propertyId: string
): Promise<Array<{ lockId: number; lockName: string; lockAlias?: string }>> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'list-locks',
      propertyId,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al listar las cerraduras de la cuenta');
  }
  return data.list || [];
}

/**
 * Assigns a specific lock to a property.
 */
export async function assignPropertyLock(
  propertyId: string,
  lockId: number,
  lockName?: string,
  lockAlias?: string
): Promise<void> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save-lock',
      propertyId,
      lockId,
      lockName,
      lockAlias,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al asignar la cerradura al apartamento');
  }
}

/**
 * Unlinks a lock or completely disconnects a TTLock account from a property.
 */
export async function unlinkPropertyLock(
  propertyId: string,
  unlinkType: 'lock_only' | 'full_account' = 'lock_only'
): Promise<void> {
  const url = getApiUrl('/api/ttlock-passcode');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'unlink',
      propertyId,
      unlinkType,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Error al desvincular la cerradura');
  }
}

