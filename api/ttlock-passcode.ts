import process from 'node:process';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyLockRow {
  id: string;
  property_id: string;
  lock_id?: number | null;
  lock_name?: string | null;
  lock_alias?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  ttlock_openid?: number | null;
  account_email?: string | null;
  is_active: boolean;
}

async function getValidAccessToken(
  supabase: ReturnType<typeof createClient>,
  propertyLock: PropertyLockRow,
  apiUrl: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const now = Date.now();
  const tokenExpiresAt = propertyLock.token_expires_at
    ? new Date(propertyLock.token_expires_at).getTime()
    : 0;

  // If token is still valid (with 5 minute safety buffer), use it
  if (propertyLock.access_token && tokenExpiresAt > now + 5 * 60 * 1000) {
    return propertyLock.access_token;
  }

  // If we have a refresh_token, refresh it
  if (propertyLock.refresh_token) {
    const params = new URLSearchParams();
    params.append('clientId', clientId);
    params.append('clientSecret', clientSecret);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', propertyLock.refresh_token);

    const res = await fetch(`${apiUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (data.access_token) {
      const newExpiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await supabase
        .from('property_locks')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token || propertyLock.refresh_token,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyLock.id);

      return data.access_token;
    }
  }

  if (propertyLock.access_token) {
    return propertyLock.access_token;
  }

  throw new Error('Token de acceso de TTLock expirado y no se pudo renovar.');
}

export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    const supabase = createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      supabaseKey || 'placeholder'
    );

    const body = await req.json();
    const {
      action,
      bookingId,
      propertyId,
      checkIn,
      checkOut,
      guestName,
      customPin,
      lockId: reqLockId,
      lockName: reqLockName,
      lockAlias: reqLockAlias,
      keyboardPwdId: reqKeyboardPwdId,
      generatedBy,
      code,
      redirectUri,
      unlinkType,
    } = body;

    const clientId = process.env.TTLOCK_CLIENT_ID;
    const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
    const apiUrl = process.env.TTLOCK_API_URL || 'https://euapi.ttlock.com';
    const authUrl = apiUrl.includes('euapi')
      ? 'https://euopen.ttlock.com'
      : 'https://open.ttlock.com';

    // -------------------------------------------------------------
    // ACTION: connect-account (Direct TTLock Password Grant)
    // -------------------------------------------------------------
    if (action === 'connect-account') {
      const { username, password } = body;
      if (!username || !password || !propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuario, contraseña y propertyId son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciales TTLOCK_CLIENT_ID / SECRET no configuradas en el servidor' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Format password as 32-character lowercase MD5 hash
      const passwordMd5 = /^[a-f0-9]{32}$/i.test(password)
        ? password.toLowerCase()
        : crypto.createHash('md5').update(password).digest('hex').toLowerCase();

      const tokenParams = new URLSearchParams();
      tokenParams.append('clientId', clientId);
      tokenParams.append('clientSecret', clientSecret);
      tokenParams.append('grant_type', 'password');
      tokenParams.append('username', username.trim());
      tokenParams.append('password', passwordMd5);

      const tokenRes = await fetch(`${apiUrl}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.errcode && tokenData.errcode !== 0) {
        throw new Error(tokenData.errmsg || 'Error al autenticar con TTLock. Verifica tu usuario y contraseña.');
      }
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || tokenData.error || 'No se recibió access_token de TTLock');
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600 * 24 * 30) * 1000).toISOString();

      // Query locks for this account immediately
      let locksList: Array<{ lockId: number; lockName: string; lockAlias?: string }> = [];
      try {
        const locksRes = await fetch(
          `${apiUrl}/v3/lock/list?clientId=${clientId}&accessToken=${tokenData.access_token}&pageNo=1&pageSize=50&date=${Date.now()}`
        );
        const locksData = await locksRes.json();
        if (Array.isArray(locksData.list)) {
          locksList = locksData.list.map((l: { lockId: number; lockName: string; lockAlias?: string }) => ({
            lockId: l.lockId,
            lockName: l.lockName,
            lockAlias: l.lockAlias,
          }));
        }
      } catch (err) {
        console.warn('Error fetching initial locks list:', err);
      }

      // Upsert into property_locks
      const upsertPayload = {
        property_id: propertyId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: expiresAt,
        ttlock_openid: tokenData.uid ? Number(tokenData.uid) : null,
        account_email: username.trim(),
        is_active: false,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('property_locks')
        .upsert(upsertPayload, { onConflict: 'property_id' });

      return new Response(
        JSON.stringify({
          success: true,
          account_email: username.trim(),
          locks: locksList,
          message: 'Cuenta TTLock conectada con éxito. Selecciona la cerradura correspondiente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: get-oauth-url
    // -------------------------------------------------------------
    if (action === 'get-oauth-url') {
      if (!clientId) {
        return new Response(
          JSON.stringify({ success: false, error: 'TTLOCK_CLIENT_ID no configurado en el servidor' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const pId = propertyId || '';
      const rUri = redirectUri || '';
      const url = `${authUrl}/oauth2/auth?clientId=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
        rUri
      )}&state=${encodeURIComponent(pId)}`;

      return new Response(JSON.stringify({ success: true, url, clientId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -------------------------------------------------------------
    // ACTION: exchange-code (OAuth code callback)
    // -------------------------------------------------------------
    if (action === 'exchange-code') {
      if (!code || !propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'code y propertyId son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciales TTLOCK_CLIENT_ID/SECRET no configuradas' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenParams = new URLSearchParams();
      tokenParams.append('clientId', clientId);
      tokenParams.append('clientSecret', clientSecret);
      tokenParams.append('grant_type', 'authorization_code');
      tokenParams.append('code', code);
      tokenParams.append('redirect_uri', redirectUri || '');

      const tokenRes = await fetch(`${apiUrl}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.errcode && tokenData.errcode !== 0) {
        throw new Error(tokenData.errmsg || 'Error al canjear código de autorización TTLock');
      }
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description || 'No se recibió access_token de TTLock');
      }

      const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

      // Query locks for this account immediately
      let locksList: Array<{ lockId: number; lockName: string; lockAlias?: string }> = [];
      try {
        const locksRes = await fetch(
          `${apiUrl}/v3/lock/list?clientId=${clientId}&accessToken=${tokenData.access_token}&pageNo=1&pageSize=50&date=${Date.now()}`
        );
        const locksData = await locksRes.json();
        if (Array.isArray(locksData.list)) {
          locksList = locksData.list.map((l: { lockId: number; lockName: string; lockAlias?: string }) => ({
            lockId: l.lockId,
            lockName: l.lockName,
            lockAlias: l.lockAlias,
          }));
        }
      } catch (err) {
        console.warn('Error fetching initial locks list:', err);
      }

      // Upsert into property_locks
      const upsertPayload = {
        property_id: propertyId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        ttlock_openid: tokenData.openid ? Number(tokenData.openid) : null,
        is_active: false, // Inactive until user selects a lock
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('property_locks')
        .upsert(upsertPayload, { onConflict: 'property_id' });

      return new Response(
        JSON.stringify({
          success: true,
          openid: tokenData.openid,
          locks: locksList,
          message: 'Cuenta TTLock conectada con éxito. Selecciona la cerradura correspondiente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: list-locks
    // -------------------------------------------------------------
    if (action === 'list-locks') {
      if (!propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'propertyId es requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: lockRow } = await supabase
        .from('property_locks')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (!lockRow?.access_token || !clientId || !clientSecret) {
        return new Response(
          JSON.stringify({ success: false, error: 'La propiedad no tiene cuenta TTLock vinculada', list: [] }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = await getValidAccessToken(supabase, lockRow, apiUrl, clientId, clientSecret);
      const listRes = await fetch(
        `${apiUrl}/v3/lock/list?clientId=${clientId}&accessToken=${token}&pageNo=1&pageSize=50&date=${Date.now()}`
      );
      const listData = await listRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          list: listData.list || [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: save-lock (Assign a lock from account to property)
    // -------------------------------------------------------------
    if (action === 'save-lock') {
      if (!propertyId || !reqLockId) {
        return new Response(
          JSON.stringify({ success: false, error: 'propertyId y lockId son requeridos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('property_locks')
        .update({
          lock_id: Number(reqLockId),
          lock_name: reqLockName || null,
          lock_alias: reqLockAlias || null,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('property_id', propertyId);

      return new Response(
        JSON.stringify({ success: true, message: 'Cerradura asignada y activada exitosamente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: unlink (Unassign lock or disconnect entire account)
    // -------------------------------------------------------------
    if (action === 'unlink') {
      if (!propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: 'propertyId es requerido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (unlinkType === 'full_account') {
        // Disconnect entire TTLock account
        await supabase
          .from('property_locks')
          .update({
            is_active: false,
            lock_id: null,
            lock_name: null,
            lock_alias: null,
            access_token: null,
            refresh_token: null,
            token_expires_at: null,
            account_email: null,
            ttlock_openid: null,
            updated_at: new Date().toISOString(),
          })
          .eq('property_id', propertyId);

        return new Response(
          JSON.stringify({ success: true, message: 'Cuenta de TTLock desconectada completamente' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Default: unbind lock only, keeping account connected for selection
      await supabase
        .from('property_locks')
        .update({
          is_active: false,
          lock_id: null,
          lock_name: null,
          lock_alias: null,
          updated_at: new Date().toISOString(),
        })
        .eq('property_id', propertyId);

      return new Response(
        JSON.stringify({ success: true, message: 'Cerradura desvinculada del apartamento' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // FETCH PROPERTY LOCK (for passcodes)
    // -------------------------------------------------------------
    let propertyLock: PropertyLockRow | null = null;
    if (propertyId) {
      try {
        const { data } = await supabase
          .from('property_locks')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle();

        if (data) {
          propertyLock = data as PropertyLockRow;
        }
      } catch (err) {
        console.warn('DB error fetching property lock:', err);
      }
    }

    const targetLockId = reqLockId && reqLockId !== 10001
      ? Number(reqLockId)
      : propertyLock?.lock_id || undefined;

    // -------------------------------------------------------------
    // ACTION: delete passcode
    // -------------------------------------------------------------
    if (action === 'delete') {
      const delPwdId = reqKeyboardPwdId;
      if (!delPwdId || !targetLockId) {
        return new Response(
          JSON.stringify({ success: false, error: 'keyboardPwdId y lockId son requeridos para eliminar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (clientId && clientSecret && propertyLock?.access_token) {
        const token = await getValidAccessToken(supabase, propertyLock, apiUrl, clientId, clientSecret);
        const delParams = new URLSearchParams();
        delParams.append('clientId', clientId);
        delParams.append('accessToken', token);
        delParams.append('lockId', targetLockId.toString());
        delParams.append('keyboardPwdId', delPwdId.toString());
        delParams.append('deleteType', '2'); // 2 = via gateway
        delParams.append('date', Date.now().toString());

        const delRes = await fetch(`${apiUrl}/v3/keyboardPwd/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: delParams.toString(),
        });
        const delData = await delRes.json();
        if (delData.errcode && delData.errcode !== 0) {
          throw new Error(delData.errmsg || `Error TTLock API (${delData.errcode})`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'PIN eliminado de la cerradura' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------
    // ACTION: Generate Passcode (Default POST)
    // -------------------------------------------------------------
    if (!bookingId || !propertyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'bookingId y propertyId son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let pin = customPin || '';
    let keyboardPwdId: number = Date.now();
    let isMock = false;
    let errorMessage: string | null = null;

    const now = Date.now();
    let startDate = now;
    let endDate = now + 6 * 60 * 60 * 1000;

    // Check if we have active lock and OAuth token
    if (clientId && clientSecret && propertyLock?.access_token && targetLockId && propertyLock.is_active) {
      const token = await getValidAccessToken(supabase, propertyLock, apiUrl, clientId, clientSecret);

      if (!customPin) {
        // One-time passcode (valid 6 hours, algorítmico, no consume cuota custom)
        const getParams = new URLSearchParams();
        getParams.append('clientId', clientId);
        getParams.append('accessToken', token);
        getParams.append('lockId', targetLockId.toString());
        getParams.append('keyboardPwdVersion', '4');
        getParams.append('keyboardPwdType', '1'); // 1 = One-time (6 horas)
        getParams.append(
          'keyboardPwdName',
          `Reserva ${guestName || ''}`.trim().slice(0, 20) || 'Huesped'
        );
        getParams.append('startDate', now.toString());
        getParams.append('date', now.toString());

        const getRes = await fetch(`${apiUrl}/v3/keyboardPwd/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: getParams.toString(),
        });

        const getData = await getRes.json();
        if (getData.errcode && getData.errcode !== 0) {
          throw new Error(getData.errmsg || `Error TTLock API (${getData.errcode})`);
        }
        if (getData.keyboardPwd) {
          pin = getData.keyboardPwd;
        }
        if (getData.keyboardPwdId) {
          keyboardPwdId = getData.keyboardPwdId;
        }
      } else {
        // Custom passcode via Gateway
        pin = customPin;
        startDate = Math.floor((now - 5 * 60 * 1000) / 60000) * 60000;
        if (checkIn) {
          const parsedCheckIn = new Date(`${checkIn}T08:00:00`).getTime();
          if (!isNaN(parsedCheckIn) && parsedCheckIn > now) {
            startDate = Math.floor(parsedCheckIn / 60000) * 60000;
          }
        }

        endDate = Math.floor((now + 48 * 60 * 60 * 1000) / 60000) * 60000;
        if (checkOut) {
          const parsedCheckOut = new Date(`${checkOut}T15:00:00`).getTime();
          if (!isNaN(parsedCheckOut) && parsedCheckOut > startDate) {
            endDate = Math.floor(parsedCheckOut / 60000) * 60000;
          }
        }

        const addParams = new URLSearchParams();
        addParams.append('clientId', clientId);
        addParams.append('accessToken', token);
        addParams.append('lockId', targetLockId.toString());
        addParams.append('keyboardPwd', pin);
        addParams.append(
          'keyboardPwdName',
          `Reserva ${guestName || ''}`.trim().slice(0, 20) || 'Huesped'
        );
        addParams.append('startDate', startDate.toString());
        addParams.append('endDate', endDate.toString());
        addParams.append('addType', '2'); // 2 = via Gateway
        addParams.append('date', now.toString());

        const addRes = await fetch(`${apiUrl}/v3/keyboardPwd/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: addParams.toString(),
        });

        const addData = await addRes.json();
        if (addData.errcode && addData.errcode !== 0) {
          throw new Error(addData.errmsg || `Error TTLock API (${addData.errcode})`);
        }
        if (addData.keyboardPwdId) {
          keyboardPwdId = addData.keyboardPwdId;
        }
      }
    } else if (!clientId) {
      // Test environment simulation (when TTLOCK_CLIENT_ID is unset in unit tests)
      isMock = true;
      pin = customPin || Math.floor(10000000 + Math.random() * 90000000).toString();
      errorMessage = 'Modo de simulación (TTLOCK_CLIENT_ID no configurado)';
    } else {
      // Real environment with no linked lock
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Esta propiedad no tiene una cerradura TTLock activa. Conéctala y asígnala desde Configuración > Cerraduras Inteligentes.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pinPayload = {
      id: crypto.randomUUID(),
      booking_id: bookingId,
      property_id: propertyId,
      lock_id: targetLockId || 10001,
      keyboard_pwd_id: keyboardPwdId,
      pin,
      pin_type: 'one_time',
      status: 'active',
      valid_from: new Date(startDate).toISOString(),
      valid_to: new Date(endDate).toISOString(),
      is_mock: isMock,
      error_message: errorMessage,
      generated_by: generatedBy || null,
      created_at: new Date().toISOString(),
    };

    if (supabaseUrl && supabaseKey) {
      try {
        await supabase
          .from('booking_ttlock_pins')
          .update({ status: 'revoked' })
          .eq('booking_id', bookingId)
          .in('status', ['active', 'mock']);

        const { data: insertedPin, error: insertError } = await supabase
          .from('booking_ttlock_pins')
          .insert(pinPayload)
          .select()
          .single();

        if (!insertError && insertedPin) {
          return new Response(
            JSON.stringify({
              success: true,
              pin: insertedPin,
              isMock,
              message: isMock
                ? 'PIN generado en modo desarrollo'
                : 'PIN programado exitosamente en la cerradura física',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (insertErr) {
        console.warn('Could not insert to supabase, returning direct payload:', insertErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        pin: pinPayload,
        isMock,
        message: isMock
          ? 'PIN generado en modo desarrollo'
          : 'PIN programado exitosamente en la cerradura física',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Error inesperado';
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(req?: Request) {
  const url = new URL(req?.url || 'http://localhost/api/ttlock-passcode');
  const action = url.searchParams.get('action');
  const propertyId = url.searchParams.get('propertyId');
  const rawLockId = url.searchParams.get('lockId');

  const clientId = process.env.TTLOCK_CLIENT_ID;
  const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
  const apiUrl = process.env.TTLOCK_API_URL || 'https://euapi.ttlock.com';

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseKey || 'placeholder'
  );

  let propertyLock: PropertyLockRow | null = null;
  if (propertyId) {
    try {
      const { data } = await supabase
        .from('property_locks')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (data) {
        propertyLock = data as PropertyLockRow;
      }
    } catch {
      // Ignore
    }
  }

  if (!propertyLock && rawLockId && rawLockId !== '10001' && rawLockId !== 'undefined' && rawLockId !== 'null') {
    try {
      const { data } = await supabase
        .from('property_locks')
        .select('*')
        .eq('lock_id', Number(rawLockId))
        .maybeSingle();

      if (data) {
        propertyLock = data as PropertyLockRow;
      }
    } catch {
      // Ignore
    }
  }

  const lockId = rawLockId && rawLockId !== '10001' && rawLockId !== 'undefined' && rawLockId !== 'null'
    ? rawLockId
    : propertyLock?.lock_id?.toString();

  if ((action === 'passcodes' || action === 'records') && (!propertyLock?.access_token || !lockId)) {
    return new Response(
      JSON.stringify({ error: 'No se encontró cerradura vinculada o token de acceso activo', list: [] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'passcodes' && clientId && clientSecret && propertyLock?.access_token && lockId) {
    try {
      const token = await getValidAccessToken(supabase, propertyLock, apiUrl, clientId, clientSecret);
      const res = await fetch(
        `${apiUrl}/v3/lock/listKeyboardPwd?clientId=${clientId}&accessToken=${token}&lockId=${lockId}&pageNo=1&pageSize=50&date=${Date.now()}`
      );
      const data = await res.json();
      if (data.errcode && data.errcode !== 0) {
        return new Response(JSON.stringify({ error: data.errmsg || `Error TTLock (${data.errcode})`, list: [] }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar passcodes';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  if (action === 'records' && clientId && clientSecret && propertyLock?.access_token && lockId) {
    try {
      const token = await getValidAccessToken(supabase, propertyLock, apiUrl, clientId, clientSecret);
      const res = await fetch(
        `${apiUrl}/v3/lockRecord/list?clientId=${clientId}&accessToken=${token}&lockId=${lockId}&pageNo=1&pageSize=30&date=${Date.now()}`
      );
      const data = await res.json();
      if (data.errcode && data.errcode !== 0) {
        return new Response(JSON.stringify({ error: data.errmsg || `Error TTLock (${data.errcode})`, list: [] }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al consultar aperturas';
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(
    JSON.stringify({
      status: 'ok',
      endpoint: '/api/ttlock-passcode',
      ttlockConfigured: Boolean(clientId && clientSecret),
      hasConnectedAccount: Boolean(propertyLock?.access_token),
      lockId: lockId || null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
