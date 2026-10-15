import { test, expect } from '@playwright/test';

test.describe('04: Public Routes and Unauthenticated Access', () => {
  test('should redirect unauthenticated users from protected dashboard to login', async ({ page }) => {
    // 1. Intentar acceder a una ruta protegida sin sesión
    await page.goto('/dashboard');

    // 2. Comprobar que redirige a /login
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('should allow public access to guest guide and portal without login', async ({ page }) => {
    // 1. Acceder a la guía del huésped pública
    await page.goto('/guide');

    // 2. Verificar que la pantalla de bienvenida al huésped carga sin pedir login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/guía/i).or(page.getByText(/huésped/i)).or(page.getByText(/bienvenido/i)).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should allow public access to wifi card page without login', async ({ page }) => {
    // 1. Acceder a la tarjeta Wi-Fi pública
    await page.goto('/wifi');

    // 2. Verificar que carga y no redirige a login
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(/wi-fi/i).or(page.getByText(/tarjeta wifi/i)).first()).toBeVisible({ timeout: 10_000 });
  });
});
