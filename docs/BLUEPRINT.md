# 📐 Master Blueprint: Airbnb Apartment Manager

> **Status:** Approved Architecture Draft  
> **Currency:** Colombian Peso (`COP` / `$`)  
> **Platform:** Responsive Web Application (Desktop & Mobile optimized)  
> **Target Audience:** Short-Term Rental Host / Apartment Owner  

---

## 1. Executive Summary & Goals

The **Apartment Manager** is an operational and financial management platform purpose-built for an Airbnb apartment in Colombia. The application tracks:
1. **Income & Reservations:** Manual booking creation and Airbnb CSV import with detailed commission breakdowns.
2. **Operational, Fixed & Utility Expenses:**
   - **Monthly Fixed Bills:** Administración del edificio (HOA) and Internet/Wi-Fi.
   - **Monthly Utilities (Variable):** Luz (Electricity), Gas, and Agua (Water) with due dates and payment verification.
   - **Annual Policies:** Seguro del Apto (Property & contents insurance) with renewal tracking and amortized monthly view.
   - **Occasional Restocking:** Insumos / supplies runs (sheets, toiletries, coffee, amenities).
   - **Per-Stay Operations:** Turnover cleaning and laundry.
3. **Damages & Incident Management:** Inspection logs, photo evidence, estimated vs. actual repair expenses, and Airbnb AirCover / guest reimbursement claim workflows.
4. **Financial Intelligence & Analytics:** Comprehensive COP-based dashboard showing Occupancy, ADR, RevPAR, Net Cash Flow, and Category Breakdowns.

While optimized for a single apartment initially, the database and code architecture strictly scope records to a `property_id` to allow seamless multi-apartment scaling in the future.

---

## 2. Technology Stack & Frameworks

| Layer | Selected Technology | Purpose & Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | **React 19 + Vite + TypeScript** | Ultrafast DX, clean SPA bundle, end-to-end type safety. |
| **Styling & Components** | **Tailwind CSS + shadcn/ui (Radix UI primitives)** | Modern, accessible, clean design system with responsive layouts for mobile and desktop. |
| **Icons** | **lucide-react** | Consistent, modern iconography. |
| **Backend & Database** | **Supabase (PostgreSQL 15+)** | Managed relational DB, Row Level Security (RLS), auto-generated REST client, and object storage. |
| **Object Storage** | **Supabase Storage** | Dedicated storage bucket (`apartment-media`) for receipts and damage photos with responsive camera/file uploads. |
| **Data Fetching & Cache** | **TanStack Query v5** | Declarative queries, automated cache revalidation, optimistic mutations. |
| **Form Handling & Validation**| **React Hook Form + Zod** | Form validation matching database constraints and dynamic file uploads. |
| **Charts & Visualization** | **Recharts** | Interactive SVG-based charts (Income vs Expense bar charts, Expense distribution donut, Occupancy trends). |
| **Data Parsing (CSV)** | **PapaParse** | Client-side parsing and mapping of Airbnb CSV reservation exports. |
| **Date Manipulation** | **date-fns** | Accurate night count calculations, calendar filtering, and Colombian Spanish date formatting. |
| **Currency Formatting** | **Intl.NumberFormat (`es-CO`, COP)** | Standardized Colombian Peso display without decimal cents (e.g., `$ 450.000 COP`). |

---

## 3. Database Schema Specification (Supabase / PostgreSQL)

