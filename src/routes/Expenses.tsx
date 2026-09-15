import { useState } from 'react';
import {
  Plus,
  ShoppingBag,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  CalendarDays,
  ShieldCheck,
  ListOrdered,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useExpenses, useDeleteExpense } from '@/hooks/use-expenses';
import { MonthlyChecklistView } from '@/components/expenses/MonthlyChecklistView';
import { AnnualInsuranceView } from '@/components/expenses/AnnualInsuranceView';
import { ExpenseModal } from '@/components/expenses/ExpenseModal';
import { Modal } from '@/components/ui/modal';
import { formatCOP, formatDate, CATEGORY_LABELS, EXPENSE_TYPE_LABELS } from '@/lib/formatters';
import type { Expense, ExpenseCategory } from '@/types/database';
import { toast } from 'sonner';

type ActiveTab = 'checklist' | 'ledger' | 'insurance';

export default function Expenses() {
  const { data: expenses = [], isLoading } = useExpenses();
  const deleteExpenseMutation = useDeleteExpense();

  const [activeTab, setActiveTab] = useState<ActiveTab>('checklist');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [defaultCategory, setDefaultCategory] = useState<ExpenseCategory>('other');

  // Search & Filter for the Ledger view
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Receipt viewer modal
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | null>(null);

  // Sorting state for the Ledger view
  type SortField = 'date' | 'category' | 'description' | 'expense_type' | 'amount';
  type SortDirection = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(
        field === 'description' || field === 'category' || field === 'expense_type' ? 'asc' : 'desc'
      );
    }
  };

  const filteredExpenses = expenses.filter((e) => {
    const matchesSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || e.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || e.payment_status === selectedStatus;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'date') {
      cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortField === 'category') {
      const catA = CATEGORY_LABELS[a.category]?.label || a.category;
      const catB = CATEGORY_LABELS[b.category]?.label || b.category;
      cmp = catA.localeCompare(catB, 'es', { sensitivity: 'base' });
    } else if (sortField === 'description') {
      cmp = a.description.localeCompare(b.description, 'es', { sensitivity: 'base' });
    } else if (sortField === 'expense_type') {
      const typeA = EXPENSE_TYPE_LABELS[a.expense_type] || a.expense_type;
      const typeB = EXPENSE_TYPE_LABELS[b.expense_type] || b.expense_type;
      cmp = typeA.localeCompare(typeB, 'es', { sensitivity: 'base' });
    } else if (sortField === 'amount') {
      cmp = (Number(a.amount) || 0) - (Number(b.amount) || 0);
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const renderSortHeader = (
    field: SortField,
    label: string,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3.5 cursor-pointer select-none transition-colors hover:text-slate-900 dark:hover:text-white ${
          align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
        }`}
      >
        <div
          className={`inline-flex items-center gap-1.5 group ${
            align === 'center'
              ? 'justify-center'
              : align === 'right'
              ? 'justify-end'
              : 'justify-start'
          }`}
        >
          <span>{label}</span>
          {isActive ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            ) : (
              <ArrowDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            )
          ) : (
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </div>
      </th>
    );
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`¿Estás seguro de eliminar el gasto "${description}"?`)) {
      try {
        await deleteExpenseMutation.mutateAsync(id);
        toast.success('Gasto eliminado');
      } catch {
        toast.error('No se pudo eliminar el gasto');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Gastos y Servicios del Apartamento
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Administración, servicios públicos (EPM), seguro anual, insumos y limpiezas
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Restock Insumos Button */}
          <button
            type="button"
            onClick={() => {
              setExpenseToEdit(null);
              setDefaultCategory('supplies_restock');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-amber-500" />
            <span>Registrar Insumos</span>
          </button>

          {/* General New Expense */}
          <button
            type="button"
            onClick={() => {
              setExpenseToEdit(null);
              setDefaultCategory('other');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Gasto</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'checklist'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Planilla Mensual de Servicios</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ledger'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ListOrdered className="w-4 h-4" />
          <span>Libro Completo de Gastos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('insurance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'insurance'
              ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Seguro Anual</span>
        </button>
      </div>

      {/* View 1: Monthly Bills Checklist */}
      {activeTab === 'checklist' && (
        <MonthlyChecklistView onViewReceipt={(url) => setActiveReceiptUrl(url)} />
      )}

      {/* View 2: All Expenses Ledger */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar gasto por descripción..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="all">Todas las categorías</option>
                {Object.entries(CATEGORY_LABELS).map(([catKey, { label }]) => (
                  <option key={catKey} value={catKey}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="all">Todos los estados</option>
                <option value="paid">Pagado</option>
                <option value="pending">Pendiente</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 text-sm">Cargando gastos...</div>
            ) : sortedExpenses.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm">
                No hay gastos que coincidan con los filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/75 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <tr>
                      {renderSortHeader('date', 'Fecha', 'left')}
                      {renderSortHeader('category', 'Categoría', 'left')}
                      {renderSortHeader('description', 'Descripción', 'left')}
                      {renderSortHeader('expense_type', 'Tipo', 'left')}
                      {renderSortHeader('amount', 'Monto COP', 'right')}
                      <th className="px-4 py-3.5 text-center">Estado</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sortedExpenses.map((exp) => {
                      const catInfo = CATEGORY_LABELS[exp.category] || { label: exp.category };
                      const typeLabel = EXPENSE_TYPE_LABELS[exp.expense_type] || exp.expense_type;

                      return (
                        <tr
                          key={exp.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                            {formatDate(exp.date)}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {catInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">
                            {exp.description}
                            {exp.linked_booking_id && (
                              <span className="block text-[11px] text-slate-400">
                                Vinculado a huésped
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {typeLabel}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-900 dark:text-white">
                            {formatCOP(exp.amount)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {exp.payment_status === 'paid' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                Pagado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {exp.receipt_url && (
                                <button
                                  type="button"
                                  onClick={() => setActiveReceiptUrl(exp.receipt_url!)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                  title="Ver Recibo"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setExpenseToEdit(exp);
                                  setIsModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(exp.id, exp.description)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 3: Annual Insurance */}
      {activeTab === 'insurance' && (
        <AnnualInsuranceView onViewReceipt={(url) => setActiveReceiptUrl(url)} />
      )}

      {/* Modals */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setExpenseToEdit(null);
        }}
        expenseToEdit={expenseToEdit}
        defaultCategory={defaultCategory}
      />

      {/* Receipt Viewer Modal */}
      <Modal
        isOpen={Boolean(activeReceiptUrl)}
        onClose={() => setActiveReceiptUrl(null)}
        title="Comprobante / Recibo Adjunto"
        maxWidth="lg"
      >
        <div className="p-2 text-center">
          {activeReceiptUrl && (
            <img
              src={activeReceiptUrl}
              alt="Comprobante"
              className="max-h-[70vh] mx-auto rounded-xl object-contain border border-slate-200 dark:border-slate-700 shadow-md"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
