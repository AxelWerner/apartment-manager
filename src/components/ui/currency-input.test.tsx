import { useState } from 'react';
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

  it('renders rightLabel affix when provided', () => {
    render(<CurrencyInput value={60000} rightLabel="Limpieza" placeholder="0" />);

    expect(screen.getByText('Limpieza')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('0');
    expect(input).toHaveClass('pr-28');
    expect(input).toHaveClass('text-left');
  });

  describe('allowDecimals mode', () => {
    it('formats initial value with 2 decimals when present', () => {
      render(<CurrencyInput value={1500000.75} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;
      expect(input.value).toBe('1.500.000,75');
    });

    it('allows typing decimals with comma separator and calls onChange with float', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '1500,5');
      expect(input.value).toBe('1.500,5');
      expect(handleChange).toHaveBeenLastCalledWith(1500.5);

      await user.type(input, '5');
      expect(input.value).toBe('1.500,55');
      expect(handleChange).toHaveBeenLastCalledWith(1500.55);
    });

    it('allows typing decimals with dot separator converting to comma and calls onChange with float', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '250.75');
      expect(input.value).toBe('250,75');
      expect(handleChange).toHaveBeenLastCalledWith(250.75);
    });

    it('correctly types 50000 without turning thousand separator dot into decimal point', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '50000');
      expect(input.value).toBe('50.000');
      expect(handleChange).toHaveBeenLastCalledWith(50000);
    });

    it('correctly types 50000,5 and 50000.50 with thousand dot and decimal comma', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '50000,5');
      expect(input.value).toBe('50.000,5');
      expect(handleChange).toHaveBeenLastCalledWith(50000.5);
    });

    it('correctly handles backspacing from 50.000 to 5.000', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '50000');
      expect(input.value).toBe('50.000');
      expect(handleChange).toHaveBeenLastCalledWith(50000);

      await user.type(input, '{Backspace}');
      expect(input.value).toBe('5.000');
      expect(handleChange).toHaveBeenLastCalledWith(5000);
    });

    it('handles controlled component when typing 22222', async () => {
      const user = userEvent.setup();
      function ControlledWrapper() {
        const [val, setVal] = useState<number>(0);
        return <CurrencyInput value={val} onChange={setVal} allowDecimals placeholder="Monto" />;
      }

      render(<ControlledWrapper />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.clear(input);
      await user.type(input, '22222');
      expect(input.value).toBe('22.222');
    });

    it('types 2222 (shows 2.222) and adding 5th digit 2 shows 22.222 without converting to 2,22', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.type(input, '2222');
      expect(input.value).toBe('2.222');
      expect(handleChange).toHaveBeenLastCalledWith(2222);

      await user.type(input, '2');
      expect(input.value).toBe('22.222');
      expect(handleChange).toHaveBeenLastCalledWith(22222);
    });

    it('handles pasting US format decimal 250.75 and 50000.50 via clipboard', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<CurrencyInput onChange={handleChange} allowDecimals placeholder="Monto" />);
      const input = screen.getByPlaceholderText('Monto') as HTMLInputElement;

      await user.click(input);
      await user.paste('50000.50');
      expect(input.value).toBe('50.000,50');
      expect(handleChange).toHaveBeenLastCalledWith(50000.5);
    });
  });
});