### 3.1. Enums & Custom Types
```sql
-- Booking status
CREATE TYPE booking_status AS ENUM ('confirmed', 'checked_in', 'completed', 'cancelled');
CREATE TYPE payout_status AS ENUM ('pending', 'paid');

-- Expense categories tailored to apartment operations
CREATE TYPE expense_category AS ENUM (
  'hoa_administration',   -- Cuota mensual de Administración del edificio (Fixed Monthly)
  'electricity',          -- Servicio de Luz / Energía (Monthly Utility)
  'water',                -- Servicio de Agua / Acueducto (Monthly Utility)
  'gas',                  -- Servicio de Gas (Monthly Utility)
  'internet_cable',       -- Internet Wi-Fi y televisión (Fixed Monthly)
  'insurance_annual',     -- Póliza de Seguro del Apto (Annual / Yearly)
  'cleaning_laundry',     -- Limpieza por estadía y lavandería de sábanas/toallas (Per Stay / Variable)
  'supplies_restock',     -- Insumos de vez en cuando (Café, papel higiénico, jabón, toallas nuevas, etc.)
  'maintenance_repairs',  -- Mantenimiento, plomería, cerrajería, pintura, arreglos
  'platform_fees',        -- Comisiones bancarias, software de cerradura digital, etc.
  'other'                 -- Otros gastos imprevistos
);

CREATE TYPE expense_type AS ENUM (
  'fixed_monthly',        -- Fixed regular amount every month (e.g., Administración, Internet)
  'utility_monthly',      -- Billed every month with variable amount (e.g., Luz, Agua, Gas)
  'annual',               -- Paid once a year (e.g., Seguro del apartamento)
  'per_stay',             -- Triggered by guest turnover (e.g., Cleaning)
  'occasional'            -- Irregular/as-needed purchases (e.g., Insumos, Mantenimiento)
);

CREATE TYPE recurrence_period AS ENUM ('monthly', 'bimonthly', 'quarterly', 'yearly');
CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'scheduled');

-- Damage & Incident statuses
CREATE TYPE damage_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE claim_status AS ENUM (
  'discovered',               -- Found during checkout inspection
  'guest_contacted',          -- Direct message sent to guest requesting payment
  'aircover_claim_submitted', -- Formal claim filed in Airbnb Resolution Center
  'approved',                 -- Airbnb/Guest agreed to reimbursement
  'reimbursed',               -- Money paid out into host account
  'written_off'               -- Unrecoverable loss absorbed by host
);
```

---

### 3.2. Relational Tables DDL

#### Table 1: `properties`
*Foundational entity allowing clean single-apartment usage today and multi-apartment expansion tomorrow.*
```sql
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                         -- e.g., "Apto 502 - Poblado"
  address TEXT,
  city TEXT DEFAULT 'Medellín',
  currency VARCHAR(3) DEFAULT 'COP',
  default_nightly_rate NUMERIC(12, 0) DEFAULT 0,
  default_cleaning_fee NUMERIC(12, 0) DEFAULT 0,
  check_in_time TIME DEFAULT '15:00',
  check_out_time TIME DEFAULT '11:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table 2: `bookings`
*Detailed breakdown of Airbnb reservations and income in COP.*
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  airbnb_confirmation_code TEXT UNIQUE,       -- e.g., "HM9XYZ1234" (prevents duplicate CSV imports)
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  number_of_guests INT DEFAULT 1,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  number_of_nights INT NOT NULL,              -- Computed or validated (check_out - check_in)
  
  -- Financial Breakdown in COP (No cents needed)
  nightly_rate NUMERIC(12, 0) NOT NULL,       -- Average nightly rate
  gross_amount NUMERIC(12, 0) NOT NULL,       -- Accommodation total paid by guest
  cleaning_fee_collected NUMERIC(12, 0) DEFAULT 0, -- Cleaning fee charged to guest
  airbnb_service_fee NUMERIC(12, 0) DEFAULT 0,     -- Host service fee deducted by Airbnb (approx 3%)
  taxes_withheld NUMERIC(12, 0) DEFAULT 0,         -- Withholding tax if applicable
  net_payout NUMERIC(12, 0) NOT NULL,         -- Real cash received in Colombian bank / Payoneer
  
  status booking_status DEFAULT 'confirmed',
  payout_status payout_status DEFAULT 'pending',
  payout_date DATE,
  source TEXT DEFAULT 'airbnb',               -- 'airbnb', 'direct', etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bookings_dates ON bookings(property_id, check_in, check_out);
CREATE INDEX idx_bookings_confirmation ON bookings(airbnb_confirmation_code);
```

