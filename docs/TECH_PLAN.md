# Apartment Manager — Technical Plan

## Tech Stack (Option A — React + Vite SPA + Supabase)

| Layer            | Choice                          |
|------------------|---------------------------------|
| **Framework**    | React 19 + Vite 7               |
| **Language**     | TypeScript                      |
| **UI Library**   | shadcn/ui + Tailwind CSS 4      |
| **Routing**      | React Router v7                 |
| **Backend/DB**   | Supabase (PostgreSQL + REST + Auth) |
| **Data Fetching**| TanStack Query v5               |
| **Forms**        | React Hook Form + Zod           |
| **Charts**       | Recharts                        |
| **Hosting**      | Vercel / Netlify (static SPA)   |
| **Package Mgr**  | pnpm                            |
| **Node Version** | 20 LTS                          |

---

## Directory Layout

```
apartment-manager/
├── docs/                        # Project documentation
├── public/                      # Static assets
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component with router
│   ├── routes/                  # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Bookings.tsx
│   │   ├── BookingForm.tsx
│   │   ├── Expenses.tsx
│   │   ├── ExpenseForm.tsx
│   │   └── Reports.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── layout/              # Shell, Sidebar, Header
│   │   ├── bookings/            # Booking-specific components
│   │   ├── expenses/            # Expense-specific components
│   │   └── dashboard/           # Charts, KPI cards
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── utils.ts             # Utility functions (cn, formatCurrency)
│   │   └── validators.ts        # Zod schemas
│   ├── hooks/
│   │   ├── use-bookings.ts      # TanStack Query hooks for bookings
│   │   └── use-expenses.ts      # TanStack Query hooks for expenses
│   ├── types/
│   │   └── database.ts          # Supabase generated types
│   └── styles/
│       └── globals.css           # Tailwind + shadcn theme
├── supabase/
│   └── migrations/              # SQL migrations for Supabase
├── .env.local                   # Supabase URL + anon key
├── .gitignore
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Database Schema (Supabase SQL)

```sql
-- Enums
CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'cancelled');
CREATE TYPE expense_category AS ENUM ('fixed_cost', 'cleaning', 'supervisor', 'maintenance', 'supplies', 'other');
CREATE TYPE recurrence_rule AS ENUM ('monthly', 'quarterly', 'annual');

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name TEXT NOT NULL,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nightly_rate NUMERIC(10,2) NOT NULL,
  total_payout NUMERIC(10,2) NOT NULL,
  airbnb_fees NUMERIC(10,2) DEFAULT 0,
  cleaning_fee NUMERIC(10,2) DEFAULT 0,
  status booking_status DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category expense_category NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule recurrence_rule,
  paid BOOLEAN DEFAULT false,
  linked_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Feature Implementation Plan

### Phase 1 — MVP

| # | Feature | Route | Key Components |
|---|---------|-------|----------------|
| 1 | **Bookings CRUD** | `/bookings`, `/bookings/new`, `/bookings/:id` | BookingTable, BookingForm |
| 2 | **Expenses CRUD** | `/expenses`, `/expenses/new`, `/expenses/:id` | ExpenseTable, ExpenseForm |
| 3 | **Dashboard** | `/` | KPICards, PLChart, ExpenseBreakdown |
| 4 | **Recurring Expenses** | (part of expense form) | RecurrenceConfig |
| 5 | **Filtering** | (shared) | DateRangePicker, CategoryFilter |

### Phase 2 — Enhancements

| # | Feature | Notes |
|---|---------|-------|
| 1 | CSV/PDF export | `papaparse` for CSV, `jspdf` for PDF |
| 2 | Occupancy calendar | Calendar view with booked/available nights |
| 3 | Photo receipts | Upload to Supabase Storage |
| 4 | Multi-apartment | Add `apartments` table, scope queries |
| 5 | Airbnb iCal sync | Parse iCal feed URL |

---

## Key Libraries

| Purpose | Library |
|---------|---------|
| Routing | React Router v7 |
| Data fetching | TanStack Query v5 |
| Validation | Zod |
| Forms | React Hook Form + `@hookform/resolvers` |
| Date handling | date-fns |
| Charts | Recharts |
| Notifications | sonner |
| DB Client | @supabase/supabase-js |

---

## Conventions

- **Naming:** kebab-case for files, PascalCase for components, camelCase for functions/variables
- **Validation:** Zod schemas in `src/lib/validators.ts`, shared between forms and API calls
- **Data flow:** Components → TanStack Query hooks → Supabase client → PostgreSQL
- **State:** Server state via TanStack Query; minimal client state
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)

---

## Environment Variables

```env
# .env.local
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

