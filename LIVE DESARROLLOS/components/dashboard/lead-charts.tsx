'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { ACCENT, GRAYS } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Leads por Día — Area chart (llena el 100% del contenedor padre)
// ---------------------------------------------------------------------------
interface LeadsPerDayChartProps {
  data: { label: string; total: number }[];
}

export function LeadsPerDayChart({ data }: LeadsPerDayChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.3} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRAYS[800]} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: GRAYS[400] }}
            axisLine={{ stroke: GRAYS[800] }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fill: GRAYS[400] }}
            axisLine={false}
            tickLine={false}
            width={22}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${GRAYS[800]}`,
              backgroundColor: GRAYS[900],
              fontSize: 12,
            }}
            labelStyle={{ color: GRAYS[100], fontWeight: 600 }}
            itemStyle={{ color: ACCENT }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Leads"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#leadsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vivir vs Invertir — Donut chart compacto
// ---------------------------------------------------------------------------
interface MotivoDonutChartProps {
  data: { name: string; value: number }[];
}

const MOTIVO_COLORS: Record<string, string> = {
  Vivir: ACCENT,
  Invertir: GRAYS[100],
  Otro: GRAYS[600],
};

export function MotivoDonutChart({ data }: MotivoDonutChartProps) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={MOTIVO_COLORS[entry.name] ?? GRAYS[600]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${GRAYS[800]}`,
              backgroundColor: GRAYS[900],
              fontSize: 12,
            }}
            labelStyle={{ color: GRAYS[100] }}
            itemStyle={{ color: GRAYS[100] }}
          />
          <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 10, color: GRAYS[400] }} />
        </PieChart>
      </ResponsiveContainer>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center"
        style={{ bottom: '22%' }}
      >
        <span className="text-lg font-semibold text-zinc-50">{total}</span>
        <span className="text-[10px] text-zinc-500">Leads</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Distribución de Presupuesto — Horizontal bar chart compacto
// ---------------------------------------------------------------------------
interface BudgetBarChartProps {
  data: { label: string; total: number }[];
}

export function BudgetBarChart({ data }: BudgetBarChartProps) {
  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap={10}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRAYS[800]} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: GRAYS[400] }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
            tick={{ fontSize: 10, fill: GRAYS[400] }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${GRAYS[800]}`,
              backgroundColor: GRAYS[900],
              fontSize: 12,
            }}
            labelStyle={{ color: GRAYS[100] }}
            itemStyle={{ color: ACCENT }}
          />
          <Bar dataKey="total" name="Leads" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}