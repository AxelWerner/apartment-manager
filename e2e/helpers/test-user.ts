export interface TestUser {
  email: string;
  password: string;
  fullName: string;
}

export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 1000);
  return {
    email: `host-${timestamp}-${randomSuffix}@e2e-test.com`,
    password: 'TestPassword123!',
    fullName: `Host Test ${randomSuffix}`,
  };
}
