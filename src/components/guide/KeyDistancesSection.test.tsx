import { describe, it, expect } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyDistancesSection } from './KeyDistancesSection';
import type { KeyDistance } from '@/types/database';

const mockDistances: KeyDistance[] = [
  {
    id: 'd1',
    name: 'Aeropuerto Internacional Simón Bolívar (SMR)',
    category: 'airport',
    distance: '10 km',
    travel_time: '15 min en taxi',
    description: 'Vuelos nacionales e internacionales',
    icon: 'Plane',
    maps_url: 'https://maps.google.com/?q=Aeropuerto',
  },
  {
    id: 'd2',
    name: 'Playa Salguero',
    category: 'beach',
    distance: '50 metros',
    travel_time: '1 min a pie',
    description: 'Playa frente al edificio',
    icon: 'Waves',
    maps_url: 'https://maps.google.com/?q=PlayaSalguero',
  },
  {
    id: 'd3',
    name: 'Clínica Portoazul',
    category: 'hospital',
    distance: '3.5 km',
    travel_time: '8 min en taxi',
    description: 'Urgencias 24/7',
    icon: 'HeartPulse',
    maps_url: 'https://maps.google.com/?q=Clinica',
  },
];

describe('KeyDistancesSection', () => {
  it('renders section title, highlights ribbon, and place cards', () => {
    render(<KeyDistancesSection distances={mockDistances} />);

    expect(screen.getByText('Distancias y Puntos de Interés')).toBeInTheDocument();
    expect(screen.getByText('Resumen Rápido de Traslados')).toBeInTheDocument();

    // Check all places rendered
    expect(screen.getByText('Aeropuerto Internacional Simón Bolívar (SMR)')).toBeInTheDocument();
    expect(screen.getByText('Playa Salguero')).toBeInTheDocument();
    expect(screen.getByText('Clínica Portoazul')).toBeInTheDocument();

    // Check distance and travel times
    expect(screen.getByText('10 km')).toBeInTheDocument();
    expect(screen.getAllByText('15 min en taxi').length).toBeGreaterThan(0);
  });

  it('filters places by category when filter chip is clicked', async () => {
    const user = userEvent.setup();
    render(<KeyDistancesSection distances={mockDistances} />);

    // Click on Beach filter
    const beachFilter = screen.getByRole('button', { name: /Playas/i });
    await user.click(beachFilter);

    // Playa Salguero should be visible, Aeropuerto should not
    expect(screen.getByText('Playa Salguero')).toBeInTheDocument();
    expect(screen.queryByText('Aeropuerto Internacional Simón Bolívar (SMR)')).not.toBeInTheDocument();
  });
});
