import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CurrencyInput } from './currency-input';

describe('CurrencyInput Component', () => {
  it('renders with formatted value having dot thousand separators', () => {
    render(<CurrencyInput value={1500000} placeholder="Valor COP" />);

    const input = screen.getByPlaceholderText('Valor COP') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // 1500000 in Colombian locale format
    expect(input.value).toBe('1.500.000');
  });

  it('renders empty when value is undefined or 0/empty', () => {
    render(<CurrencyInput placeholder="Monto" />);

    const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('formats input with dots while typing and calls onChange with numeric integer', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<CurrencyInput onChange={handleChange} placeholder="Monto" />);

    const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

    await user.type(input, '250000');

    expect(handleChange).toHaveBeenCalledWith(250000);
    expect(input.value).toBe('250.000');
  });

  it('filters out non-digit characters', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<CurrencyInput onChange={handleChange} placeholder="Monto" />);

    const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

    await user.type(input, 'abc$123xyz');

    expect(input.value).toBe('123');
    expect(handleChange).toHaveBeenCalledWith(123);
  });

  it('updates display value when external value prop changes', () => {
    const { rerender } = render(<CurrencyInput value={100000} placeholder="Monto" />);

    const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;
    expect(input.value).toBe('100.000');

    rerender(<CurrencyInput value={3500000} placeholder="Monto" />);
    expect(input.value).toBe('3.500.000');
  });
});
