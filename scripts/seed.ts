import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_PROPERTY,
  INITIAL_TEMPLATES,
  INITIAL_BOOKINGS,
  INITIAL_EXPENSES,
  INITIAL_DAMAGES,
} from '../src/lib/mock-data.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');

// Parse .env.local
const envContent = fs.readFileSync(envPath, 'utf8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL="?([^"\n]+)"?/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY="?([^"\n]+)"?/);

if (!urlMatch || !keyMatch) {
  console.error('Error: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const supabaseAnonKey = keyMatch[1].trim();

console.log('Connecting to Supabase at:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSeed() {
  console.log('--- 1. UPSERT PROPERTY ---');
  const { error: propError } = await supabase
    .from('properties')
    .upsert({
      id: INITIAL_PROPERTY.id,
      name: INITIAL_PROPERTY.name,
      address: INITIAL_PROPERTY.address,
      city: INITIAL_PROPERTY.city,
      currency: INITIAL_PROPERTY.currency,
      default_nightly_rate: INITIAL_PROPERTY.default_nightly_rate,
      default_cleaning_fee: INITIAL_PROPERTY.default_cleaning_fee,
      monthly_revenue_target: INITIAL_PROPERTY.monthly_revenue_target || 3000000,
      check_in_time: INITIAL_PROPERTY.check_in_time,
      check_out_time: INITIAL_PROPERTY.check_out_time,
    });

  if (propError) {
    console.error('Failed to upsert property:', propError);
    process.exit(1);
  }
  console.log('Property seeded successfully:', INITIAL_PROPERTY.name);

  console.log('--- 2. UPSERT RECURRING BILL TEMPLATES ---');
  const templatesToInsert = INITIAL_TEMPLATES.map((tmpl) => ({
    property_id: INITIAL_PROPERTY.id,
    category: tmpl.category,
    expense_type: tmpl.expense_type,
    name: tmpl.name,
    default_amount: tmpl.default_amount,
    typical_due_day: tmpl.typical_due_day,
    annual_due_month: tmpl.annual_due_month,
    is_active: tmpl.is_active,
    notes: tmpl.notes,
  }));

  const { error: tmplError } = await supabase
    .from('recurring_bill_templates')
    .insert(templatesToInsert);
  if (tmplError) {
    console.log('Templates note (might already exist):', tmplError.message);
  } else {
    console.log(`Inserted ${templatesToInsert.length} recurring templates.`);
  }

  console.log('--- 3. INSERT BOOKINGS ---');
  // Check if bookings already exist
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('id, airbnb_confirmation_code');

  const bookingIdMap = new Map<string, string>(); // mockId -> real UUID

  if (existingBookings && existingBookings.length > 0) {
    console.log(`Found ${existingBookings.length} existing bookings.`);
    for (const b of existingBookings) {
      if (b.airbnb_confirmation_code) {
        const mockMatch = INITIAL_BOOKINGS.find((mb) => mb.airbnb_confirmation_code === b.airbnb_confirmation_code);
        if (mockMatch) {
          bookingIdMap.set(mockMatch.id, b.id);
        }
      }
    }
  } else {
    const bookingsPayload = INITIAL_BOOKINGS.map((b) => ({
      property_id: INITIAL_PROPERTY.id,
      airbnb_confirmation_code: b.airbnb_confirmation_code,
      guest_name: b.guest_name,
      guest_phone: b.guest_phone,
      number_of_guests: b.number_of_guests,
      check_in: b.check_in,
      check_out: b.check_out,
      number_of_nights: b.number_of_nights,
      nightly_rate: b.nightly_rate,
      gross_amount: b.gross_amount,
      cleaning_fee_collected: b.cleaning_fee_collected,
      airbnb_service_fee: b.airbnb_service_fee,
      taxes_withheld: b.taxes_withheld,
      net_payout: b.net_payout,
      status: b.status,
      payout_status: b.payout_status,
      payout_date: b.payout_date,
      source: b.source,
      notes: b.notes,
    }));

    const { data: insertedBookings, error: insertBookingsError } = await supabase
      .from('bookings')
      .insert(bookingsPayload)
      .select('id, airbnb_confirmation_code');

    if (insertBookingsError) {
      console.error('Failed to insert bookings:', insertBookingsError);
      process.exit(1);
    }

    console.log(`Successfully inserted ${insertedBookings?.length} bookings.`);

    // Build mockId -> inserted UUID map
    for (const b of insertedBookings || []) {
      const mockMatch = INITIAL_BOOKINGS.find((mb) => mb.airbnb_confirmation_code === b.airbnb_confirmation_code);
      if (mockMatch) {
        bookingIdMap.set(mockMatch.id, b.id);
      }
    }
  }

  console.log('--- 4. INSERT EXPENSES ---');
  const { data: existingExpenses } = await supabase.from('expenses').select('id').limit(1);

  if (existingExpenses && existingExpenses.length > 0) {
    console.log('Expenses already exist, skipping insert.');
  } else {
    const expensesPayload = INITIAL_EXPENSES.map((exp) => ({
      property_id: INITIAL_PROPERTY.id,
      category: exp.category,
      expense_type: exp.expense_type,
      description: exp.description,
      amount: exp.amount,
      date: exp.date,
      due_date: exp.due_date,
      billing_month: exp.billing_month,
      payment_status: exp.payment_status,
      is_recurring: exp.is_recurring,
      recurrence_period: exp.recurrence_period,
      linked_booking_id: exp.linked_booking_id ? bookingIdMap.get(exp.linked_booking_id) || null : null,
      receipt_url: exp.receipt_url,
      notes: exp.notes,
    }));

    const { data: insertedExpenses, error: expError } = await supabase
      .from('expenses')
      .insert(expensesPayload)
      .select('id');

    if (expError) {
      console.error('Failed to insert expenses:', expError);
      process.exit(1);
    }
    console.log(`Successfully inserted ${insertedExpenses?.length} expenses.`);
  }

  console.log('--- 5. INSERT DAMAGES ---');
  const { data: existingDamages } = await supabase.from('damages').select('id').limit(1);

  if (existingDamages && existingDamages.length > 0) {
    console.log('Damages already exist, skipping insert.');
  } else {
    const damagesPayload = INITIAL_DAMAGES.map((dmg) => ({
      property_id: INITIAL_PROPERTY.id,
      linked_booking_id: dmg.linked_booking_id ? bookingIdMap.get(dmg.linked_booking_id) || null : null,
      title: dmg.title,
      description: dmg.description,
      date_discovered: dmg.date_discovered,
      severity: dmg.severity,
      estimated_repair_cost: dmg.estimated_repair_cost,
      actual_repair_cost: dmg.actual_repair_cost,
      reimbursement_amount: dmg.reimbursement_amount,
      claim_status: dmg.claim_status,
      aircover_case_number: dmg.aircover_case_number,
      resolution_notes: dmg.resolution_notes,
      photo_urls: dmg.photo_urls,
    }));

    const { data: insertedDamages, error: dmgError } = await supabase
      .from('damages')
      .insert(damagesPayload)
      .select('id');

    if (dmgError) {
      console.error('Failed to insert damages:', dmgError);
      process.exit(1);
    }
    console.log(`Successfully inserted ${insertedDamages?.length} damages.`);
  }

  console.log('\n🎉 ¡Base de datos de Supabase totalmente poblada y sincronizada!');
}

runSeed().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
