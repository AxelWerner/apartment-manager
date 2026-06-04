import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookingSchema, type BookingFormData } from "@/lib/validators";
import { useCreateBooking, useBooking, useUpdateBooking } from "@/hooks/use-bookings";
import { toast } from "sonner";

export default function BookingForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { data: existing } = useBooking(id);
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    values: existing ? {
      guest_name: existing.guest_name,
      check_in: existing.check_in,
      check_out: existing.check_out,
      nightly_rate: Number(existing.nightly_rate),
      total_payout: Number(existing.total_payout),
      airbnb_fees: Number(existing.airbnb_fees) || 0,
      cleaning_fee: Number(existing.cleaning_fee) || 0,
      status: existing.status || "confirmed",
      notes: existing.notes || "",
    } : undefined,
  });

  async function onSubmit(data: BookingFormData) {
    try {
      if (isEditing && id) {
        await updateBooking.mutateAsync({ id, data });
        toast.success("Booking updated!");
      } else {
        await createBooking.mutateAsync(data);
        toast.success("Booking created!");
      }
      navigate("/bookings");
    } catch {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          {isEditing ? "Edit Booking" : "New Booking"}
        </h2>
        <p className="text-muted-foreground">
          {isEditing ? "Update booking details" : "Add a new Airbnb booking"}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="guest_name" className="text-sm font-medium">Guest Name</label>
          <input id="guest_name" {...register("guest_name")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="John Doe" />
          {errors.guest_name && <p className="text-xs text-red-600">{errors.guest_name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="check_in" className="text-sm font-medium">Check-in</label>
            <input id="check_in" type="date" {...register("check_in")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.check_in && <p className="text-xs text-red-600">{errors.check_in.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="check_out" className="text-sm font-medium">Check-out</label>
            <input id="check_out" type="date" {...register("check_out")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.check_out && <p className="text-xs text-red-600">{errors.check_out.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="nightly_rate" className="text-sm font-medium">Nightly Rate (€)</label>
            <input id="nightly_rate" type="number" step="0.01" {...register("nightly_rate", { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.nightly_rate && <p className="text-xs text-red-600">{errors.nightly_rate.message}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="total_payout" className="text-sm font-medium">Total Payout (€)</label>
            <input id="total_payout" type="number" step="0.01" {...register("total_payout", { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            {errors.total_payout && <p className="text-xs text-red-600">{errors.total_payout.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="airbnb_fees" className="text-sm font-medium">Airbnb Fees (€)</label>
            <input id="airbnb_fees" type="number" step="0.01" {...register("airbnb_fees", { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="cleaning_fee" className="text-sm font-medium">Cleaning Fee (€)</label>
            <input id="cleaning_fee" type="number" step="0.01" {...register("cleaning_fee", { valueAsNumber: true })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select id="status" {...register("status")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="notes" className="text-sm font-medium">Notes</label>
          <textarea id="notes" {...register("notes")} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" placeholder="Optional notes..." />
        </div>

        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {isSubmitting ? "Saving..." : isEditing ? "Update Booking" : "Create Booking"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

