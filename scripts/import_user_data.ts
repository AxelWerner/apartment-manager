import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

const TARGET_PROPERTY_ID = '0f08cc5b-6405-4e9f-8086-c757625a281c';

const expensesCsv = `id,property_id,category,expense_type,description,amount,date,due_date,billing_month,payment_status,is_recurring,recurrence_period,linked_booking_id,receipt_url,notes,created_at,updated_at
02794a4c-ec5e-42a6-a657-68bc0e9f2adc,98849347-7e3e-4a5e-95bf-6344544ab0c6,electricity,utility_monthly,Factura Energía / Luz (EPM) - Julio 2026,303980,2026-09-17,,2026-07,paid,false,,,,,2026-09-17 22:31:03.722396+00,2026-09-17 22:31:03.722396+00
0307d5da-15dd-40f5-8b74-86704eb98ba0,98849347-7e3e-4a5e-95bf-6344544ab0c6,supplies_restock,occasional,Insumos comprados cuando estuvimos en el Apto,457440,2026-09-15,,2026-08,paid,false,,,,,2026-09-15 20:39:57.641259+00,2026-09-15 20:39:57.641259+00
061be4a3-f015-4f43-929e-befd4b3da32e,98849347-7e3e-4a5e-95bf-6344544ab0c6,supplies_restock,occasional,Insumos y Reposición - Septiembre 2026,391194,2026-09-21,,2026-09,paid,false,,,https://fwjwldqicnunazbdnhdo.supabase.co/storage/v1/object/public/apartment-media/receipts/1790161944452-0zj696o.jpeg,Compra Sartenes - plancha y secador de pelo.,2026-09-23 11:13:36.477108+00,2026-09-23 11:13:36.477108+00
1d40fbac-28f1-4bcf-8301-f063670a14f8,98849347-7e3e-4a5e-95bf-6344544ab0c6,electricity,utility_monthly,Factura Energía / Luz (EPM) - Agosto 2026,279050,2026-09-17,,2026-08,paid,false,,,,,2026-09-17 22:42:58.074171+00,2026-09-17 22:42:58.074171+00
284289ce-9ab4-4af1-9bbb-74cc748c8afa,98849347-7e3e-4a5e-95bf-6344544ab0c6,internet_cable,fixed_monthly,Internet Fibra Óptica - Septiembre 2026,104900,2026-09-17,,2026-09,paid,false,,,,,2026-09-17 22:30:15.613734+00,2026-09-17 22:30:15.613734+00
389816a4-5e66-4363-aaf0-cd9c7af06b69,98849347-7e3e-4a5e-95bf-6344544ab0c6,gas,utility_monthly,Factura Gas Natural (EPM) - Agosto 2026,20219,2026-09-17,,2026-08,paid,false,,,,,2026-09-17 22:43:07.638222+00,2026-09-17 22:43:07.638222+00
3baccc3c-763b-4b1d-a2a0-9d1c0d34cba4,98849347-7e3e-4a5e-95bf-6344544ab0c6,internet_cable,fixed_monthly,Internet Fibra Óptica - Agosto 2026,104900,2026-09-17,,2026-08,paid,false,,,,,2026-09-17 22:30:27.875588+00,2026-09-17 22:30:27.875588+00
3d4b9e0d-0af6-4c69-bce3-e6a6f02b0efa,98849347-7e3e-4a5e-95bf-6344544ab0c6,internet_cable,fixed_monthly,Internet Fibra Óptica - Julio 2026,194399,2026-09-17,,2026-07,paid,false,,,,,2026-09-17 22:30:41.171318+00,2026-09-17 22:30:41.171318+00
58ddb7b1-2acd-4025-9a85-534efafc3f12,98849347-7e3e-4a5e-95bf-6344544ab0c6,water,utility_monthly,Factura Agua y Alcantarillado (EPM) - Agosto 2026,104420,2026-09-17,,2026-08,paid,false,,,,,2026-09-17 22:42:50.535084+00,2026-09-17 22:42:50.535084+00
5a2f8d16-a589-4fac-b7eb-39629ed8783f,98849347-7e3e-4a5e-95bf-6344544ab0c6,gas,utility_monthly,Factura Gas Natural (EPM) - Septiembre 2026,13050,2026-09-23,,2026-09,paid,false,,,,,2026-09-23 11:10:25.804307+00,2026-09-23 11:10:25.804307+00
6c71d431-96d5-4404-9dd2-2ab46a26b8ff,98849347-7e3e-4a5e-95bf-6344544ab0c6,other,occasional,Otros Gastos - Septiembre 2026,15000,2026-09-30,,2026-09,paid,false,,,,Auxilio de transporte compra insumos (Sartenes - Plancha - secador),2026-09-30 17:56:05.829011+00,2026-09-30 17:56:05.829011+00
85a46ff7-e617-4ede-9dcf-eb0b742e38f8,98849347-7e3e-4a5e-95bf-6344544ab0c6,hoa_administration,fixed_monthly,Administración Edificio - Agosto 2026,303887,2026-09-17,,2026-08,paid,false,,,,,2026-09-17 22:42:14.910673+00,2026-09-17 22:42:14.910673+00
a2fbdf01-77c5-4e8c-b969-10e65a393bed,98849347-7e3e-4a5e-95bf-6344544ab0c6,maintenance_repairs,occasional,Mantenimiento y Reparaciones - Septiembre 2026,50000,2026-09-30,,2026-09,paid,false,,,,Instalacion dispensador jabon de ducha,2026-09-30 17:53:51.877586+00,2026-09-30 17:53:51.877586+00
a59b04a2-d234-4708-a2d0-3a75d0da4397,98849347-7e3e-4a5e-95bf-6344544ab0c6,water,utility_monthly,Factura Agua y Alcantarillado (EPM) - Julio 2026,56900,2026-09-17,,2026-07,paid,false,,,,,2026-09-17 22:31:12.541677+00,2026-09-17 22:31:12.541677+00
c5160e13-94f6-4a33-8b49-b82bb365b988,98849347-7e3e-4a5e-95bf-6344544ab0c6,hoa_administration,fixed_monthly,Administración Edificio - Julio 2026,263369,2026-09-17,,2026-07,paid,false,,,,,2026-09-17 22:43:28.623535+00,2026-09-17 22:43:28.623535+00
cd77a08b-0cf5-48c0-95d4-04c1d607a4f8,98849347-7e3e-4a5e-95bf-6344544ab0c6,gas,utility_monthly,Factura Gas Natural (EPM) - Julio 2026,13120,2026-09-17,,2026-07,paid,false,,,,,2026-09-17 22:31:21.953908+00,2026-09-17 22:31:21.953908+00
d4cff81f-7910-4683-b581-7c8aea335ee2,98849347-7e3e-4a5e-95bf-6344544ab0c6,electricity,utility_monthly,Factura Energía / Luz (EPM) - Septiembre 2026,552110,2026-09-24,,2026-09,paid,false,,,https://fwjwldqicnunazbdnhdo.supabase.co/storage/v1/object/public/apartment-media/receipts/1790627341299-8t0q3yn.jpg,Fecha limite de pago 27.09.2026,2026-09-24 17:03:54.269447+00,2026-09-28 20:29:01.55037+00
db655a2a-8151-4c04-b399-31b11fbcf73b,98849347-7e3e-4a5e-95bf-6344544ab0c6,hoa_administration,fixed_monthly,Administración Edificio - Septiembre 2026,303887,2026-09-17,,2026-09,paid,false,,,,,2026-09-17 22:30:05.986383+00,2026-09-17 22:30:05.986383+00
e0f441af-59f8-4ffc-a405-528f838b4ea7,98849347-7e3e-4a5e-95bf-6344544ab0c6,insurance_annual,annual,Seguro Anual Zurich Colombia,334687,2026-09-15,,2026-08,paid,false,,,,,2026-09-15 17:10:49.74253+00,2026-09-15 17:10:49.74253+00
ee3bbafc-b73c-4a74-ad8d-d6a616c08acd,98849347-7e3e-4a5e-95bf-6344544ab0c6,water,utility_monthly,Factura Agua y Alcantarillado (EPM) - Septiembre 2026,56900,2026-09-17,,2026-09,paid,false,,,,,2026-09-17 22:29:29.136192+00,2026-09-17 22:29:29.136192+00`;

