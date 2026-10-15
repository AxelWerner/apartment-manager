import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupUserAndProperty } from '../helpers/session';
import { DashboardPage } from '../pages/DashboardPage';
import { BookingsPage } from '../pages/BookingsPage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('02: Bookings Flow (Manual + CSV Import)', () => {
  test('should create a manual booking and display it in the list', async ({ page }) => {
    await setupUserAndProperty(page);

    const dashboardPage = new DashboardPage(page);
    const bookingsPage = new BookingsPage(page);

    // 1. Navegar a sección Reservas
    await dashboardPage.goToBookings();
    await bookingsPage.expectLoaded();

    // 2. Crear una reserva manual
    await bookingsPage.createBooking({
      guestName: 'Carlos Valderrama',
      confirmationCode: 'HMCARLOS10',
      checkIn: '2026-11-10',
      checkOut: '2026-11-15',
    });

    // 3. Verificar que la reserva recién creada está visible en la lista
    await bookingsPage.expectBookingInList('Carlos Valderrama');
  });

  test('should import Airbnb CSV and display imported reservations', async ({ page }) => {
    await setupUserAndProperty(page);

    const dashboardPage = new DashboardPage(page);
    const bookingsPage = new BookingsPage(page);

    // 1. Navegar a sección Reservas
    await dashboardPage.goToBookings();
    await bookingsPage.expectLoaded();

    // 2. Subir y confirmar importación de CSV de Airbnb
    const csvPath = path.resolve(__dirname, '../fixtures/airbnb-sample.csv');
    await bookingsPage.uploadAndConfirmCsv(csvPath);

    // 3. Validar que las reservas del archivo ahora aparecen en la tabla
    await bookingsPage.expectBookingInList('Laura Estefanía Gomez');
    await bookingsPage.expectBookingInList('Liliana Nieto');
  });
});
