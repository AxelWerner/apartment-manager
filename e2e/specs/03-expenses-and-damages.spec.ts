import { test } from '@playwright/test';
import { setupUserAndProperty } from '../helpers/session';
import { DashboardPage } from '../pages/DashboardPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { DamagesPage } from '../pages/DamagesPage';

test.describe('03: Expenses and Damages Operational Flows', () => {
  test('should register a new operational expense and list it in the ledger', async ({ page }) => {
    await setupUserAndProperty(page);

    const dashboardPage = new DashboardPage(page);
    const expensesPage = new ExpensesPage(page);

    // 1. Navegar a Gastos
    await dashboardPage.goToExpenses();
    await expensesPage.expectLoaded();

    // 2. Registrar nuevo gasto
    await expensesPage.createExpense({
      description: 'Factura EPM Energía El Poblado',
      amount: '185000',
    });

    // 3. Verificar en el libro de gastos
    await expensesPage.expectExpenseInList('Factura EPM Energía El Poblado');
  });

  test('should report a new damage incident and display it in the damages hub', async ({ page }) => {
    await setupUserAndProperty(page);

    const dashboardPage = new DashboardPage(page);
    const damagesPage = new DamagesPage(page);

    // 1. Navegar a Daños
    await dashboardPage.goToDamages();
    await damagesPage.expectLoaded();

    // 2. Reportar daño
    await damagesPage.reportDamage({
      title: 'Control Remoto TV Sala Dañado',
      description: 'Carcasa plástica rota, no enciende el televisor',
    });

    // 3. Verificar que aparece en la lista de incidentes
    await damagesPage.expectDamageInList('Control Remoto TV Sala Dañado');
  });
});
