import { Link } from "react-router-dom";
import { useBookings } from "@/hooks/use-bookings";
import { format } from "date-fns";
import { Plus } from "lucide-react";

export default function Bookings() {
  const { data: bookings = [], isLoading } = useBookings();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bookings</h2>
          <p className="text-muted-foreground">Manage your Airbnb bookings</p>
        </div>
        <Link
          to="/bookings/new"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Booking
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left text-sm font-medium">Guest</th>
                <th className="p-3 text-left text-sm font-medium">Check-in</th>
                <th className="p-3 text-left text-sm font-medium">Check-out</th>
                <th className="p-3 text-left text-sm font-medium">Payout</th>
                <th className="p-3 text-left text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No bookings yet. Add your first booking!
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Link to={`/bookings/${booking.id}`} className="font-medium hover:underline">
                        {booking.guest_name}
                      </Link>
                    </td>
                    <td className="p-3 text-sm">{format(new Date(booking.check_in), "MMM d, yyyy")}</td>
                    <td className="p-3 text-sm">{format(new Date(booking.check_out), "MMM d, yyyy")}</td>
                    <td className="p-3 text-sm font-medium">€{Number(booking.total_payout).toFixed(2)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        booking.status === "completed" ? "bg-green-100 text-green-700" :
                        booking.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {booking.status}
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

