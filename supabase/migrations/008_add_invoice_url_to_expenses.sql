-- Migration: 008_add_invoice_url_to_expenses.sql
-- Description: Add invoice_url to expenses table to allow attaching both invoices and payment receipts

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS invoice_url TEXT;

COMMENT ON COLUMN expenses.invoice_url IS 'URL of provider invoice, utility bill or charge account document';
COMMENT ON COLUMN expenses.receipt_url IS 'URL of payment receipt, bank transfer slip or transaction proof';