#### Table 3: `expenses`
*Outflows, recurring bills, utilities, occasional supplies, and stay-linked cleaning/repairs.*
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  expense_type expense_type NOT NULL DEFAULT 'occasional',
  description TEXT NOT NULL,                   -- e.g., "Administración Septiembre 2026", "Factura Luz EPM"
  amount NUMERIC(12, 0) NOT NULL,              -- Amount in COP
  date DATE NOT NULL,                          -- Date incurred / invoice date
  due_date DATE,                               -- Payment deadline / Fecha de vencimiento
  billing_month VARCHAR(7),                    -- e.g. "2026-09" (links expense to specific monthly cycle)
  payment_status payment_status DEFAULT 'paid',
  
  -- Recurrence details
  is_recurring BOOLEAN DEFAULT false,
  recurrence_period recurrence_period,
  
  -- Optional Relationships
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- e.g., specific turnover cleaning
  receipt_url TEXT,                            -- Path in Supabase Storage
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(property_id, date);
CREATE INDEX idx_expenses_category ON expenses(property_id, category);
CREATE INDEX idx_expenses_billing_month ON expenses(property_id, billing_month);
```

#### Table 3b: `recurring_bill_templates`
*Pre-configured templates for regular apartment expenses (Administración, Internet, Seguro, Utilities checklist).*
```sql
CREATE TABLE recurring_bill_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category expense_category NOT NULL,
  expense_type expense_type NOT NULL,          -- 'fixed_monthly', 'utility_monthly', 'annual'
  name TEXT NOT NULL,                          -- e.g., "Administración Edificio", "Factura EPM Luz", "Seguro Todo Riesgo"
  default_amount NUMERIC(12, 0) DEFAULT 0,     -- Known fixed amount (or 0 for variable utilities like Luz/Gas/Agua)
  typical_due_day INT,                         -- Day of the month it's typically due (e.g. 15 for the 15th)
  annual_due_month INT,                        -- Month of the year for annual insurance (1-12)
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### Table 4: `damages`
*Damage inspection logs, evidence photos, costs, and claim recovery.*
```sql
CREATE TABLE damages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- Booking responsible (if known)
  title TEXT NOT NULL,                        -- e.g., "Broken Smart TV Screen in Master Bedroom"
  description TEXT NOT NULL,                  -- Narrative of discovery and context
  date_discovered DATE NOT NULL DEFAULT CURRENT_DATE,
  severity damage_severity DEFAULT 'medium',
  
  -- Financials in COP
  estimated_repair_cost NUMERIC(12, 0) NOT NULL DEFAULT 0,
  actual_repair_cost NUMERIC(12, 0) DEFAULT 0,
  reimbursement_amount NUMERIC(12, 0) DEFAULT 0, -- Amount recovered from Guest or AirCover
  
  -- Claim Workflow
  claim_status claim_status DEFAULT 'discovered',
  aircover_case_number TEXT,                 -- Airbnb Resolution Center Case ID
  resolution_notes TEXT,
  
  -- Media
  photo_urls TEXT[] DEFAULT '{}',            -- Array of Supabase storage image URLs
  
  -- Linked expense if a repair payment was made
  linked_expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_damages_booking ON damages(linked_booking_id);
CREATE INDEX idx_damages_status ON damages(property_id, claim_status);
```

---

## 4. Storage Architecture (Supabase Storage)

- **Bucket Name:** `apartment-media`
- **Folder Structure:**
  - `receipts/{YYYY-MM}/{expense_id}-{filename}`
  - `damages/{damage_id}/{timestamp}-{filename}`
