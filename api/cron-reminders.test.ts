import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCronReminders,
  buildReminderEmailHtml,
} from './cron-reminders';

interface ReminderReport {
  dueDay: number;
  isDueToday: boolean;
  recipients: string[];
}

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

describe('api/cron-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.RESEND_API_KEY;
  });

  describe('buildReminderEmailHtml', () => {
    it('produces clean HTML with property, service and direct link', () => {
      const html = buildReminderEmailHtml({
        propertyName: 'Apto Poblado 402',
        serviceLabel: 'Energía / Luz (EPM)',
        provider: 'EPM',
        typicalDueDay: 25,
        currentMonthStr: '2026-11',
        status: 'awaiting_invoice',
        appUrl: 'https://aptos.pesonsita.com',
        propertyId: 'prop-123',
      });

      expect(html).toContain('Apto Poblado 402');
      expect(html).toContain('Energía / Luz (EPM)');
      expect(html).toContain('día 25');
      expect(html).toContain('https://aptos.pesonsita.com/p/prop-123/expenses?month=2026-11');
      expect(html).toContain('Dueño Principal y Dueño');
    });
  });

  describe('handleCronReminders', () => {
    it('rejects unauthorized requests if CRON_SECRET is set', async () => {
      process.env.CRON_SECRET = 'super-secret-123';

      const req = new Request('http://localhost:3000/api/cron-reminders', {
        headers: { authorization: 'Bearer wrong-secret' },
      });

      const response = await handleCronReminders(req);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.error).toBe('No autorizado');
    });

    it('processes reminders in dry-run mode and filters strictly to PRIMARY_OWNER and OWNER', async () => {
      // Mock system date to day 10
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-10T08:00:00Z'));

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'properties') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'prop-1',
                  name: 'Penthouse Poblado',
                  primary_owner_id: 'user-owner-1',
                  created_by: 'user-owner-1',
                  is_active: true,
                },
              ],
              error: null,
            }),
          };
        }
        if (table === 'property_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { user_id: 'user-owner-1', role: 'PRIMARY_OWNER' },
                { user_id: 'user-owner-2', role: 'OWNER' },
              ],
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 'user-owner-1', email: 'carlos@owner.com', full_name: 'Carlos Owner' },
                { id: 'user-owner-2', email: 'laura@owner.com', full_name: 'Laura Co-Owner' },
              ],
            }),
          };
        }
        if (table === 'expenses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            // No expenses paid yet for this month
            data: [],
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      });

      const req = new Request('http://localhost:3000/api/cron-reminders?dry_run=true');
      const response = await handleCronReminders(req);

      expect(response.status).toBe(200);
      const json = await response.json();

      expect(json.success).toBe(true);
      expect(json.dryRun).toBe(true);
      expect(json.dayOfMonth).toBe(10);

      // Day 10 is Agua due date!
      const waterReport = (json.reports as ReminderReport[]).find((r) => r.dueDay === 10);
      expect(waterReport).toBeDefined();
      expect(waterReport.isDueToday).toBe(true);
      expect(waterReport.recipients).toEqual(['carlos@owner.com', 'laura@owner.com']);

      vi.useRealTimers();
    });
  });
});
