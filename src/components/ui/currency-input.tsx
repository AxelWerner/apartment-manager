import { useState, useEffect, forwardRef } from "react";

function formatWithDots(value: string): string {
  // Remove everything except digits
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  // Add dot thousand separators (es-CO style)
  return Number(digits).toLocaleString("es-CO");
}

function parseDigits(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

interface CurrencyInputProps {
  id?: string;
  value?: number;
  onChange?: (value: number) => void;
  onBlur?: () => void;
  name?: string;
  className?: string;
  placeholder?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ id, value, onChange, onBlur, name, className, placeholder }, ref) => {
    const [display, setDisplay] = useState(() =>
      value ? formatWithDots(String(value)) : ""
    );

    // Sync external value changes (e.g. form reset / edit mode)
    useEffect(() => {
      if (value !== undefined && value !== null) {
        const formatted = formatWithDots(String(value));
        setDisplay((prev) => {
          // Only update if the numeric value actually changed
          const prevNum = parseDigits(prev);
          return prevNum !== value ? formatted : prev;
        });
      } else {
        setDisplay("");
      }
    }, [value]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      const formatted = formatWithDots(raw);
      setDisplay(formatted);
      const numeric = parseDigits(raw);
      onChange?.(numeric);
    }

    return (
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        className={className}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onBlur={onBlur}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