- **Permissions:** Public read access for authenticated app queries; write restricted to authenticated user.
- **Upload UX:** Supports native mobile camera capture (`capture="environment"`), image compression before upload (max 1920px width to save bandwidth), and desktop drag-and-drop.

---

## 5. Business Logic & Mathematical Formulas

### 5.1. Net Operating Income & Cash Flow
$$\text{Total Net Income} = \sum_{\text{period}} \text{net\_payout (from bookings)}$$
$$\text{Total Operational Expenses} = \sum_{\text{period}} \text{amount (from expenses)}$$
$$\text{Net Cash Flow (Profit)} = \text{Total Net Income} - \text{Total Operational Expenses}$$
$$\text{Profit Margin (\%)} = \left( \frac{\text{Net Cash Flow}}{\text{Total Gross Revenue}} \right) \times 100$$

### 5.2. Hospitality & Performance KPIs
1. **Occupancy Rate:**
   $$\text{Occupancy Rate (\%)} = \left( \frac{\text{Booked Nights in Selected Period}}{\text{Total Calendar Days in Selected Period}} \right) \times 100$$
2. **Average Daily Rate (ADR in COP):**
   $$\text{ADR} = \frac{\sum \text{Gross Nightly Accommodation Income}}{\sum \text{Booked Nights}}$$
3. **RevPAR (Revenue Per Available Room/Day in COP):**
   $$\text{RevPAR} = \text{ADR} \times \left( \frac{\text{Occupancy Rate}}{100} \right)$$
4. **Damage Loss & Recovery Ratio:**
   $$\text{Unrecovered Damage Cost} = \sum (\text{actual\_repair\_cost} - \text{reimbursement\_amount})$$
   $$\text{Recovery Rate (\%)} = \left( \frac{\sum \text{reimbursement\_amount}}{\sum \text{actual\_repair\_cost}} \right) \times 100$$

---

## 6. Detailed Feature & Screen Breakdown

```
App Navigation
├── 📊 Dashboard              (/)
├── 📅 Bookings & Income      (/bookings)
│   ├── New Booking Modal     (/bookings/new)
│   └── CSV Import Wizard     (/bookings/import)
├── 💸 Expenses & Bills       (/expenses)
│   ├── New Expense Modal     (/expenses/new)
│   └── Recurring Bill Setup  (/expenses/recurring)
├── 🛠️ Damages & Incidents   (/damages)
│   ├── Report Incident Modal (/damages/new)
│   └── Damage Details & Claim(/damages/:id)
└── ⚙️ Property & Settings    (/settings)
```

---

### 6.1. Screen 1: Executive Dashboard (`/`)
* **Time Range Selector:** `This Month` (default), `Last Month`, `Year-to-Date`, or `Custom Range`.
* **Top Metric Cards (KPIs):**
  1. **Net Profit:** Formatted in `$ COP`, with green/red indicator vs. previous period.
  2. **Net Income (Payouts):** Total cash received from stays.
  3. **Total Expenses:** Broken down into fixed vs. variable.
  4. **Occupancy Rate:** Percentage with visual progress bar.
  5. **Average Daily Rate (ADR):** `$ COP` per booked night.
  6. **Active Damages / Open Claims:** Badge with count of unresolved incidents and outstanding balance.
* **Charts Section:**
  1. **Monthly Cash Flow (Bar & Line Chart):** Monthly Income (green bar) vs. Monthly Expenses (red bar) with Net Profit trend line.
  2. **Expense Breakdown (Donut Chart):** Distribution by category (Administration, EPM/Utilities, Cleaning, Maintenance, etc.).
* **Quick Operational Widget:**
  - *Upcoming Check-ins & Check-outs* (next 7 days).
  - *Pending Bills Due* (e.g., EPM due date approaching).
  - *Unresolved Damages Alert*.

---

### 6.2. Screen 2: Bookings & Income Manager (`/bookings`)
* **Views:**
  - Tabular list with columns: Guest Name, Confirmation Code, Check-in, Check-out, Nights, Gross COP, Fee COP, Net Payout COP, Payout Status (`Paid` / `Pending`).
  - Search by guest name or confirmation code.
