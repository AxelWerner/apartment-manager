import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken(
  apiUrl: string,
  clientId: string,
  clientSecret: string,
  username: string,
  passwordMd5: string
): Promise<string> {
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('username', username);
  params.append('password', passwordMd5);
  params.append('grant_type', 'password');

  const res = await fetch(`${apiUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.errcode && data.errcode !== 0) {
    throw new Error(data.errmsg || 'Error al autenticar con TTLock');
  }
  if (!data.access_token) {
    throw new Error('No se recibió access_token de TTLock');
  }
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      bookingId,
      propertyId,
      guestName,
      customPin,
      lockId: reqLockId,
      generatedBy,
    } = body;

    if (!bookingId || !propertyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'bookingId y propertyId son requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine target lock
    const envLockId = Deno.env.get('TTLOCK_LOCK_ID') ? Number(Deno.env.get('TTLOCK_LOCK_ID')) : undefined;
    let targetLockId = reqLockId && reqLockId !== 10001 ? reqLockId : undefined;
    if (!targetLockId) {
      const { data: lockRow } = await supabase
        .from('property_locks')
        .select('lock_id')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (lockRow?.lock_id) {
        targetLockId = lockRow.lock_id;
      }
    }
    if (!targetLockId) {
      targetLockId = envLockId;
    }

    const clientId = Deno.env.get('TTLOCK_CLIENT_ID');
    const clientSecret = Deno.env.get('TTLOCK_CLIENT_SECRET');
    const username = Deno.env.get('TTLOCK_USERNAME');
    const password = Deno.env.get('TTLOCK_PASSWORD') || Deno.env.get('TTLOCK_PASSWORD_MD5');
    const apiUrl = Deno.env.get('TTLOCK_API_URL') || 'https://euapi.ttlock.com';

    let pin = customPin || '';
    let keyboardPwdId: number = Date.now();
    let isMock = false;
    let errorMessage: string | null = null;
    const now = Date.now();
    const startDate = now;
    let endDate = now + 6 * 60 * 60 * 1000; // 6 hours for One-Time PIN

    if (clientId && clientSecret && username && password && targetLockId) {
      try {
        const token = await getAccessToken(apiUrl, clientId, clientSecret, username, password);

        const keyboardPwdName = guestName?.trim()
          ? `Reserva ${guestName.trim()}`
          : 'Reserva';

        if (!customPin) {
          // Official One-Time Passcode (6 hours validity, 1 unlock, no custom quota consumed)
          const getParams = new URLSearchParams();
          getParams.append('clientId', clientId);
          getParams.append('accessToken', token);
          getParams.append('lockId', targetLockId.toString());
          getParams.append('keyboardPwdVersion', '4');
          getParams.append('keyboardPwdType', '1'); // 1 = One-time (6 horas)
          getParams.append('keyboardPwdName', keyboardPwdName);
          getParams.append('startDate', now.toString());
          getParams.append('date', now.toString());

          const getRes = await fetch(`${apiUrl}/v3/keyboardPwd/get`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: getParams.toString(),
          });

          const getData = await getRes.json();
          if (getData.errcode && getData.errcode !== 0) {
            throw new Error(getData.errmsg || 'Error creando código en TTLock');
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
          endDate = now + 48 * 60 * 60 * 1000;
          const addParams = new URLSearchParams();
          addParams.append('clientId', clientId);
          addParams.append('accessToken', token);
          addParams.append('lockId', targetLockId.toString());
          addParams.append('keyboardPwd', pin);
          addParams.append('keyboardPwdName', keyboardPwdName);
          addParams.append('startDate', startDate.toString());
          addParams.append('endDate', endDate.toString());
          addParams.append('addType', '2'); // 2 = Send to lock via gateway
          addParams.append('date', now.toString());

          const addRes = await fetch(`${apiUrl}/v3/keyboardPwd/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: addParams.toString(),
          });

          const addData = await addRes.json();
          if (addData.errcode && addData.errcode !== 0) {
            throw new Error(addData.errmsg || 'Error creando código en TTLock');
          }
          if (addData.keyboardPwdId) {
            keyboardPwdId = addData.keyboardPwdId;
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error comunicando con TTLock API';
        console.warn('TTLock API call warning (using fallback mock pin):', message);
        isMock = true;
        errorMessage = message;
      }
    } else {
      isMock = true;
      pin = customPin || Math.floor(10000000 + Math.random() * 90000000).toString();
      errorMessage =
        'PIN de simulación (configure variables TTLock en Supabase para cerradura física)';
    }

    // Insert into booking_ttlock_pins
    const pinPayload = {
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
    };

    // Mark prior active pins as revoked so they remain in history
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

    if (insertError) {
      console.error('Error inserting booking_ttlock_pin:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pin: insertedPin || pinPayload,
        isMock,
        message: isMock
          ? 'PIN generado en modo desarrollo'
          : 'PIN de un solo uso programado en cerradura TTLock',
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
});
