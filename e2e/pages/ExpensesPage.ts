import { Page, Locator, expect } from '@playwright/test';

export class ExpensesPage {
  readonly page: Page;
  readonly newExpenseButton: Locator;
  readonly ledgerTabButton: Locator;
  readonly checklistTabButton: Locator;

  // Expense modal locators
  readonly descriptionInput: Locator;
  readonly amountInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newExpenseButton = page.getByRole('button', { name: /nuevo gasto/i });
    this.ledgerTabButton = page.getByRole('button', { name: /libro completo de gastos/i });
    this.checklistTabButton = page.getByRole('button', { name: /planilla mensual de servicios/i });

    // Modal
    this.descriptionInput = page.locator('#expense-description-input');
    this.amountInput = page.locator('input[placeholder="0"]').last();
    this.submitButton = page.getByRole('button', { name: 'Registrar Gasto', exact: true });
  }

  async expectLoaded() {
    await expect(this.newExpenseButton).toBeVisible({ timeout: 15_000 });
  }

  async createExpense(params: { description: string; amount: string }) {
    await this.newExpenseButton.click();
    await expect(this.descriptionInput).toBeVisible({ timeout: 5000 });

    await this.descriptionInput.fill(params.description);
    await this.amountInput.fill(params.amount);
    await this.submitButton.click();

    // Modal closes
    await expect(this.descriptionInput).not.toBeVisible({ timeout: 10_000 });
  }

  async switchToLedger() {
    await this.ledgerTabButton.click();
  }

  async expectExpenseInList(description: string) {
    await this.switchToLedger();
    await expect(this.page.getByText(description).first()).toBeVisible({ timeout: 10_000 });
  }
}