* **Manual Booking Creation Form:**
  - Guest Name, Confirmation code (optional).
  - Date picker (Check-in to Check-out). System auto-calculates number of nights.
  - Rate inputs: Nightly rate, Cleaning fee charged to guest.
  - Automatic calculation preview:
    - $\text{Gross} = (\text{Nightly Rate} \times \text{Nights}) + \text{Cleaning Fee}$
    - $\text{Estimated Airbnb Host Fee (3\%)} = \text{Gross} \times 0.03$
    - $\text{Net Payout} = \text{Gross} - \text{Estimated Fee}$
    - Option for the user to manually override the exact net payout received from Airbnb.
* **CSV Import Wizard (`/bookings/import`):**
  - Drag-and-drop Airbnb reservation or payout CSV.
  - PapaParse parses rows in the browser.
  - Column mapping preview (Reservation code, Start date, End date, Nights, Earnings, Guest name).
  - Duplicate detection: Checks `airbnb_confirmation_code`; skips or flags existing entries.
  - Confirmation button: Inserts valid records into Supabase in a single batch.

---

### 6.3. Screen 3: Expenses & Bills Manager (`/expenses`)
The expenses module is organized into three complementary views to handle monthly fixed bills, recurring utilities, annual policies, and occasional purchases effortlessly:

#### A. View 1: Monthly Bills & Utilities Checklist (`/expenses/monthly-checklist`)
A dedicated operational checklist for the current billing cycle (e.g., September 2026):
* **Fixed & Utility Item Cards**:
  1. 🏢 **Administración (HOA):** Shows pre-configured fixed amount (e.g. `$ 380.000 COP`). 1-click "Mark Paid" + receipt upload.
  2. ⚡ **Luz (Electricity / EPM):** Prompts for monthly meter invoice amount in `$ COP`, due date, and receipt upload.
  3. 💧 **Agua (Water / Acueducto):** Bill amount in `$ COP`, due date, and receipt upload.
  4. 🔥 **Gas:** Bill amount in `$ COP`, due date, and receipt upload.
  5. 🌐 **Internet / Wi-Fi:** Shows fixed monthly fee (e.g. `$ 120.000 COP`). 1-click "Mark Paid".
* **Visual Status Indicators:** 
  - 🟢 **Paid** (with viewable receipt thumbnail and paid date)
  - 🟡 **Pending Due Soon** (displays warning if due date is within 5 days)
  - 🔴 **Overdue** (due date has passed without payment confirmation)
* **Cycle Selector:** Easily toggle between months (e.g., `< Agosto 2026 | Septiembre 2026 | Octubre 2026 >`).

#### B. View 2: All Expenses Ledger (`/expenses/all`)
* Complete filterable database of all historical outflows.
* **Filters:** Category dropdown, Expense Type (`fixed_monthly`, `utility_monthly`, `annual`, `per_stay`, `occasional`), Payment Status (`Paid`, `Pending`), Date Range.
* **Columns:** Date, Category badge, Description, Type, Amount `$ COP`, Linked Booking/Damage, Receipt (clickable modal), Actions (Edit, Delete).

#### C. View 3: Annual Costs & Periodic Policies (`/expenses/annual`)
* **Póliza de Seguro del Apto (Annual Property & Content Insurance):**
  - Policy provider, policy number, coverage period (Start Date ➡️ Renewal Date).
  - Total annual premium in `$ COP`.
  - Renewal alert (notifies 30 days before expiration).
  - **Accounting Display Option:**
    - *Cash Basis:* Recorded as a single lump-sum expense in the renewal month.
    - *Amortized Profitability:* Option in analytics to prorate $1/12\text{th}$ of the insurance premium each month for accurate net margin calculation.

