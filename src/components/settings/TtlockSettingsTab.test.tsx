import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { TtlockSettingsTab } from './TtlockSettingsTab';
import * as ttlockHooks from '@/hooks/use-ttlock';

vi.mock('@/hooks/use-ttlock', () => ({
  usePropertyLock: vi.fn(),
  useAccountLocks: vi.fn(),
  useConnectTtlockAccount: vi.fn(),
  useAssignPropertyLock: vi.fn(),
  useUnlinkPropertyLock: vi.fn(),
}));

describe('TtlockSettingsTab', () => {
  const mockConnectMutate = vi.fn().mockResolvedValue({ success: true, message: 'Conectado' });
  const mockAssignMutate = vi.fn().mockResolvedValue({});
  const mockUnlinkMutate = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(ttlockHooks.useConnectTtlockAccount).mockReturnValue({
      mutateAsync: mockConnectMutate,
      isPending: false,
    } as unknown as ReturnType<typeof ttlockHooks.useConnectTtlockAccount>);

    vi.mocked(ttlockHooks.useAssignPropertyLock).mockReturnValue({
      mutateAsync: mockAssignMutate,
      isPending: false,
    } as unknown as ReturnType<typeof ttlockHooks.useAssignPropertyLock>);

    vi.mocked(ttlockHooks.useUnlinkPropertyLock).mockReturnValue({
      mutateAsync: mockUnlinkMutate,
      isPending: false,
    } as unknown as ReturnType<typeof ttlockHooks.useUnlinkPropertyLock>);
  });

  it('renders Connect button and opens in-app connection modal', async () => {
    const user = userEvent.setup();

    vi.mocked(ttlockHooks.usePropertyLock).mockReturnValue({
      data: null,
      isLoading: false,
    } as unknown as ReturnType<typeof ttlockHooks.usePropertyLock>);

    vi.mocked(ttlockHooks.useAccountLocks).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof ttlockHooks.useAccountLocks>);

    renderWithProviders(
      <TtlockSettingsTab propertyId="prop-1" propertyName="Apto 1017" isOwner={true} />
    );

    expect(screen.getByText('Conecta tu cuenta de TTLock')).toBeInTheDocument();
    const connectBtn = screen.getByRole('button', { name: /Conectar con TTLock/i });
    await user.click(connectBtn);

    // Modal appears in-app (no 404 external redirect)
    expect(screen.getByText('Conectar Cuenta de TTLock')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/usuario@gmail.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Contraseña de tu app TTLock/i)).toBeInTheDocument();

    // Type credentials and submit
    await user.type(screen.getByPlaceholderText(/usuario@gmail.com/i), 'axel@test.com');
    await user.type(screen.getByPlaceholderText(/Contraseña de tu app TTLock/i), 'secret123');

    const submitBtn = screen.getByRole('button', { name: /Conectar y Buscar Cerraduras/i });
    await user.click(submitBtn);

    expect(mockConnectMutate).toHaveBeenCalledWith({
      propertyId: 'prop-1',
      username: 'axel@test.com',
      password: 'secret123',
    });
  });

  it('renders lock selector when account is connected and assigns chosen lock', async () => {
    const user = userEvent.setup();

    vi.mocked(ttlockHooks.usePropertyLock).mockReturnValue({
      data: {
        id: 'lock-1',
        property_id: 'prop-1',
        access_token: 'valid-token',
        is_active: false,
        account_email: 'pepito@gmail.com',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof ttlockHooks.usePropertyLock>);

    vi.mocked(ttlockHooks.useAccountLocks).mockReturnValue({
      data: [
        { lockId: 31266290, lockName: 'Cerradura Puerta Principal', lockAlias: 'Apto 1017' },
        { lockId: 44556677, lockName: 'Cerradura Secundaria' },
      ],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof ttlockHooks.useAccountLocks>);

    renderWithProviders(
      <TtlockSettingsTab propertyId="prop-1" propertyName="Apto 1017" isOwner={true} />
    );

    expect(screen.getByText('Cuenta TTLock Conectada')).toBeInTheDocument();
    expect(screen.getByText('pepito@gmail.com')).toBeInTheDocument();
    expect(screen.getByLabelText(/Selecciona la cerradura de este apartamento/i)).toBeInTheDocument();

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '31266290');

    const assignBtn = screen.getByRole('button', { name: /Asignar y Activar Cerradura/i });
    await user.click(assignBtn);

    expect(mockAssignMutate).toHaveBeenCalledWith({
      propertyId: 'prop-1',
      lockId: 31266290,
      lockName: 'Cerradura Puerta Principal',
      lockAlias: 'Apto 1017',
    });
  });

  it('renders active lock status and opens unlinking confirmation modal', async () => {
    const user = userEvent.setup();

    vi.mocked(ttlockHooks.usePropertyLock).mockReturnValue({
      data: {
        id: 'lock-1',
        property_id: 'prop-1',
        lock_id: 31266290,
        lock_name: 'Cerradura Entrada',
        access_token: 'valid-token',
        is_active: true,
        account_email: 'pepito@gmail.com',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof ttlockHooks.usePropertyLock>);

    vi.mocked(ttlockHooks.useAccountLocks).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof ttlockHooks.useAccountLocks>);

    renderWithProviders(
      <TtlockSettingsTab propertyId="prop-1" propertyName="Apto 1017" isOwner={true} />
    );

    expect(screen.getByText('Cerradura Entrada')).toBeInTheDocument();
    expect(screen.getByText('31266290')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();

    // Click Unlink
    const unlinkBtn = screen.getByRole('button', { name: /Desvincular/i });
    await user.click(unlinkBtn);

    // Confirmation modal appears
    expect(screen.getByText('¿Desvincular cerradura del apartamento?')).toBeInTheDocument();
    expect(screen.getByText(/Los códigos PIN emitidos anteriormente NO se borrarán/i)).toBeInTheDocument();

    // Confirm unlinking
    const confirmBtn = screen.getByRole('button', { name: /Sí, desvincular cerradura/i });
    await user.click(confirmBtn);

    expect(mockUnlinkMutate).toHaveBeenCalledWith({
      propertyId: 'prop-1',
      unlinkType: 'lock_only',
    });
  });

  it('allows full account disconnection from modal', async () => {
    const user = userEvent.setup();

    vi.mocked(ttlockHooks.usePropertyLock).mockReturnValue({
      data: {
        id: 'lock-1',
        property_id: 'prop-1',
        access_token: 'valid-token',
        is_active: false,
        account_email: 'pepito@gmail.com',
      },
      isLoading: false,
    } as unknown as ReturnType<typeof ttlockHooks.usePropertyLock>);

    vi.mocked(ttlockHooks.useAccountLocks).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof ttlockHooks.useAccountLocks>);

    renderWithProviders(
      <TtlockSettingsTab propertyId="prop-1" propertyName="Apto 1017" isOwner={true} />
    );

    const disconnectBtn = screen.getByRole('button', { name: /Desconectar Cuenta/i });
    await user.click(disconnectBtn);

    expect(screen.getByText('¿Desconectar cuenta de TTLock?')).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /Sí, desconectar cuenta/i });
    await user.click(confirmBtn);

    expect(mockUnlinkMutate).toHaveBeenCalledWith({
      propertyId: 'prop-1',
      unlinkType: 'full_account',
    });
  });
});
