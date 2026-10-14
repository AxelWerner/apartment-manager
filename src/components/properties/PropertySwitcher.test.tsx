import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { PropertySwitcher, RoleBadge } from './PropertySwitcher';
import { renderWithProviders } from '@/test/test-utils';
import * as propertyContext from '@/context/PropertyContext';
import type { Property, UserRole } from '@/types/database';

vi.mock('@/context/PropertyContext', () => ({
  useActiveProperty: vi.fn(),
}));

describe('PropertySwitcher Component', () => {
  const mockSwitchProperty = vi.fn();

  const mockProperty1: Property = {
    id: 'prop-1',
    name: 'Palermo Loft',
    city: 'Buenos Aires',
    address: 'Calle 1',
    currency: 'USD',
    default_nightly_rate: 100,
    default_cleaning_fee: 30,
    check_in_time: '15:00',
    check_out_time: '11:00',
  };

  const mockProperty2: Property = {
    id: 'prop-2',
    name: 'Recoleta Studio',
    city: 'Buenos Aires',
    address: 'Calle 2',
    currency: 'USD',
    default_nightly_rate: 120,
    default_cleaning_fee: 35,
    check_in_time: '15:00',
    check_out_time: '11:00',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(propertyContext.useActiveProperty).mockReturnValue({
      properties: [
        { property: mockProperty1, role: 'PRIMARY_OWNER', isOwner: true },
        { property: mockProperty2, role: 'OPERATOR', isOwner: false },
      ],
      activeProperty: mockProperty1,
      activePropertyId: 'prop-1',
      role: 'PRIMARY_OWNER',
      isOwner: true,
      switchProperty: mockSwitchProperty,
    } as unknown as ReturnType<typeof propertyContext.useActiveProperty>);
  });

  describe('RoleBadge', () => {
    const roles: { role: UserRole; expected: string }[] = [
      { role: 'SUPER_USER', expected: 'Super Admin' },
      { role: 'PRIMARY_OWNER', expected: 'Dueño Principal' },
      { role: 'OWNER', expected: 'Dueño' },
      { role: 'ADMINISTRATOR', expected: 'Admin' },
      { role: 'OPERATOR', expected: 'Gestor' },
      { role: 'CLEANER', expected: 'Limpieza' },
      { role: 'VIEWER', expected: 'Lector' },
    ];

    it.each(roles)('renders label $expected for role $role', ({ role, expected }) => {
      render(<RoleBadge role={role} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
    });
  });

  describe('PropertySwitcher functionality', () => {
    it('renders current active property details', () => {
      renderWithProviders(<PropertySwitcher />);

      expect(screen.getByText('Palermo Loft')).toBeInTheDocument();
      expect(screen.getByText('Buenos Aires')).toBeInTheDocument();
      expect(screen.getByText('Dueño Principal')).toBeInTheDocument();
    });

    it('renders in compact mode without extra badges', () => {
      renderWithProviders(<PropertySwitcher compact />);

      expect(screen.getByText('Palermo Loft')).toBeInTheDocument();
      expect(screen.queryByText('Dueño Principal')).not.toBeInTheDocument();
    });

    it('toggles dropdown and switches property when clicked', () => {
      renderWithProviders(<PropertySwitcher />);

      const toggleBtn = screen.getByRole('button', { name: /Palermo Loft/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('2 inmuebles')).toBeInTheDocument();
      expect(screen.getByText('Recoleta Studio')).toBeInTheDocument();

      const switchBtn = screen.getByRole('button', { name: /Recoleta Studio/i });
      fireEvent.click(switchBtn);

      expect(mockSwitchProperty).toHaveBeenCalledWith('prop-2');
      // Dropdown closes after selecting
      expect(screen.queryByText('2 inmuebles')).not.toBeInTheDocument();
    });

    it('closes dropdown when Escape key is pressed or clicked outside', () => {
      renderWithProviders(<PropertySwitcher />);

      const toggleBtn = screen.getByRole('button', { name: /Palermo Loft/i });
      fireEvent.click(toggleBtn);
      expect(screen.getByText('2 inmuebles')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByText('2 inmuebles')).not.toBeInTheDocument();

      // Open again and click outside
      fireEvent.click(toggleBtn);
      expect(screen.getByText('2 inmuebles')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByText('2 inmuebles')).not.toBeInTheDocument();
    });

    it('opens create property modal when clicking add new apartment button', () => {
      renderWithProviders(<PropertySwitcher />);

      const toggleBtn = screen.getByRole('button', { name: /Palermo Loft/i });
      fireEvent.click(toggleBtn);

      const addBtn = screen.getByRole('button', { name: /Añadir nuevo apartamento/i });
      fireEvent.click(addBtn);

      expect(screen.getByText('Nuevo Apartamento')).toBeInTheDocument();
    });
  });
});
