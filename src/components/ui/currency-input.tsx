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
  disabled?: boolean;
  readOnly?: boolean;
  rightLabel?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ id, value, onChange, onBlur, name, className, placeholder, disabled, readOnly, rightLabel }, ref) => {
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

    const inputElement = (
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        readOnly={readOnly}
        className={`${className || ""} ${rightLabel ? "pr-28 text-left" : ""}`}
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        onBlur={onBlur}
      />
    );

    if (rightLabel) {
      return (
        <div className="relative w-full flex items-center">
          {inputElement}
          <span className="absolute right-3.5 text-xs font-semibold text-slate-400 dark:text-slate-500 pointer-events-none select-none">
            {rightLabel}
          </span>
        </div>
      );
    }

    return inputElement;
  }
);

CurrencyInput.displayName = "CurrencyInput";

