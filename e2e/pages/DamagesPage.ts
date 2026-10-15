import { Page, Locator, expect } from '@playwright/test';

export class DamagesPage {
  readonly page: Page;
  readonly reportDamageButton: Locator;

  // Modal locators
  readonly titleInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.reportDamageButton = page.getByRole('button', { name: /reportar daño encontrado/i });

    // Modal
    this.titleInput = page.getByPlaceholder(/ej\. control de tv quebrado/i);
    this.descriptionInput = page.locator('textarea[rows="3"]').or(page.locator('form textarea').first());
    this.submitButton = page.getByRole('button', { name: /registrar daño/i });
  }

  async expectLoaded() {
    await expect(this.reportDamageButton).toBeVisible({ timeout: 15_000 });
  }

  async reportDamage(params: { title: string; description?: string }) {
    await this.reportDamageButton.click();
    await expect(this.titleInput).toBeVisible({ timeout: 5000 });

    await this.titleInput.fill(params.title);
    if (params.description && (await this.descriptionInput.isVisible())) {
      await this.descriptionInput.fill(params.description);
    }
    await this.submitButton.click();

    // Modal closes
    await expect(this.titleInput).not.toBeVisible({ timeout: 10_000 });
  }

  async expectDamageInList(title: string) {
    await expect(this.page.getByText(title).first()).toBeVisible({ timeout: 10_000 });
  }
}
