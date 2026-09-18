import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MiniPieCardChart } from './MiniPieCardChart';

describe('MiniPieCardChart Component', () => {
  it('renders empty state when there are no valid data items or values are 0', () => {
    render(
      <MiniPieCardChart
        data={[
          { name: 'Airbnb', value: 0, color: '#f43f5e' },
          { name: 'Directas', value: 0, color: '#10b981' },
        ]}
        emptyText="Sin movimientos"
      />
    );

    expect(screen.getByText('Sin movimientos')).toBeInTheDocument();
  });

  it('renders items with percentages by default and toggles to values on click', async () => {
    const user = userEvent.setup();
    render(
      <MiniPieCardChart
        data={[
          { name: 'Airbnb', value: 800000, color: '#f43f5e' },
          { name: 'Directas (10%)', value: 200000, color: '#10b981' },
        ]}
      />
    );

    expect(screen.getByText('Airbnb')).toBeInTheDocument();
    expect(screen.getByText('Directas (10%)')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();

    // Click the toggle button to switch to values mode ($)
    const toggleBtn = screen.getByRole('button');
    await user.click(toggleBtn);

    // Now values formatted in COP should be displayed
    expect(screen.getByText((content) => content.includes('800.000'))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('200.000'))).toBeInTheDocument();

    // Click again to toggle back to percentages
    await user.click(toggleBtn);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it('supports non-currency items with custom unit label and toggles', async () => {
    const user = userEvent.setup();
    render(
      <MiniPieCardChart
        data={[
          { name: 'Airbnb', value: 3, color: '#f43f5e' },
          { name: 'Directas', value: 1, color: '#10b981' },
        ]}
        isCurrency={false}
        unitLabel="reservas"
      />
    );

    expect(screen.getByText('Airbnb')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();

    // Click toggle button to switch to quantity mode
    const toggleBtn = screen.getByRole('button');
    await user.click(toggleBtn);

    expect(screen.getByText('3 reservas')).toBeInTheDocument();
    expect(screen.getByText('1 reservas')).toBeInTheDocument();
  });
});
