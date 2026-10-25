import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(
  apiUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  password: string
): Promise<string> {
  const params = new URLSearchParams();
  params.append('clientId', clientId);
  params.append('clientSecret', clientSecret);
  params.append('username', username);
  params.append('password', password);
  params.append('grant_type', 'password');

  const res = await fetch(`${apiUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(data.errmsg || 'Error al autenticar con TTLock');
  }
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || 'No se recibió access_token de TTLock');
  }
  return data.access_token;
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
      bookingId,
      propertyId,
      checkIn,
      checkOut,
      guestName,
      customPin,
      lockId: reqLockId,
      action,
      keyboardPwdId: reqKeyboardPwdId,
      generatedBy,
    } = body;

    const clientId = process.env.TTLOCK_CLIENT_ID;
    const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
    const username = process.env.TTLOCK_USERNAME;
    const password = process.env.TTLOCK_PASSWORD || process.env.TTLOCK_PASSWORD_MD5;
    const apiUrl = process.env.TTLOCK_API_URL || 'https://euapi.ttlock.com';

    const envLockId = process.env.TTLOCK_LOCK_ID ? Number(process.env.TTLOCK_LOCK_ID) : undefined;
    let targetLockId = reqLockId && reqLockId !== 10001 ? reqLockId : undefined;
    if (!targetLockId && supabaseUrl && supabaseKey && propertyId) {
      try {
        const { data: lockRow } = await supabase
          .from('property_locks')
          .select('lock_id')
          .eq('property_id', propertyId)
          .maybeSingle();

        if (lockRow?.lock_id) {
          targetLockId = Number(lockRow.lock_id);
        }
      } catch {
        // Ignore DB lookup error
      }
    }
    if (!targetLockId) {
      targetLockId = envLockId;
    }

    // Handle delete passcode action
    if (action === 'delete') {
      const delPwdId = reqKeyboardPwdId;
      if (!delPwdId || !targetLockId) {
        return new Response(
          JSON.stringify({ success: false, error: 'keyboardPwdId y lockId son requeridos para eliminar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (clientId && clientSecret && username && password) {
        const token = await getAccessToken(apiUrl, clientId, clientSecret, username, password);
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
    // One-time passcodes in TTLock are valid for 6 hours from creation
    let startDate = now;
    let endDate = now + 6 * 60 * 60 * 1000;

    if (clientId && clientSecret && username && password && targetLockId) {
      const token = await getAccessToken(apiUrl, clientId, clientSecret, username, password);

      if (!customPin) {
        // Official TTLock One-time passcode (valid for 6 hours, 1 unlock, does NOT count towards 5 custom passcodes/month)
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
        // Custom passcode via Gateway (addType = 2) - counts against custom quota
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
        addParams.append('addType', '2'); // 2 = Send to lock via Gateway
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
    } else {
      isMock = true;
      pin = customPin || Math.floor(10000000 + Math.random() * 90000000).toString();
      errorMessage =
        'PIN de simulación (complete las variables TTLOCK_* en .env.local para enlace con cerradura física)';
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
        // Mark any prior active/mock pin for this booking as revoked so it stays in the history
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
                : 'PIN programado exitosamente en la cerradura TTLock física',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (insertError) {
          console.warn('Supabase insertError:', insertError);
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
          : 'PIN programado exitosamente en la cerradura TTLock física',
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

  const clientId = process.env.TTLOCK_CLIENT_ID;
  const clientSecret = process.env.TTLOCK_CLIENT_SECRET;
  const username = process.env.TTLOCK_USERNAME;
  const password = process.env.TTLOCK_PASSWORD || process.env.TTLOCK_PASSWORD_MD5;
  const apiUrl = process.env.TTLOCK_API_URL || 'https://euapi.ttlock.com';
  const rawLockId = url.searchParams.get('lockId');
  const lockId =
    rawLockId && rawLockId !== '10001' && rawLockId !== 'undefined' && rawLockId !== 'null'
      ? rawLockId
      : process.env.TTLOCK_LOCK_ID;

  if (action === 'passcodes' && clientId && clientSecret && username && password && lockId) {
    try {
      const token = await getAccessToken(apiUrl, clientId, clientSecret, username, password);
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

  if (action === 'records' && clientId && clientSecret && username && password && lockId) {
    try {
      const token = await getAccessToken(apiUrl, clientId, clientSecret, username, password);
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
      ttlockConfigured: Boolean(clientId && username && password),
      lockId: lockId || null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
