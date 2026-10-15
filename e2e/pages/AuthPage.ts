import { Page, Locator, expect } from '@playwright/test';

export class AuthPage {
  readonly page: Page;
  readonly signInTab: Locator;
  readonly signUpTab: Locator;
  readonly fullNameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInTab = page.getByRole('tab', { name: /iniciar sesión/i });
    this.signUpTab = page.getByRole('tab', { name: /crear cuenta/i });
    this.fullNameInput = page.getByLabel(/nombre completo/i);
    this.emailInput = page.getByLabel(/correo electrónico/i);
    this.passwordInput = page.getByLabel(/^contraseña$/i);
    this.confirmPasswordInput = page.getByLabel(/confirmar contraseña/i);
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('.bg-rose-50, [class*="bg-rose-50"]');
    this.successMessage = page.locator('.bg-emerald-50, [class*="bg-emerald-50"]');
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.page).toHaveTitle(/Iniciar Sesión/i);
  }

  async switchToSignUp() {
    await this.signUpTab.click();
    await expect(this.fullNameInput).toBeVisible();
  }

  async switchToSignIn() {
    await this.signInTab.click();
    await expect(this.fullNameInput).not.toBeVisible();
  }

  async signUp(params: { fullName: string; email: string; password: string; confirmPassword?: string }) {
    await this.switchToSignUp();
    await this.fullNameInput.fill(params.fullName);
    await this.emailInput.fill(params.email);
    await this.passwordInput.fill(params.password);
    await this.confirmPasswordInput.fill(params.confirmPassword ?? params.password);
    await this.submitButton.click();
  }

  async signIn(params: { email: string; password: string }) {
    await this.switchToSignIn();
    await this.emailInput.fill(params.email);
    await this.passwordInput.fill(params.password);
    await this.submitButton.click();
  }
}
