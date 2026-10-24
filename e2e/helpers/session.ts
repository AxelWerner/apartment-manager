import { Page, expect } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { OnboardingPage } from '../pages/OnboardingPage';
import { generateTestUser } from './test-user';
import { createConfirmedTestUser } from './supabase-admin';

export async function setupUserAndProperty(page: Page, propertyName = `Apto E2E ${Date.now()}`) {
  const authPage = new AuthPage(page);
  const onboardingPage = new OnboardingPage(page);
  const testUser = generateTestUser();

  // 1. Create a confirmed user in Supabase
  await createConfirmedTestUser(testUser);

  // 2. Log in through UI
  await authPage.goto();
  await authPage.signIn({
    email: testUser.email,
    password: testUser.password,
  });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

  // 3. User with no property gets created via Onboarding or EmptyPropertyView modal
  await onboardingPage.createProperty({
    name: propertyName,
    city: 'Medellín',
    address: 'Carrera 43A # 1-50',
  });

  return { testUser, propertyName };
}
