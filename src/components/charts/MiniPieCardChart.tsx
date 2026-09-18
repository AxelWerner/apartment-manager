import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCOP } from '@/lib/formatters';

export interface MiniPieItem {
  name: string;
  value: number;
  color: string;
}

interface MiniPieCardChartProps {
  data: MiniPieItem[];
  isCurrency?: boolean;
  unitLabel?: string;
  emptyText?: string;
  showLegend?: boolean;
  defaultMode?: 'percent' | 'value';
  mode?: 'percent' | 'value';
  onModeChange?: (mode: 'percent' | 'value') => void;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: MiniPieItem & { total: number };
}

export function MiniPieCardChart({
  data,
  isCurrency = true,
  unitLabel,
  emptyText = 'Sin datos',
  showLegend = true,
  defaultMode = 'percent',
  mode: controlledMode,
  onModeChange,
}: MiniPieCardChartProps) {
  const [internalMode, setInternalMode] = useState<'percent' | 'value'>(defaultMode);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const displayMode = controlledMode !== undefined ? controlledMode : internalMode;

  const toggleMode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextMode = displayMode === 'percent' ? 'value' : 'percent';
    if (controlledMode === undefined) {
      setInternalMode(nextMode);
    }
    onModeChange?.(nextMode);
  };

  const validItems = data.filter((item) => Number(item.value) > 0);
  const total = validItems.reduce((sum, item) => sum + Number(item.value), 0);

  const chartData = validItems.map((item) => ({
    ...item,
    value: Number(item.value),
    total,
  }));

  if (total <= 0 || chartData.length === 0) {
    return (
      <div className="h-16 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/80 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span className="text-[11px] text-slate-400 font-medium">{emptyText}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-0.5">
      <div className="flex items-center justify-between gap-2">
        {/* Pie Chart (click to toggle % / Valor) */}
        <div
          className="relative w-16 h-16 shrink-0 flex items-center justify-center cursor-pointer group/pie"
          onClick={toggleMode}
          title={`Clic para alternar entre % y ${isCurrency ? 'Valor ($)' : 'Cantidad'}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={15}
                outerRadius={28}
                paddingAngle={chartData.length > 1 ? 2 : 0}
                onMouseEnter={(_, index) => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                animationDuration={350}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${entry.name}-${index}`}
                    fill={entry.color}
                    stroke="transparent"
                    className="transition-all duration-200"
                    style={{
                      filter: hoveredIndex === index ? 'brightness(1.15) drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none',
                      transform: hoveredIndex === index ? 'scale(1.04)' : 'scale(1)',
                      transformOrigin: 'center center',
                    }}
                  />
                ))}
              </Pie>
              <Tooltip
                cursor={false}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const current = payload[0] as unknown as TooltipPayloadItem;
                    const item = current.payload;
                    const val = current.value;
                    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                    const formattedValue = isCurrency
                      ? formatCOP(val)
                      : `${val} ${unitLabel || ''}`.trim();

                    return (
                      <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white border border-slate-700/80 shadow-2xl rounded-xl px-2.5 py-1.5 text-xs z-50 pointer-events-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-75">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-100">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 mt-1 text-[11px]">
                          <span className="text-slate-300 font-mono font-medium">{formattedValue}</span>
                          <span
                            className="font-bold px-1.5 py-0.5 rounded text-[10px]"
                            style={{
                              backgroundColor: `${item.color}25`,
                              color: item.color,
                            }}
                          >
                            {pct}%
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Mini Legend List + Toggle Control */}
        {showLegend && (
          <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1">
            {/* Toggle header switch */}
            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-800/70 pb-0.5 mb-0.5">
              <span className="truncate">Desglose</span>
              <button
                type="button"
                onClick={toggleMode}
                title={`Modo actual: ${displayMode === 'percent' ? 'Porcentaje' : 'Valor'}. Clic para cambiar.`}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-[10px] font-semibold cursor-pointer shadow-2xs"
              >
                <span className={displayMode === 'percent' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}>
                  %
                </span>
                <span className="text-slate-300 dark:text-slate-600 text-[9px]">|</span>
                <span className={displayMode === 'value' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-400'}>
                  {isCurrency ? '$' : '#'}
                </span>
              </button>
            </div>

            {chartData.slice(0, 3).map((item, idx) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              const isHovered = hoveredIndex === idx;
              const displayVal = displayMode === 'percent'
                ? `${pct}%`
                : isCurrency
                ? formatCOP(item.value)
                : `${item.value} ${unitLabel || ''}`.trim();

              return (
                <div
                  key={item.name}
                  onClick={toggleMode}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`flex items-center justify-between gap-1 text-[11px] px-1.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                    isHovered
                      ? 'bg-slate-100/90 dark:bg-slate-800/90 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                  title={`${item.name}: ${isCurrency ? formatCOP(item.value) : item.value} (${pct}%) — Clic para alternar modo`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-[10px] shrink-0">
                    {displayVal}
                  </span>
                </div>
              );
            })}
            {chartData.length > 3 && (
              <p className="text-[10px] text-slate-400 text-right px-1">
                +{chartData.length - 3} más
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
