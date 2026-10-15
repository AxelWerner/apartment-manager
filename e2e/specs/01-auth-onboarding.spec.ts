import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { DashboardPage } from '../pages/DashboardPage';
import { generateTestUser } from '../helpers/test-user';

test.describe('01: Auth & Onboarding Flow (Zero-Seed Journey)', () => {
  test('should validate invalid login credentials', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();

    await authPage.signIn({
      email: 'non-existent-user@invalid.com',
      password: 'WrongPassword123!',
    });

    // Expect error message container to be visible
    await expect(authPage.errorMessage).toBeVisible({ timeout: 10_000 });
  });

  test('should complete full signup and onboarding wizard to dashboard', async ({ page }) => {
    const authPage = new AuthPage(page);
    const onboardingPage = new OnboardingPage(page);
    const dashboardPage = new DashboardPage(page);

    const testUser = generateTestUser();

    // 1. Ir a login
    await authPage.goto();

    // 2. Registrar nuevo usuario
    await authPage.signUp({
      fullName: testUser.fullName,
      email: testUser.email,
      password: testUser.password,
    });

    // 3. Si requiere confirmación por email (comportamiento de Supabase Cloud sin confirmación desactivada)
    // o si inicia sesión directo (Supabase local con auto-confirm)
    const currentUrl = page.url();
    if (currentUrl.includes('/onboarding') || (await page.getByRole('heading', { name: /¡bienvenido a aptos!/i }).isVisible({ timeout: 5000 }).catch(() => false))) {
      // 4. Crear primer apartamento en Onboarding
      await onboardingPage.createProperty({
        name: 'Apto E2E Poblado 502',
        city: 'Medellín',
        address: 'Calle 10 # 43D - 25',
      });

      // 5. Verificar llegada al Dashboard y estado inicial
      await dashboardPage.expectLoaded();
      await expect(page).toHaveURL(/\/p\/[^/]+\/dashboard/);
    } else {
      // Si la instancia de Supabase requiere confirmación de email por defecto
      // Validamos que se muestre la pantalla de verificación pendiente
      await expect(page.getByText(/revisa tu correo/i).or(page.getByText(/enlace de confirmación/i))).toBeVisible();
    }
  });
});
