import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly occupancyCard: Locator;
  readonly navBookingsLink: Locator;
  readonly navExpensesLink: Locator;
  readonly navDamagesLink: Locator;
  readonly navSettingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.occupancyCard = page.getByText(/tasa de ocupación/i);
    this.navBookingsLink = page.getByRole('link', { name: /reservas/i });
    this.navExpensesLink = page.getByRole('link', { name: /gastos/i });
    this.navDamagesLink = page.getByRole('link', { name: /daños/i });
    this.navSettingsLink = page.getByRole('link', { name: /configuración/i });
  }

  async expectLoaded() {
    await expect(this.occupancyCard).toBeVisible({ timeout: 15_000 });
  }

  async goToBookings() {
    await this.navBookingsLink.click();
    await this.page.waitForURL(/\/bookings/, { timeout: 10_000 });
  }

  async goToExpenses() {
    await this.navExpensesLink.click();
    await this.page.waitForURL(/\/expenses/, { timeout: 10_000 });
  }

  async goToDamages() {
    await this.navDamagesLink.click();
    await this.page.waitForURL(/\/damages/, { timeout: 10_000 });
  }
}