#### D. Specialized Expense Forms
* **Occasional Restock / Insumos Modal (`supplies_restock`):**
  - Quick entry for supermarket/home store runs (e.g., "Homecenter: 6 sets of sheets", "Éxito: bulk coffee, shampoo, paper").
  - Date, total COP, itemized notes, receipt snapshot.
* **Per-Stay Turnover Cleaning Modal (`cleaning_laundry`):**
  - Associated with a specific guest stay.
  - Compares cleaning fee collected from guest vs. actual cleaner payout to verify turnover margin.

---

### 6.4. Screen 4: Damages & Incidents Hub (`/damages`)
* **Incident Pipeline View (Filter by Status):**
  - `Discovered` ➡️ `Guest Contacted` ➡️ `AirCover Claim Submitted` ➡️ `Approved / Reimbursed` ➡️ `Closed / Written Off`.
* **Report New Damage Form:**
  - Title & detailed description.
  - Date discovered (defaults to today).
  - Linked Booking: Dropdown of recent check-outs to identify the guest responsible.
  - Severity selector: `Low` (e.g. broken wine glass), `Medium` (stained towel/sheet), `High` (damaged appliance), `Critical` (flooding/lock broken).
  - Estimated Repair / Replacement Cost (in `$ COP`).
  - Photo Evidence: Multi-file uploader with instant image preview.
* **Damage Detail & Claim Management Modal (`/damages/:id`):**
  - Visual gallery of uploaded evidence photos.
  - Claim progress tracker (status stepper).
  - AirCover case number input and resolution notes log.
  - Reimbursement field: Amount recovered from guest or Airbnb.
  - **"Convert to Expense" Action:** If the host pays a repairman (e.g., $150.000 COP for a technician), one click creates a linked record in `expenses` under `maintenance_repairs`.

---

### 6.5. Screen 5: Settings & Property Profile (`/settings`)
* Apartment name, address, and default settings (default check-in/out times, base night rate).
* Database backup & CSV data export (download full bookings, expenses, and damages backup).

---

## 7. Colombian Peso (`COP`) Formatting Standards

To ensure clean, readable financial figures without distracting decimals:
- Number format: `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`
- Display example: `$ 1.250.000 COP`
- Input fields: Formatted mask so user types raw digits and sees currency delimiters dynamically.

---

## 8. Development & Implementation Roadmap

When we transition to execution, all legacy files will be deleted, and development will proceed in systematic phases:

```
[Wipe Legacy] ──> [Phase 1: DB & Storage Setup] ──> [Phase 2: Core Shell & Design System]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[Phase 3: Bookings & CSV Importer] ──> [Phase 4: Expenses & Receipts]
                                                   │
┌──────────────────────────────────────────────────┘
▼
[Phase 5: Damages Hub & Claims] ──> [Phase 6: Dashboard & Analytics] ──> [Testing & Polish]
```

1. **Clean Slate Reset:** Remove all legacy prototype code in `src/` to start fresh with clean architecture.
2. **Phase 1 — Supabase Setup:** Run DDL migrations, create `apartment-media` storage bucket, configure RLS.
3. **Phase 2 — UI Foundation & Layout:** Configure Tailwind CSS, install required shadcn/ui components, build top navbar, mobile navigation bar, and COP currency helpers.
4. **Phase 3 — Bookings & CSV Engine:** Implement Booking CRUD, validation schemas, and client-side Airbnb CSV parser.
5. **Phase 4 — Expenses & Bills Engine:** Implement Expense CRUD, recurring rules, and camera/file receipt uploads to Supabase.
6. **Phase 5 — Damages & Incidents Hub:** Implement incident reporting, multi-photo uploader, AirCover claim status tracking, and "convert to expense" bridge.
7. **Phase 6 — Analytics & Dashboard:** Build Recharts financial charts, KPI cards, and occupancy calculations.
8. **Phase 7 — Verification & Polish:** Mobile audit, edge-case testing, and documentation walkthrough.
