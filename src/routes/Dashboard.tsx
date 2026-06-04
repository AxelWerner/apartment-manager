import { useBookings } from "@/hooks/use-bookings";
import { useExpenses } from "@/hooks/use-expenses";
import { formatCurrency } from "@/lib/utils";
import { startOfMonth, endOfMonth, format } from "date-fns";

export default function Dashboard() {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString().split("T")[0];
  const monthEnd = endOfMonth(now).toISOString().split("T")[0];

  const { data: bookings = [] } = useBookings({ from: monthStart, to: monthEnd });
  const { data: expenses = [] } = useExpenses({ from: monthStart, to: monthEnd });

  const totalIncome = bookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + Number(b.total_payout), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const profit = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview for {format(now, "MMMM yyyy")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KPICard title="Income" value={totalIncome} variant="positive" />
        <KPICard title="Expenses" value={totalExpenses} variant="negative" />
        <KPICard
          title="Profit"
          value={profit}
          variant={profit >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-6 h-64 flex items-center justify-center text-muted-foreground">
          Expense breakdown chart (coming soon)
        </div>
        <div className="rounded-lg border p-6 h-64 flex items-center justify-center text-muted-foreground">
          Monthly trend chart (coming soon)
        </div>
      </div>
    </div>
  );
}

function KPICard({
  title,
  value,
  variant,
}: {
  title: string;
  value: number;
  variant: "positive" | "negative";
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p
        className={`text-2xl font-bold ${
          variant === "positive" ? "text-green-600" : "text-red-600"
        }`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}

