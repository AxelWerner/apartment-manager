import { Page, Locator, expect } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;

  // Dedicated /onboarding route
  readonly onboardingHeading: Locator;
  readonly onboardingNameInput: Locator;
  readonly onboardingCityInput: Locator;
  readonly onboardingAddressInput: Locator;
  readonly onboardingSubmitButton: Locator;

  // Empty state in dashboard (/ or /dashboard with 0 properties)
  readonly emptyAddPropertyButton: Locator;
  readonly modalNameInput: Locator;
  readonly modalCityInput: Locator;
  readonly modalAddressInput: Locator;
  readonly modalSubmitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Route /onboarding
    this.onboardingHeading = page.getByRole('heading', { name: /¡bienvenido a aptos!/i });
    this.onboardingNameInput = page.getByPlaceholder(/ej\. apto 502/i);
    this.onboardingCityInput = page.getByPlaceholder(/medellín/i);
    this.onboardingAddressInput = page.getByPlaceholder(/ej\. calle 10/i);
    this.onboardingSubmitButton = page.getByRole('button', { name: /empezar con este apartamento/i });

    // Empty state view
    this.emptyAddPropertyButton = page
      .getByRole('button', { name: 'Añadir mi primer Apartamento' });
    this.modalNameInput = page.getByPlaceholder(/ej\. apto 502 - edificio manila/i);
    this.modalCityInput = page.locator('input[placeholder="Medellín"]');
    this.modalAddressInput = page.getByPlaceholder(/ej\. calle 10 # 43d - 25/i);
    this.modalSubmitButton = page.getByRole('button', { name: /crear apartamento/i });
  }

  async createProperty(params: { name: string; city?: string; address?: string }) {
    // 1. Check if we are on the /onboarding route
    const isOnboardingRoute = await this.onboardingHeading.isVisible({ timeout: 4000 }).catch(() => false);

    if (isOnboardingRoute) {
      await this.onboardingNameInput.fill(params.name);
      if (params.city) await this.onboardingCityInput.fill(params.city);
      if (params.address) await this.onboardingAddressInput.fill(params.address);
      await this.onboardingSubmitButton.click();
    } else {
      // 2. We are in the empty state view
      await expect(this.emptyAddPropertyButton).toBeVisible({ timeout: 10_000 });
      await this.emptyAddPropertyButton.click();

      // Modal appears
      await expect(this.modalNameInput).toBeVisible({ timeout: 5000 });
      await this.modalNameInput.fill(params.name);
      if (params.city) await this.modalCityInput.fill(params.city);
      if (params.address) await this.modalAddressInput.fill(params.address);
      await this.modalSubmitButton.click();
    }

    // After creating property, we wait to be in /p/:id/dashboard
    await this.page.waitForURL(/\/p\/[^/]+\/dashboard/, { timeout: 15_000 });
  }
}
