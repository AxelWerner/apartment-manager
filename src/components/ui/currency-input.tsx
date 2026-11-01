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

function formatDisplayValue(value: number | undefined | null, allowDecimals?: boolean): string {
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
  // In Colombian format, comma ',' is the decimal separator.
  // Dot '.' is strictly the thousand separator.
  const commaIndex = displayStr.indexOf(",");
  if (commaIndex !== -1) {
    const rawInt = displayStr.slice(0, commaIndex).replace(/\D/g, "") || "0";
    const rawDec = displayStr.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
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

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (!allowDecimals) return;

      // If user presses '.' on physical or numpad keyboard, convert it to ','
      if (e.key === ".") {
        e.preventDefault();
        const input = e.currentTarget;
        const currentVal = input.value;

        // If comma already exists, do not add another
        if (currentVal.includes(",")) return;

        const start = input.selectionStart ?? currentVal.length;
        const end = input.selectionEnd ?? currentVal.length;
        const before = currentVal.slice(0, start);
        const after = currentVal.slice(end);

        const intDigits = before.replace(/\D/g, "");
        const formattedInt = intDigits ? Number(intDigits).toLocaleString("es-CO") : "0";
        const decDigits = after.replace(/\D/g, "").slice(0, 2);
        const nextDisplay = `${formattedInt},${decDigits}`;

        setDisplay(nextDisplay);
        const numeric = parseValueFromDisplay(nextDisplay, true);
        onChange?.(numeric);
      }
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
      if (!allowDecimals) return;
      const pasted = e.clipboardData.getData("text")?.trim();
      if (!pasted) return;

      // If pasted a US-formatted decimal like "250.75" or "50000.50" (dot followed by 1-2 digits, no comma)
      if (!pasted.includes(",") && /\.\d{1,2}$/.test(pasted)) {
        e.preventDefault();
        const commaIndex = pasted.lastIndexOf(".");
        const intPart = pasted.slice(0, commaIndex).replace(/\D/g, "");
        const decPart = pasted.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
        const formattedInt = intPart ? Number(intPart).toLocaleString("es-CO") : "0";
        const nextDisplay = `${formattedInt},${decPart}`;

        setDisplay(nextDisplay);
        const numeric = parseValueFromDisplay(nextDisplay, true);
        onChange?.(numeric);
      }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;

      if (!allowDecimals) {
        const formatted = formatWithDots(raw);
        setDisplay(formatted);
        const numeric = parseDigits(raw);
        onChange?.(numeric);
        return;
      }

      // In allowDecimals mode:
      // Comma ',' is the ONLY decimal separator in Colombian format.
      // Dots are strictly thousand grouping separators.
      const commaIndex = raw.indexOf(",");
      let formatted: string;

      if (commaIndex !== -1) {
        const intPart = raw.slice(0, commaIndex).replace(/\D/g, "");
        const decPart = raw.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
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
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
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