const bookingsCsv = `id,property_id,airbnb_confirmation_code,guest_name,guest_phone,number_of_guests,check_in,check_out,number_of_nights,nightly_rate,gross_amount,cleaning_fee_collected,airbnb_service_fee,taxes_withheld,net_payout,status,payout_status,payout_date,source,notes,created_at,updated_at,management_fee,owner_payout,booking_date,smart_lock_pin,smart_lock_pin_id,pin_type,pin_status,pin_generated_at,pin_error_message
0c1a50c8-a8f2-4061-8efc-5162e10d74d7,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMF49J3DTD,Julio Cesar Panesso Marulanda,,2,2026-10-15,2026-10-18,3,83932,459500,60000,84755,0,374745,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,62949,251796,2026-09-13,,,one_time,pending,,
0ce1a57a-7e87-48d5-bba6-4710c7aecd45,98849347-7e3e-4a5e-95bf-6344544ab0c6,DIR20260702,Clau - Directa,,1,2026-07-20,2026-07-22,2,153000,400000,60000,0,0,400000,completed,paid,2026-07-20,direct_10,,2026-09-17 23:07:05.402705+00,2026-09-17 23:15:57.70177+00,34000,306000,,,,one_time,pending,,
218d499b-251e-491b-a011-9d9a73373061,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMW8MWTW9H,Daniel Alpargatero,,2,2026-11-08,2026-11-13,5,86961,740000,60000,136493,0,603507,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,108701,434806,2026-09-13,,,one_time,pending,,
2269ee7a-1682-47c5-a567-f6fa650a8f33,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMTT3W59NM,Ale Cortes Velez,,2,2026-10-01,2026-10-03,2,93439,360000,60000,66402,0,293598,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-10-03 19:02:38.532547+00,46720,186878,2026-09-12,152311,1791054158366,one_time,generated,2026-10-03 19:02:38.366+00,
2fd85bf8-f369-48af-b056-29d245143d36,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMRC2CNPYW,Laura Rengifo,,2,2026-07-14,2026-07-18,4,77415,474619,0,87544,0,387076,completed,paid,2026-07-14,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,77415,309661,2026-06-22,,,one_time,pending,,
530c7b07-c426-4f84-8e0f-2462837e75de,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMB8HF8EJZ,Liliana Nieto,,2,2026-09-09,2026-09-11,2,78825,315200,60000,58139,0,257061,completed,paid,2026-09-09,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,39412,157649,2026-09-09,,,one_time,pending,,
71682c5c-9310-49f5-aaff-9a45f7e784f4,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMZR9TMDBD,Harold Lizarazo Molina,,2,2026-10-18,2026-10-21,3,80235,442500,60000,81619,0,360881,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,60176,240705,2026-09-10,,,one_time,pending,,
793685b5-fe80-4aae-afad-6817fb71601b,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMQCK3QCSA,Julian Ruiz Ortiz,,2,2026-09-14,2026-09-17,3,82823,454400,60000,83816,0,370585,completed,paid,2026-09-14,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,62117,248468,2026-09-11,,,one_time,pending,,
79e36c9c-7c8f-44ad-9dd4-f2d093bae023,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMRPENA2H2,David Jara,,2,2026-07-10,2026-07-12,2,99643,305448,0,56340,0,249108,completed,paid,2026-07-10,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,49822,199286,2026-06-22,,,one_time,pending,,
7a10a6d8-5613-4817-8836-97294a28dc5a,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMTYRYAWPK,Juan Amaya,,2,2026-09-25,2026-09-28,3,77462,429750,60000,79267,0,350483,completed,paid,2026-09-25,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,58097,232386,2026-09-11,,,one_time,pending,,
7e8eca7f-9e26-4aac-81ac-10a0cb842f03,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMNW3MBSYD,Yeferson Valencia Quiroga,,2,2026-09-21,2026-09-25,4,39412,315200,60000,58139,0,257061,completed,paid,2026-09-21,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,39412,157649,2026-09-21,,,one_time,pending,,
80939074-a370-4ece-bba5-15a943735b54,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMKBMQQPQW,Sergio Ivan Santos Mora,,2,2026-10-06,2026-10-11,5,81415,697500,60000,128654,0,568846,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,101769,407077,2026-09-08,,,one_time,pending,,
8478379f-0408-46e2-a042-27d222d5f241,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMEQRYRKYD,David Santiago Laverde Rojas,,2,2026-11-22,2026-11-28,6,88643,888750,60000,163930,0,724820,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,132964,531856,2026-09-20,,,one_time,pending,,
8d64ccaf-5469-43ef-a098-8d343c4570cf,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMWFBYYTZ2,Alejandro Urieles,,2,2026-09-29,2026-10-01,2,78825,315200,60000,58139,0,257061,checked_in,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,39412,157649,2026-09-28,,,one_time,pending,,
8d8d81e9-19d3-4aaa-9945-d70047d29819,98849347-7e3e-4a5e-95bf-6344544ab0c6,DIR20260801,Olga - Directa,,2,2026-08-01,2026-08-02,1,112500,210000,60000,0,0,210000,completed,paid,2026-08-01,direct_25,,2026-09-17 23:04:55.024546+00,2026-09-28 16:46:25.255453+00,37500,112500,,,,one_time,pending,,
8f8ed961-4210-4a60-88a1-216276cf871c,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMBC5JQW32,Laura Marcela Florez Hernandez,,2,2026-08-27,2026-08-31,4,89993,625302,60000,115337,0,509965,completed,paid,2026-08-27,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,89993,359972,2026-08-05,,,one_time,pending,,
a894205c-45c1-44e4-8dea-2ac064722495,98849347-7e3e-4a5e-95bf-6344544ab0c6,DIR20260701,Olga - Directa,,1,2026-07-01,2026-07-03,2,142500,440000,60000,0,0,440000,completed,paid,2026-07-01,direct_25,,2026-09-17 23:16:44.887385+00,2026-09-17 23:16:44.887385+00,95000,285000,,,,one_time,pending,,
af4e9c13-8523-4d3c-a452-4e4c6e8c95ca,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMD5MAZ48J,Victoria Alexandra Hernandez,,2,2026-10-23,2026-10-25,2,78759,315000,60000,58102,0,256898,confirmed,pending,,airbnb,Importado vía CSV Airbnb (airbnb_pending (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,39380,157518,2026-09-10,,,one_time,pending,,
be9ebafe-29ce-4f06-8426-b8d9ddf7e4cc,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMPNJPNY2E,Juan Camilo Albadan,,2,2026-09-18,2026-09-21,3,87869,477600,60000,88093,0,389507,completed,paid,2026-09-18,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,65901,263606,2026-09-11,,,one_time,pending,,
c2853e0a-8a24-41c9-be7a-fd97e2fc9da2,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMRC3M4SAR,Nicolás Martín Sanchez,,2,2026-07-22,2026-07-26,4,97727,599148,0,110513,0,488635,completed,paid,2026-07-22,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,97727,390908,2026-06-22,,,one_time,pending,,
c70a835b-07de-4c23-965c-febc38ac2faf,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMTW8FZT3Y,Laura Estefanía Gomez,,2,2026-09-11,2026-09-14,3,68885,390310,60000,71993,0,318317,completed,paid,2026-09-11,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,51663,206654,2026-09-09,,,one_time,pending,,
d2b7d90d-b3d3-4994-b236-94609fa34b27,98849347-7e3e-4a5e-95bf-6344544ab0c6,HMNW3MBSYD,Yeferson Valencia Quiroga,,2,2026-09-21,2026-09-25,4,37320,228800,0,42202,0,186598,completed,paid,2026-09-21,airbnb,Importado vía CSV Airbnb (airbnb_ (4).csv),2026-09-30 17:18:17.804872+00,2026-09-30 17:18:17.804872+00,37320,149278,2026-09-21,,,one_time,pending,,`;

