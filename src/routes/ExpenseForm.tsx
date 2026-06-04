import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { expenseSchema, type ExpenseFormData } from "@/lib/validators";
import { useCreateExpense, useExpense, useUpdateExpense } from "@/hooks/use-expenses";
import { toast } from "sonner";

const categoryOptions = [
  { value: "fixed_cost", label: "Fixed Cost" },
  { value: "cleaning", label: "Cleaning" },
  { value: "supervisor", label: "Supervisor" },
  { value: "maintenance", label: "Maintenance" },
  { value: "supplies", label: "Supplies" },
  { value: "other", label: "Other" },
];

export default function ExpenseForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { data: existing } = useExpense(id);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    values: existing ? {
      category: existing.category as ExpenseFormData["category"],
      description: existing.description,
      amount: Number(existing.amount),
      date: existing.date,
      recurring: existing.recurring || false,
      recurrence_rule: existing.recurrence_rule || undefined,
      paid: existing.paid || false,
      notes: existing.notes || "",
    } : undefined,
  });

  const isRecurring = watch("recurring");

  async function onSubmit(data: ExpenseFormData) {
    try {
      if (isEditing && id) {
        await updateExpense.mutateAsync({ id, data });
        toast.success("Expense updated!");
      } else {
        await createExpense.mutateAsync(data);
        toast.success("Expense created!");
      }
      navigate("/expenses");
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {isEditing ? "Edit Expense" : "New Expense"}
        </h2>
        <p className="text-muted-foreground">
          {isEditing ? "Update expense details" : "Add a new expense"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit as never)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="category" className="text-sm font-medium">Category</label>
          <select id="category" {...register("category")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Select category...</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-red-600">{errors.category.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="description" className="text-sm font-medium">Description</label>
          <input id="description" {...register("description")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="e.g. Monthly rent" />
          {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="amount" className="text-sm font-medium">Amount (€)</label>
            <input id="amount" type="number" step="0.01" {...register("amount", { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.amount && <p className="text-xs text-red-600">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="date" className="text-sm font-medium">Date</label>
            <input id="date" type="date" {...register("date")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.date && <p className="text-xs text-red-600">{errors.date.message}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input id="recurring" type="checkbox" {...register("recurring")} className="rounded border-input" />
          <label htmlFor="recurring" className="text-sm font-medium">Recurring expense</label>
        </div>

        {isRecurring && (
          <div className="space-y-1">
            <label htmlFor="recurrence_rule" className="text-sm font-medium">Recurrence</label>
            <select id="recurrence_rule" {...register("recurrence_rule")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input id="paid" type="checkbox" {...register("paid")} className="rounded border-input" />
          <label htmlFor="paid" className="text-sm font-medium">Already paid</label>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">Notes</label>
          <textarea id="notes" {...register("notes")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="Optional notes..." />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSubmitting ? "Saving..." : isEditing ? "Update Expense" : "Create Expense"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}



