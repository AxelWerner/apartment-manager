import type { Expense, ExpenseCategory } from '@/types/database';

export const EMPTY_APT_FIXED_ELECTRICITY = 70000; // 70.000 COP fijo para apartamento vacío
export const DEFAULT_INSURANCE_ANNUAL = 1350000; // 1.350.000 COP anual estimado
export const DEFAULT_MONTHLY_INSURANCE = Math.round(DEFAULT_INSURANCE_ANNUAL / 12); // 112.500 COP

export const DEFAULT_BILL_AMOUNTS: Record<string, number> = {
  hoa_administration: 303887,
  internet_cable: 104900,
  electricity: 290000,
  water: 110000,
  gas: 35000,
};

export interface CostItemBreakdown {
  key: string;
  label: string;
  category: ExpenseCategory;
  emptyAmount: number;
  occupiedAmount: number;
  isRegistered: boolean;
  actualAmount?: number;
  note?: string;
}

export interface DailyCostsCalculation {
  monthStr: string;
  daysInMonth: number;
  // Empty apt ("Valor de apto vacio")
  emptyTotalMonthly: number;
  emptyDailyCost: number;
  // Occupied apt ("Valor de apto con gente")
  occupiedTotalMonthly: number;
  occupiedDailyCost: number;
  // Comparison
  dailySavings: number;
  monthlySavings: number;
  // Item details
  items: CostItemBreakdown[];
  // Insurance info
  annualInsuranceTotal: number;
  monthlyAmortizedInsurance: number;
  hasActiveInsurance: boolean;
  registeredCount: number;
}

/**
 * Calculates the daily cost of the apartment under two scenarios:
 * 1. "Valor de apto con gente": Adm, Wifi, Luz, Agua, Gas y Seguro prorrateado mensual
 * 2. "Valor de apto vacio": Adm, Wifi, Seguro prorrateado mensual y Luz fijada en 70.000 COP (sin agua ni gas)
 *
 * @param monthStr Year-month string, e.g. '2026-10'
 * @param monthExpenses List of expenses for the selected month
 * @param allExpenses Full list of expenses (to resolve active annual insurance policy)
 */
export function calculateApartmentDailyCosts(
  monthStr: string,
  monthExpenses: Expense[],
  allExpenses: Expense[] = []
): DailyCostsCalculation {
  const [year, month] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Find active annual insurance policy from all expenses
  const insuranceExpenses = allExpenses
    .filter((e) => e.category === 'insurance_annual' || e.expense_type === 'annual')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeInsurance = insuranceExpenses[0];
  const annualInsuranceTotal = activeInsurance ? Number(activeInsurance.amount) : DEFAULT_INSURANCE_ANNUAL;
  const monthlyAmortizedInsurance = Math.round(annualInsuranceTotal / 12);
  const hasActiveInsurance = Boolean(activeInsurance);

  // Helper to find a specific bill expense in this month
  const findExpense = (cat: ExpenseCategory) => monthExpenses.find((e) => e.category === cat);

  const hoaExp = findExpense('hoa_administration');
  const wifiExp = findExpense('internet_cable');
  const elecExp = findExpense('electricity');
  const waterExp = findExpense('water');
  const gasExp = findExpense('gas');

  const hoaVal = hoaExp ? Number(hoaExp.amount) : DEFAULT_BILL_AMOUNTS.hoa_administration;
  const wifiVal = wifiExp ? Number(wifiExp.amount) : DEFAULT_BILL_AMOUNTS.internet_cable;
  const elecVal = elecExp ? Number(elecExp.amount) : DEFAULT_BILL_AMOUNTS.electricity;
  const waterVal = waterExp ? Number(waterExp.amount) : DEFAULT_BILL_AMOUNTS.water;
  const gasVal = gasExp ? Number(gasExp.amount) : DEFAULT_BILL_AMOUNTS.gas;

  let registeredCount = 0;
  if (hoaExp) registeredCount++;
  if (wifiExp) registeredCount++;
  if (elecExp) registeredCount++;
  if (waterExp) registeredCount++;
  if (gasExp) registeredCount++;

  const items: CostItemBreakdown[] = [
    {
      key: 'hoa_administration',
      label: 'Administración',
      category: 'hoa_administration',
      emptyAmount: hoaVal,
      occupiedAmount: hoaVal,
      isRegistered: Boolean(hoaExp),
      actualAmount: hoaExp ? hoaVal : undefined,
      note: 'Costo fijo mensual del edificio',
    },
    {
      key: 'internet_cable',
      label: 'Internet y TV (Wi-Fi)',
      category: 'internet_cable',
      emptyAmount: wifiVal,
      occupiedAmount: wifiVal,
      isRegistered: Boolean(wifiExp),
      actualAmount: wifiExp ? wifiVal : undefined,
      note: 'Conexión activa permanente',
    },
    {
      key: 'insurance_annual',
      label: 'Seguro Todo Riesgo',
      category: 'insurance_annual',
      emptyAmount: monthlyAmortizedInsurance,
      occupiedAmount: monthlyAmortizedInsurance,
      isRegistered: hasActiveInsurance,
      actualAmount: activeInsurance ? monthlyAmortizedInsurance : undefined,
      note: 'Prorrateo mensual de la póliza anual',
    },
    {
      key: 'electricity',
      label: 'Energía / Luz (EPM)',
      category: 'electricity',
      emptyAmount: EMPTY_APT_FIXED_ELECTRICITY, // 70.000 COP fixed
      occupiedAmount: elecVal,
      isRegistered: Boolean(elecExp),
      actualAmount: elecExp ? elecVal : undefined,
      note: `Vacío: Fijo 70.000 COP (nevera/standby) · Ocupado: ${elecExp ? 'Factura real' : 'Consumo estimado'}`,
    },
    {
      key: 'water',
      label: 'Agua / Acueducto (EPM)',
      category: 'water',
      emptyAmount: 0,
      occupiedAmount: waterVal,
      isRegistered: Boolean(waterExp),
      actualAmount: waterExp ? waterVal : undefined,
      note: 'Vacío: $0 (sin consumo) · Ocupado: Ducha y sanitarios',
    },
    {
      key: 'gas',
      label: 'Gas Natural (EPM)',
      category: 'gas',
      emptyAmount: 0,
      occupiedAmount: gasVal,
      isRegistered: Boolean(gasExp),
      actualAmount: gasExp ? gasVal : undefined,
      note: 'Vacío: $0 (sin consumo) · Ocupado: Calentador y estufa',
    },
  ];

  // Totals
  const emptyTotalMonthly = items.reduce((sum, it) => sum + it.emptyAmount, 0);
  const occupiedTotalMonthly = items.reduce((sum, it) => sum + it.occupiedAmount, 0);

  const emptyDailyCost = Math.round(emptyTotalMonthly / daysInMonth);
  const occupiedDailyCost = Math.round(occupiedTotalMonthly / daysInMonth);

  const dailySavings = Math.max(0, occupiedDailyCost - emptyDailyCost);
  const monthlySavings = Math.max(0, occupiedTotalMonthly - emptyTotalMonthly);

  return {
    monthStr,
    daysInMonth,
    emptyTotalMonthly,
    emptyDailyCost,
    occupiedTotalMonthly,
    occupiedDailyCost,
    dailySavings,
    monthlySavings,
    items,
    annualInsuranceTotal,
    monthlyAmortizedInsurance,
    hasActiveInsurance,
    registeredCount,
  };
}