function parseCsv(csvText: string) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // split handling commas inside quotes
    const values: string[] = [];
    let insideQuotes = false;
    let current = '';
    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      let val = values[idx] !== undefined ? values[idx].trim() : '';
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      obj[h] = val === '' ? null : val;
    });
    rows.push(obj);
  }
  return rows;
}

async function runImport() {
  console.log(`Starting import for property: ${TARGET_PROPERTY_ID}...`);

  // 1. Process expenses
  const rawExpenses = parseCsv(expensesCsv);
  const formattedExpenses = rawExpenses.map((e) => ({
    ...e,
    property_id: TARGET_PROPERTY_ID,
    amount: Number(e.amount) || 0,
    is_recurring: e.is_recurring === 'true',
    recurrence_period: e.recurrence_period || null,
    due_date: e.due_date || null,
    linked_booking_id: e.linked_booking_id || null,
    receipt_url: e.receipt_url || null,
    notes: e.notes || null,
  }));

  console.log(`Inserting ${formattedExpenses.length} expenses...`);
  const { error: expError } = await supabase.from('expenses').upsert(formattedExpenses);
  if (expError) {
    console.error('Error inserting expenses:', expError);
  } else {
    console.log('✅ Expenses inserted successfully!');
  }

  // 2. Process bookings
  const rawBookings = parseCsv(bookingsCsv);
  const formattedBookings = rawBookings.map((b) => ({
    id: b.id,
    property_id: TARGET_PROPERTY_ID,
    airbnb_confirmation_code: b.airbnb_confirmation_code || null,
    guest_name: b.guest_name,
    guest_phone: b.guest_phone || null,
    number_of_guests: Number(b.number_of_guests) || 1,
    check_in: b.check_in,
    check_out: b.check_out,
    number_of_nights: Number(b.number_of_nights) || 1,
    nightly_rate: Number(b.nightly_rate) || 0,
    gross_amount: Number(b.gross_amount) || 0,
    cleaning_fee_collected: Number(b.cleaning_fee_collected) || 0,
    airbnb_service_fee: Number(b.airbnb_service_fee) || 0,
    taxes_withheld: Number(b.taxes_withheld) || 0,
    net_payout: Number(b.net_payout) || 0,
    management_fee: b.management_fee ? Number(b.management_fee) : 0,
    owner_payout: b.owner_payout ? Number(b.owner_payout) : 0,
    status: b.status || 'confirmed',
    payout_status: b.payout_status || 'pending',
    payout_date: b.payout_date || null,
    source: b.source || 'airbnb',
    notes: b.notes || null,
    booking_date: b.booking_date || null,
  }));

  console.log(`Inserting ${formattedBookings.length} bookings...`);
  const { error: bookError } = await supabase.from('bookings').upsert(formattedBookings);
  if (bookError) {
    console.error('Error inserting bookings:', bookError);
  } else {
    console.log('✅ Bookings inserted successfully!');
  }

  console.log('Import finished.');
}

runImport();
