import { useMemo } from 'react';
import { usePropertyContext } from '@/context/PropertyContext';
import { useExpenses, useRecurringTemplates } from '@/hooks/use-expenses';
import type { ExpenseCategory, Expense } from '@/types/database';

export interface ServiceReminder {
  id: string;
  category: ExpenseCategory;
  label: string;
  provider: string;
  typicalDueDay: number;
  status: 'awaiting_invoice' | 'pending';
  urgency: 'overdue' | 'due_today' | 'upcoming';
  daysDifference: number; // 0 = today, negative = days overdue, positive = days ahead
  amount: number;
  isEstimate: boolean;
  dueDateStr: string;
  propertyId: string;
  propertyName: string;
  expenseId?: string;
}

export interface ServiceDefinition {
  category: ExpenseCategory;
  label: string;
  provider: string;
  typicalDueDay: number;
  defaultAmount: number;
}

export const OFFICIAL_SERVICE_SCHEDULE: ServiceDefinition[] = [
  {
    category: 'hoa_administration',
    label: 'Administración',
    provider: 'Edificio / Portería',
    typicalDueDay: 5,
    defaultAmount: 380000,
  },
  {
    category: 'water',
    label: 'Agua / Acueducto (EPM)',
    provider: 'EPM',
    typicalDueDay: 10,
    defaultAmount: 110000,
  },
  {
    category: 'internet_cable',
    label: 'Internet y TV / Teléfono',
    provider: 'Tigo / Claro Fibra',
    typicalDueDay: 15,
    defaultAmount: 125000,
  },
  {
    category: 'gas',
    label: 'Gas Natural (EPM)',
    provider: 'EPM',
    typicalDueDay: 24,
    defaultAmount: 35000,
  },
  {
    category: 'electricity',
    label: 'Energía / Luz (EPM)',
    provider: 'EPM',
    typicalDueDay: 25,
    defaultAmount: 290000,
  },
];

/**
 * Hook to calculate actionable service payment reminders for the active property.
 * Strictly restricted to users with role PRIMARY_OWNER or OWNER.
 */
export function useServiceReminders() {
  const propertyCtx = usePropertyContext();
  const activePropertyId = propertyCtx?.activePropertyId;
  const activeProperty = propertyCtx?.activeProperty;
  const role = propertyCtx?.role;
  const isOwner = propertyCtx?.isOwner ?? false;
  const { data: expenses = [] } = useExpenses(activePropertyId || undefined);
  const { data: templates = [] } = useRecurringTemplates(activePropertyId || undefined);

  // Security gate: ONLY PRIMARY_OWNER and OWNER can receive service payment reminders
  const canReceiveServiceAlerts = Boolean(
    isOwner || role === 'PRIMARY_OWNER' || role === 'OWNER'
  );

  const reminders = useMemo<ServiceReminder[]>(() => {
    if (!canReceiveServiceAlerts || !activePropertyId || !activeProperty) {
      return [];
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = now.getMonth() + 1;
    const currentMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;
    const todayDay = now.getDate();

    // Map existing expenses for current month by category
    const currentMonthExpenses = expenses.filter((e) => {
      const expMonth = e.billing_month || (e.date ? e.date.substring(0, 7) : '');
      return expMonth === currentMonthStr;
    });

    const expenseByCategory = new Map<ExpenseCategory, Expense>();
    for (const exp of currentMonthExpenses) {
      // If there are multiple, prioritize paid or latest
      const existing = expenseByCategory.get(exp.category);
      if (!existing || exp.payment_status === 'paid') {
        expenseByCategory.set(exp.category, exp);
      }
    }

    const templateByCategory = new Map(templates.map((t) => [t.category, t]));

    const list: ServiceReminder[] = [];

    for (const service of OFFICIAL_SERVICE_SCHEDULE) {
      const existingExpense = expenseByCategory.get(service.category);

      // If already marked as paid, no reminder needed
      if (existingExpense?.payment_status === 'paid') {
        continue;
      }

      const template = templateByCategory.get(service.category);
      const typicalDueDay = template?.typical_due_day ?? service.typicalDueDay;
      const daysDifference = typicalDueDay - todayDay;

      // Reminder trigger window: starts 2 days before typical due date and stays active if unpaid
      const isWithinReminderWindow = todayDay >= typicalDueDay - 2;

      if (!isWithinReminderWindow) {
        continue;
      }

      let urgency: 'overdue' | 'due_today' | 'upcoming';
      if (daysDifference < 0) {
        urgency = 'overdue';
      } else if (daysDifference === 0) {
        urgency = 'due_today';
      } else {
        urgency = 'upcoming';
      }

      const isPending = existingExpense?.payment_status === 'pending';
      const status: 'awaiting_invoice' | 'pending' = isPending ? 'pending' : 'awaiting_invoice';

      const amount = existingExpense
        ? Number(existingExpense.amount)
        : Number(template?.default_amount ?? service.defaultAmount);

      const dueDateStr = `${currentMonthStr}-${String(typicalDueDay).padStart(2, '0')}`;

      list.push({
        id: `reminder-${service.category}-${currentMonthStr}`,
        category: service.category,
        label: service.label,
        provider: service.provider,
        typicalDueDay,
        status,
        urgency,
        daysDifference,
        amount,
        isEstimate: !existingExpense,
        dueDateStr,
        propertyId: activePropertyId,
        propertyName: activeProperty.name,
        expenseId: existingExpense?.id,
      });
    }

    // Sort by urgency: overdue first, then due_today, then upcoming
    const urgencyOrder = { overdue: 0, due_today: 1, upcoming: 2 };
    return list.sort((a, b) => {
      const orderDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (orderDiff !== 0) return orderDiff;
      return a.typicalDueDay - b.typicalDueDay;
    });
  }, [
    canReceiveServiceAlerts,
    activePropertyId,
    activeProperty,
    expenses,
    templates,
  ]);

  return {
    reminders,
    count: reminders.length,
    canReceiveServiceAlerts,
  };
}
