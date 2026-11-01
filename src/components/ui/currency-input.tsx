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

export function formatDisplayValue(value: number | undefined | null, allowDecimals?: boolean): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  if (!allowDecimals) {
    const digits = String(Math.round(value));
    return formatWithDots(digits);
  }
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  const parts = String(rounded).split(".");
  const intFormatted = parts[0] ? Number(parts[0]).toLocaleString("es-CO") : "0";
  if (parts.length > 1) {
    return `${intFormatted},${parts[1]}`;
  }
  return intFormatted;
}

function parseValueFromDisplay(displayStr: string, allowDecimals?: boolean): number {
  if (!displayStr) return 0;
  if (!allowDecimals) {
    return parseDigits(displayStr);
  }
  // In allowDecimals mode, allow comma or dot as decimal separator
  const lastComma = displayStr.lastIndexOf(",");
  const lastDot = displayStr.lastIndexOf(".");
  const decSepIndex = Math.max(lastComma, lastDot);

  if (decSepIndex !== -1) {
    const rawInt = displayStr.slice(0, decSepIndex).replace(/\D/g, "") || "0";
    const rawDec = displayStr.slice(decSepIndex + 1).replace(/\D/g, "").slice(0, 2);
    const num = parseFloat(`${rawInt}.${rawDec}`);
    return isNaN(num) ? 0 : Math.round((num + Number.EPSILON) * 100) / 100;
  }

  const digits = displayStr.replace(/\D/g, "");
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
  allowDecimals?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ id, value, onChange, onBlur, name, className, placeholder, disabled, readOnly, rightLabel, allowDecimals = false }, ref) => {
    const [display, setDisplay] = useState(() =>
      value !== undefined && value !== null ? formatDisplayValue(value, allowDecimals) : ""
    );

    // Sync external value changes (e.g. form reset / edit mode)
    useEffect(() => {
      if (value !== undefined && value !== null) {
        const formatted = formatDisplayValue(value, allowDecimals);
        setDisplay((prev) => {
          // Only update if the numeric value actually changed
          const prevNum = parseValueFromDisplay(prev, allowDecimals);
          return prevNum !== value ? formatted : prev;
        });
      } else {
        setDisplay("");
      }
    }, [value, allowDecimals]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;

      if (!allowDecimals) {
        const formatted = formatWithDots(raw);
        setDisplay(formatted);
        const numeric = parseDigits(raw);
        onChange?.(numeric);
        return;
      }

      // Allow decimals mode: allow digits and one decimal separator (, or .)
      const lastComma = raw.lastIndexOf(",");
      const lastDot = raw.lastIndexOf(".");
      const hasDecimal = lastComma !== -1 || lastDot !== -1;
      const decIndex = Math.max(lastComma, lastDot);

      let formatted = "";
      if (hasDecimal) {
        const intPart = raw.slice(0, decIndex).replace(/\D/g, "");
        const decPart = raw.slice(decIndex + 1).replace(/\D/g, "").slice(0, 2);
        const formattedInt = intPart ? Number(intPart).toLocaleString("es-CO") : "0";
        formatted = `${formattedInt},${decPart}`;
      } else {
        formatted = formatWithDots(raw);
      }

      setDisplay(formatted);
      const numeric = parseValueFromDisplay(formatted, true);
      onChange?.(numeric);
    }

    const inputElement = (
      <input
        ref={ref}
        id={id}
        name={name}
        type="text"
        inputMode={allowDecimals ? "decimal" : "numeric"}
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


