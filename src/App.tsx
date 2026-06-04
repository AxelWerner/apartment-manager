import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/app-layout";
import Dashboard from "@/routes/Dashboard";
import Bookings from "@/routes/Bookings";
import BookingForm from "@/routes/BookingForm";
import Expenses from "@/routes/Expenses";
import ExpenseForm from "@/routes/ExpenseForm";
import Reports from "@/routes/Reports";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/bookings/new" element={<BookingForm />} />
        <Route path="/bookings/:id" element={<BookingForm />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/new" element={<ExpenseForm />} />
        <Route path="/expenses/:id" element={<ExpenseForm />} />
        <Route path="/reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}

