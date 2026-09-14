import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Mock Data definitions to make this script 100% standalone and runnable via plain `node`
const MOCK_BOOKINGS = [
  {
    guest_name: "Juan Pérez",
    check_in: "2026-03-02",
    check_out: "2026-03-06",
    nightly_rate: 280000,
    cleaning_fee: 90000,
    airbnb_fees: 40000,
    total_payout: 1170000,
    status: "completed",
    notes: "Primer huésped de la temporada. Altamente recomendado. Dejó el apartamento impecable.",
  },
  {
    guest_name: "María Rodríguez",
    check_in: "2026-03-09",
    check_out: "2026-03-16",
    nightly_rate: 260000,
    cleaning_fee: 90000,
    airbnb_fees: 65000,
    total_payout: 1845000,
    status: "completed",
    notes: "Huésped muy ordenada, comunicativa y educada.",
  },
  {
    guest_name: "John Doe",
    check_in: "2026-03-18",
    check_out: "2026-03-23",
    nightly_rate: 300000,
    cleaning_fee: 90000,
    airbnb_fees: 50000,
    total_payout: 1540000,
    status: "completed",
    notes: "Dejó una reseña de 5 estrellas en Airbnb.",
  },
  {
    guest_name: "Sofía Martínez",
    check_in: "2026-04-01",
    check_out: "2026-04-06",
    nightly_rate: 280000,
    cleaning_fee: 90000,
    airbnb_fees: 48000,
    total_payout: 1442000,
    status: "completed",
    notes: "Estadía perfecta. Sin quejas.",
  },
  {
    guest_name: "Pierre Dubois",
    check_in: "2026-04-08",
    check_out: "2026-04-12",
    nightly_rate: 310000,
    cleaning_fee: 90000,
    airbnb_fees: 42000,
    total_payout: 1288000,
    status: "completed",
    notes: "Viajero de negocios de Francia. Check-in tardío.",
  },
  {
    guest_name: "Emily Watson",
    check_in: "2026-04-15",
    check_out: "2026-04-22",
    nightly_rate: 290000,
    cleaning_fee: 90000,
    airbnb_fees: 68000,
    total_payout: 2052000,
    status: "completed",
    notes: "Viajó con su familia. Recomendó lugares para comer.",
  },
  {
    guest_name: "Carlos Gómez",
    check_in: "2026-05-02",
    check_out: "2026-05-09",
    nightly_rate: 320000,
    cleaning_fee: 90000,
    airbnb_fees: 72000,
    total_payout: 2258000,
    status: "completed",
    notes: "Hizo el check-out temprano. Muy cooperativo.",
  },
  {
    guest_name: "Yuki Sato",
    check_in: "2026-05-12",
    check_out: "2026-05-18",
    nightly_rate: 300000,
    cleaning_fee: 90000,
    airbnb_fees: 60000,
    total_payout: 1830000,
    status: "completed",
    notes: "Solicitó check-out tardío. Dejó una reseña muy amable.",
  },
  {
    guest_name: "Mateo Silva",
    check_in: "2026-05-20",
    check_out: "2026-05-28",
    nightly_rate: 290000,
    cleaning_fee: 90000,
    airbnb_fees: 78000,
    total_payout: 2332000,
    status: "completed",
    notes: "Todo salió bien.",
  },
  {
    guest_name: "Sarah Jenkins",
    check_in: "2026-06-01",
    check_out: "2026-06-05",
    nightly_rate: 330000,
    cleaning_fee: 90000,
    airbnb_fees: 45000,
    total_payout: 1365000,
    status: "completed",
    notes: "Turista visitando Medellín. Gran huésped.",
  },
  {
    guest_name: "David Beckham",
    check_in: "2026-06-08",
    check_out: "2026-06-15",
    nightly_rate: 340000,
    cleaning_fee: 90000,
    airbnb_fees: 80000,
    total_payout: 2390000,
    status: "confirmed",
    notes: "Huésped entrante. Perfil verificado.",
  },
  {
    guest_name: "Clara Dupont",
    check_in: "2026-06-18",
    check_out: "2026-06-25",
    nightly_rate: 350000,
    cleaning_fee: 90000,
    airbnb_fees: 82000,
    total_payout: 2458000,
    status: "confirmed",
    notes: "Huésped recurrente. Prefiere el check-in alrededor de las 3 PM.",
  },
  {
    guest_name: "Michael Chang",
    check_in: "2026-07-02",
    check_out: "2026-07-10",
    nightly_rate: 360000,
    cleaning_fee: 90000,
    airbnb_fees: 96000,
    total_payout: 2874000,
    status: "confirmed",
    notes: "Reservado con bastante anticipación.",
  },
];

