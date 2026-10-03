import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyCostCards } from './DailyCostCards';
import { calculateApartmentDailyCosts } from '@/lib/daily-costs';

describe('DailyCostCards Component', () => {
  it('renders both empty and occupied apartment cost cards', () => {
    const calculation = calculateApartmentDailyCosts('2026-10', [], []);

    render(<DailyCostCards calculation={calculation} />);

    // Header and cards
    expect(screen.getByText(/Costo Diario del Apartamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor de Apto Vacío/i)).toBeInTheDocument();
    expect(screen.getByText(/Valor de Apto con Gente/i)).toBeInTheDocument();

    // Check that empty card displays the fixed electricity info
    expect(screen.getByText(/Luz fija: \$ 70.000 COP/i)).toBeInTheDocument();

    // Check that comparison banner is displayed
    expect(screen.getByText(/Diferencia de costo:/i)).toBeInTheDocument();
  });

  it('toggles detailed breakdown table when clicking the toggle button', () => {
    const calculation = calculateApartmentDailyCosts('2026-10', [], []);

    render(<DailyCostCards calculation={calculation} />);

    const toggleBtn = screen.getByRole('button', { name: /ver desglose de conceptos/i });
    expect(toggleBtn).toBeInTheDocument();

    // Initially table not visible
    expect(screen.queryByText(/Comparativa Detallada de Costos Mensuales y Diarios/i)).not.toBeInTheDocument();

    // Click to show
    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Comparativa Detallada de Costos Mensuales y Diarios/i)).toBeInTheDocument();

    // Click to hide
    fireEvent.click(screen.getByRole('button', { name: /ocultar desglose/i }));
    expect(screen.queryByText(/Comparativa Detallada de Costos Mensuales y Diarios/i)).not.toBeInTheDocument();
  });
});
