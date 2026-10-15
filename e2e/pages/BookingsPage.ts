import { Page, Locator, expect } from '@playwright/test';

export class BookingsPage {
  readonly page: Page;
  readonly newBookingButton: Locator;
  readonly importCsvButton: Locator;
  readonly searchInput: Locator;
  readonly bookingsTable: Locator;

  // Booking Modal Locators
  readonly guestNameInput: Locator;
  readonly confirmationCodeInput: Locator;
  readonly checkInInput: Locator;
  readonly checkOutInput: Locator;
  readonly numberOfGuestsInput: Locator;
  readonly submitBookingButton: Locator;

  // CSV Import Modal Locators
  readonly csvFileInput: Locator;
  readonly confirmImportButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newBookingButton = page.getByRole('button', { name: /nueva reserva/i });
    this.importCsvButton = page.getByRole('button', { name: /importar csv/i });
    this.searchInput = page.getByPlaceholder(/buscar por huésped/i);
    this.bookingsTable = page.locator('table');

    // Modal
    this.guestNameInput = page.getByPlaceholder(/ej\. juan pérez/i);
    this.confirmationCodeInput = page.getByPlaceholder(/ej\. hm9x7y2z/i);
    this.checkInInput = page.locator('#modal-check-in');
    this.checkOutInput = page.locator('#modal-check-out');
    this.numberOfGuestsInput = page.locator('input[type="number"][min="1"]');
    this.submitBookingButton = page.getByRole('button', { name: /registrar reserva/i });

    // CSV Modal
    this.csvFileInput = page.locator('#csv-file-input');
    this.confirmImportButton = page.getByRole('button', { name: /confirmar e importar/i });
  }

  async expectLoaded() {
    await expect(this.newBookingButton).toBeVisible({ timeout: 15_000 });
  }

  async openNewBookingModal() {
    await this.newBookingButton.click();
    await expect(this.guestNameInput).toBeVisible({ timeout: 5_000 });
  }

  async createBooking(params: {
    guestName: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
  }) {
    await this.openNewBookingModal();
    await this.guestNameInput.fill(params.guestName);
    await this.confirmationCodeInput.fill(params.confirmationCode);
    await this.checkInInput.fill(params.checkIn);
    await this.checkOutInput.fill(params.checkOut);

    // Verify nights are calculated in modal
    await expect(this.page.locator('form').getByText(/\d+ noches?/i).first()).toBeVisible();

    await this.submitBookingButton.click();
    // Modal closes
    await expect(this.guestNameInput).not.toBeVisible({ timeout: 10_000 });
  }

  async openCsvImportModal() {
    await this.importCsvButton.click();
    await expect(this.page.getByText(/haz clic para subir o arrastra/i)).toBeVisible({ timeout: 5_000 });
  }

  async uploadAndConfirmCsv(absoluteFilePath: string) {
    await this.openCsvImportModal();
    await this.csvFileInput.setInputFiles(absoluteFilePath);

    // Wait for the preview table and confirm button
    await expect(this.confirmImportButton).toBeVisible({ timeout: 10_000 });
    await this.confirmImportButton.click();

    // Modal closes
    await expect(this.confirmImportButton).not.toBeVisible({ timeout: 15_000 });
  }

  async expectBookingInList(guestName: string) {
    await expect(this.page.getByText(guestName, { exact: false })).toBeVisible({ timeout: 10_000 });
  }
}