const MOCK_FIXED_EXPENSES = [
  // March 2026
  { description: "Alquiler mensual del apartamento - Marzo", category: "fixed_cost", amount: 2200000, date: "2026-03-01", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Internet y TV Claro - Marzo", category: "fixed_cost", amount: 130000, date: "2026-03-05", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Cuota de administración del edificio - Marzo", category: "fixed_cost", amount: 350000, date: "2026-03-02", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Servicios públicos EPM (Agua y Energía) - Marzo", category: "fixed_cost", amount: 280000, date: "2026-03-10", recurring: true, recurrence_rule: "monthly", paid: true },

  // April 2026
  { description: "Alquiler mensual del apartamento - Abril", category: "fixed_cost", amount: 2200000, date: "2026-04-01", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Internet y TV Claro - Abril", category: "fixed_cost", amount: 130000, date: "2026-04-05", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Cuota de administración del edificio - Abril", category: "fixed_cost", amount: 350000, date: "2026-04-02", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Servicios públicos EPM (Agua y Energía) - Abril", category: "fixed_cost", amount: 275000, date: "2026-04-10", recurring: true, recurrence_rule: "monthly", paid: true },

  // May 2026
  { description: "Alquiler mensual del apartamento - Mayo", category: "fixed_cost", amount: 2200000, date: "2026-05-01", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Internet y TV Claro - Mayo", category: "fixed_cost", amount: 130000, date: "2026-05-05", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Cuota de administración del edificio - Mayo", category: "fixed_cost", amount: 350000, date: "2026-05-02", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Servicios públicos EPM (Agua y Energía) - Mayo", category: "fixed_cost", amount: 290000, date: "2026-05-10", recurring: true, recurrence_rule: "monthly", paid: true },

  // June 2026
  { description: "Alquiler mensual del apartamento - Junio", category: "fixed_cost", amount: 2200000, date: "2026-06-01", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Internet y TV Claro - Junio", category: "fixed_cost", amount: 130000, date: "2026-06-05", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Cuota de administración del edificio - Junio", category: "fixed_cost", amount: 350000, date: "2026-06-02", recurring: true, recurrence_rule: "monthly", paid: true },
  { description: "Servicios públicos EPM (Agua y Energía) - Junio", category: "fixed_cost", amount: 310000, date: "2026-06-10", recurring: true, recurrence_rule: "monthly", paid: false },

  // July 2026
  { description: "Alquiler mensual del apartamento - Julio", category: "fixed_cost", amount: 2200000, date: "2026-07-01", recurring: true, recurrence_rule: "monthly", paid: false },
  { description: "Internet y TV Claro - Julio", category: "fixed_cost", amount: 130000, date: "2026-07-05", recurring: true, recurrence_rule: "monthly", paid: false },
  { description: "Cuota de administración del edificio - Julio", category: "fixed_cost", amount: 350000, date: "2026-07-02", recurring: true, recurrence_rule: "monthly", paid: false },
  { description: "Servicios públicos EPM (Agua y Energía) - Julio", category: "fixed_cost", amount: 285000, date: "2026-07-10", recurring: true, recurrence_rule: "monthly", paid: false },
];

const MOCK_OTHER_EXPENSES = [
  // Maintenance
  { description: "Reparación de plomería en cocina (fuga de lavaplatos)", category: "maintenance", amount: 120000, date: "2026-03-14", recurring: false, recurrence_rule: null, paid: true },
  { description: "Mantenimiento y desinfección profunda de aire acondicionado", category: "maintenance", amount: 250000, date: "2026-05-19", recurring: false, recurrence_rule: null, paid: true },
  { description: "Reemplazo de copas de vino y vasos rotos", category: "maintenance", amount: 45000, date: "2026-06-04", recurring: false, recurrence_rule: null, paid: true },

  // Supplies
  { description: "Insumos de bienvenida (Café, snacks y papel higiénico)", category: "supplies", amount: 45000, date: "2026-03-02", recurring: false, recurrence_rule: null, paid: true },
  { description: "Insumos de aseo y recarga de jabón", category: "supplies", amount: 60000, date: "2026-04-08", recurring: false, recurrence_rule: null, paid: true },
  { description: "Reemplazo de toallas premium y almohadas", category: "supplies", amount: 180000, date: "2026-05-12", recurring: false, recurrence_rule: null, paid: true },
  { description: "Papel higiénico y limpiador de pisos multiusos", category: "supplies", amount: 55000, date: "2026-06-01", recurring: false, recurrence_rule: null, paid: true },

  // Supervisor
  { description: "Asistente de gestión de check-in - Marzo", category: "supervisor", amount: 200000, date: "2026-03-28", recurring: false, recurrence_rule: null, paid: true },
  { description: "Asistente de gestión de check-in - Abril", category: "supervisor", amount: 200000, date: "2026-04-28", recurring: false, recurrence_rule: null, paid: true },
  { description: "Asistente de gestión de check-in - Mayo", category: "supervisor", amount: 200000, date: "2026-05-28", recurring: false, recurrence_rule: null, paid: true },
  { description: "Asistente de gestión de check-in - Junio", category: "supervisor", amount: 200000, date: "2026-06-28", recurring: false, recurrence_rule: null, paid: false },
];

async function runSeeding() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const envPath = path.resolve(__dirname, "../.env.local");

  console.log("Loading .env.local from:", envPath);
  let envFileContent = "";
  try {
    envFileContent = fs.readFileSync(envPath, "utf8");
  } catch (e) {
    console.error("Warning: Could not load .env.local file. Trying process env.", e);
  }

  const env = {};
  if (envFileContent) {
    envFileContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        env[key] = value;
      }
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Error: Supabase url or anon key not found in environment variables.");
    process.exit(1);
  }

  console.log("Connecting to Supabase at:", supabaseUrl);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  console.log("Limpiando datos existentes en la base de datos...");
  const { error: deleteExpensesError } = await supabase.from("expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteExpensesError) {
    console.error("Failed to delete expenses:", deleteExpensesError);
    process.exit(1);
  }

  const { error: deleteBookingsError } = await supabase.from("bookings").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (deleteBookingsError) {
    console.error("Failed to delete bookings:", deleteBookingsError);
    process.exit(1);
  }

  console.log("Insertando reservas...");
  const { data: insertedBookings, error: insertBookingsError } = await supabase
    .from("bookings")
    .insert(MOCK_BOOKINGS)
    .select();

  if (insertBookingsError) {
    console.error("Failed to insert bookings:", insertBookingsError);
    process.exit(1);
  }

  console.log(`Inserted ${insertedBookings.length} bookings.`);

  console.log("Creando gastos de limpieza...");
  const cleaningExpenses = insertedBookings.map((booking) => {
    const mockMatch = MOCK_BOOKINGS.find(
      (mb) => mb.guest_name === booking.guest_name && mb.check_in === booking.check_in
    );
    const isPaid = mockMatch ? mockMatch.status === "completed" : false;

    return {
      category: "cleaning",
      description: `Servicio de limpieza - Huésped: ${booking.guest_name}`,
      amount: booking.cleaning_fee || 90000,
      date: booking.check_out,
      recurring: false,
      recurrence_rule: null,
      paid: isPaid,
      linked_booking_id: booking.id,
      notes: `Vinculado automáticamente a la reserva de ${booking.guest_name}`,
    };
  });

  const allExpenses = [
    ...MOCK_FIXED_EXPENSES,
    ...MOCK_OTHER_EXPENSES,
    ...cleaningExpenses,
  ];

  console.log("Insertando todos los gastos (Costo Fijo, Limpieza, Mantenimiento, Insumos, Supervisión)...");
  const { error: insertExpensesError } = await supabase
    .from("expenses")
    .insert(allExpenses);

  if (insertExpensesError) {
    console.error("Failed to insert expenses:", insertExpensesError);
    process.exit(1);
  }

  console.log(`Successfully inserted ${allExpenses.length} expenses.`);
  console.log("🎉 ¡Carga de base de datos finalizada con éxito!");
}

runSeeding();
