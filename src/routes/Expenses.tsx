import { Link } from "react-router-dom";
import { useExpenses } from "@/hooks/use-expenses";
import { format } from "date-fns";
import { Plus } from "lucide-react";

const categoryLabels: Record<string, string> = {
  fixed_cost: "Fixed Cost",
  cleaning: "Cleaning",
  supervisor: "Supervisor",
  maintenance: "Maintenance",
  supplies: "Supplies",
  other: "Other",
};

export default function Expenses() {
  const { data: expenses = [], isLoading } = useExpenses();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Expenses</h2>
          <p className="text-muted-foreground">Track apartment expenses</p>
        </div>
        <Link
          to="/expenses/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-sm font-medium">Description</th>
                <th className="p-3 text-left text-sm font-medium">Category</th>
                <th className="p-3 text-left text-sm font-medium">Date</th>
                <th className="p-3 text-left text-sm font-medium">Amount</th>
                <th className="p-3 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No expenses yet. Add your first expense!
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Link to={`/expenses/${expense.id}`} className="font-medium hover:underline">
                        {expense.description}
                      </Link>
                    </td>
                    <td className="p-3 text-sm">{categoryLabels[expense.category] || expense.category}</td>
                    <td className="p-3 text-sm">{format(new Date(expense.date), "MMM d, yyyy")}</td>
                    <td className="p-3 text-sm font-medium text-red-600">€{Number(expense.amount).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        expense.paid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {expense.paid ? "Paid" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

