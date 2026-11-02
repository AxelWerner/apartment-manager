import { createClient } from '@supabase/supabase-js';

export interface ServiceScheduleItem {
  category: string;
  label: string;
  provider: string;
  typicalDueDay: number;
}

export const OFFICIAL_SCHEDULE: ServiceScheduleItem[] = [
  { category: 'hoa_administration', label: 'Administración', provider: 'Edificio / Portería', typicalDueDay: 5 },
  { category: 'water', label: 'Agua / Acueducto (EPM)', provider: 'EPM', typicalDueDay: 10 },
  { category: 'internet_cable', label: 'Internet y TV / Teléfono', provider: 'Tigo / Claro Fibra', typicalDueDay: 15 },
  { category: 'gas', label: 'Gas Natural (EPM)', provider: 'EPM', typicalDueDay: 24 },
  { category: 'electricity', label: 'Energía / Luz (EPM)', provider: 'EPM', typicalDueDay: 25 },
];

/**
 * Builds HTML email body for a service bill reminder
 */
export function buildReminderEmailHtml({
  propertyName,
  serviceLabel,
  provider,
  typicalDueDay,
  currentMonthStr,
  status,
  appUrl,
  propertyId,
}: {
  propertyName: string;
  serviceLabel: string;
  provider: string;
  typicalDueDay: number;
  currentMonthStr: string;
  status: 'awaiting_invoice' | 'pending';
  appUrl: string;
  propertyId: string;
}): string {
  const expenseUrl = `${appUrl.replace(/\/$/, '')}/p/${propertyId}/expenses?month=${currentMonthStr}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recordatorio de Servicio - AptOS</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }
    .content { padding: 28px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background-color: #e0f2fe; color: #0369a1; margin-bottom: 16px; }
    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .card-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .card-row:last-child { margin-bottom: 0; }
    .label { color: #64748b; }
    .value { font-weight: 600; color: #0f172a; }
    .btn { display: inline-block; background-color: #e11d48; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; margin-top: 12px; text-align: center; }
    .footer { padding: 18px 28px; background: #f1f5f9; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AptOS • Recordatorio de Servicios</h1>
    </div>
    <div class="content">
      <span class="badge">Vence el día ${typicalDueDay} de cada mes</span>
      <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0f172a;">Revisión de ${serviceLabel}</h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #475569;">
        Hola. Te recordamos revisar la factura y estado de pago de <strong>${serviceLabel}</strong> para tu propiedad <strong>${propertyName}</strong>.
      </p>

      <div class="card">
        <div class="card-row">
          <span class="label">Propiedad:</span>
          <span class="value">${propertyName}</span>
        </div>
        <div class="card-row">
          <span class="label">Servicio:</span>
          <span class="value">${serviceLabel}</span>
        </div>
        <div class="card-row">
          <span class="label">Proveedor:</span>
          <span class="value">${provider}</span>
        </div>
        <div class="card-row">
          <span class="label">Estado Actual:</span>
          <span class="value">${status === 'pending' ? 'Facturado · Pendiente de pago' : 'Esperando factura'}</span>
        </div>
      </div>

      <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
        Si ya recibiste la cuenta de cobro física o digital, puedes escanearla con IA o registrar el pago directamente en la app:
      </p>

      <div style="text-align: center;">
        <a href="${expenseUrl}" class="btn">Abrir Control de Gastos y Escanear</a>
      </div>
    </div>
    <div class="footer">
      Este aviso fue enviado automáticamente únicamente a usuarios con rol Dueño Principal y Dueño de ${propertyName}.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Main Cron Reminders Handler
 */
export async function handleCronReminders(req: Request) {
  const url = new URL(req.url);

  // 1. Authorization check
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const authHeader = req.headers.get('authorization');
  const querySecret = url.searchParams.get('secret');

  if (cronSecret && !isVercelCron) {
    const isAuthorized =
      authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 2. Initialize Supabase
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://placeholder.supabase.co';
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    'placeholder';

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail =
    process.env.RESEND_FROM_EMAIL || 'AptOS <onboarding@resend.dev>';
  const appBaseUrl =
    process.env.APP_URL ||
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173';

  // 3. Current date evaluation
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonthNum = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const dryRunParam = url.searchParams.get('dry_run');
  const isDryRun = dryRunParam === 'true' || !resendApiKey;

  try {
    // 4. Fetch all active properties
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, name, primary_owner_id, created_by, is_active')
      .eq('is_active', true);

    if (propError || !properties) {
      return new Response(
        JSON.stringify({ error: 'Error al consultar propiedades', details: propError }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const processedReports = [];

    // 5. Evaluate each property
    for (const prop of properties) {
      // Find eligible recipient user IDs: ONLY PRIMARY_OWNER and OWNER
      const { data: members } = await supabase
        .from('property_members')
        .select('user_id, role')
        .eq('property_id', prop.id)
        .in('role', ['PRIMARY_OWNER', 'OWNER']);

      const eligibleUserIds = new Set<string>();
      if (prop.primary_owner_id) eligibleUserIds.add(prop.primary_owner_id);
      if (prop.created_by) eligibleUserIds.add(prop.created_by);
      if (members) {
        members.forEach((m) => eligibleUserIds.add(m.user_id));
      }

      if (eligibleUserIds.size === 0) continue;

      // Fetch user profile emails
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', Array.from(eligibleUserIds));

      const recipientEmails = (profiles || [])
        .map((p) => p.email)
        .filter((email): email is string => Boolean(email));

      if (recipientEmails.length === 0) continue;

      // Fetch expenses for current month
      const { data: expenses } = await supabase
        .from('expenses')
        .select('category, payment_status, amount, due_date')
        .eq('property_id', prop.id)
        .eq('billing_month', currentMonthStr);

      const paidCategories = new Set(
        (expenses || [])
          .filter((e) => e.payment_status === 'paid')
          .map((e) => e.category)
      );

      const pendingMap = new Map(
        (expenses || [])
          .filter((e) => e.payment_status === 'pending')
          .map((e) => [e.category, e])
      );

      // Check which services are due today or within reminder window (currentDay >= typicalDueDay - 2)
      for (const service of OFFICIAL_SCHEDULE) {
        if (paidCategories.has(service.category)) {
          continue; // Already paid
        }

        const isDueToday = currentDay === service.typicalDueDay;
        const isApproaching = currentDay === service.typicalDueDay - 2;

        // Dispatched only on reminder days (day of cutoff or 2 days prior notice)
        if (!isDueToday && !isApproaching) {
          continue;
        }

        const isPending = pendingMap.has(service.category);
        const status: 'awaiting_invoice' | 'pending' = isPending ? 'pending' : 'awaiting_invoice';

        const subject = isDueToday
          ? `🔔 Recordatorio Hoy: Revisar pago de ${service.label} (${prop.name})`
          : `⏰ Próximo Vencimiento: ${service.label} en 2 días (${prop.name})`;

        const html = buildReminderEmailHtml({
          propertyName: prop.name,
          serviceLabel: service.label,
          provider: service.provider,
          typicalDueDay: service.typicalDueDay,
          currentMonthStr,
          status,
          appUrl: appBaseUrl,
          propertyId: prop.id,
        });

        // Send via Resend or log dry-run
        let sendResult = null;
        if (!isDryRun && resendApiKey) {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: resendFromEmail,
              to: recipientEmails,
              subject,
              html,
            }),
          });
          sendResult = await resendResponse.json();
        }

        processedReports.push({
          propertyId: prop.id,
          propertyName: prop.name,
          service: service.label,
          dueDay: service.typicalDueDay,
          isDueToday,
          recipients: recipientEmails,
          dryRun: isDryRun,
          sendResult,
        });
      }
    }

    return new Response(
      JSON.stringify(
        {
          success: true,
          date: now.toISOString(),
          dayOfMonth: currentDay,
          month: currentMonthStr,
          dryRun: isDryRun,
          totalRemindersTriggered: processedReports.length,
          reports: processedReports,
        },
        null,
        2
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: 'Error inesperado en cron de recordatorios', message: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(req: Request) {
  return handleCronReminders(req);
}

export async function POST(req: Request) {
  return handleCronReminders(req);
}
