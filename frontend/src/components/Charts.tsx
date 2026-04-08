import {
  AreaChart,
  Area,
  BarChart as ReBarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Paleta coesa para dark OLED — tons de azul/indigo com um accent quente
const PALETTE = {
  primary:   '#3b82f6', // blue-500
  secondary: '#6366f1', // indigo-500
  tertiary:  '#8b5cf6', // violet-500
  success:   '#22c55e', // green-500
  warning:   '#f59e0b', // amber-500
  muted:     '#64748b', // slate-500
  accent1:   '#06b6d4', // cyan-500
  accent2:   '#ec4899', // pink-500
  accent3:   '#f97316', // orange-500
  accent4:   '#14b8a6', // teal-500
};

const CHART_COLORS = [
  PALETTE.primary,
  PALETTE.secondary,
  PALETTE.accent1,
  PALETTE.tertiary,
  PALETTE.success,
  PALETTE.warning,
  PALETTE.accent4,
  PALETTE.accent2,
  PALETTE.accent3,
  PALETTE.muted,
];

const MONO = "'JetBrains Mono', monospace";
const GRID_COLOR  = 'rgba(148,163,184,0.06)';
const AXIS_COLOR  = 'rgba(148,163,184,0.12)';
const LABEL_COLOR = '#64748b';

const tooltipStyle: React.CSSProperties = {
  background: '#0f172a',
  border: '1px solid rgba(148,163,184,0.12)',
  borderRadius: 8,
  fontFamily: MONO,
  fontSize: 11,
  color: '#e2e8f0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  padding: '8px 12px',
};

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
}

// ── Area Chart (volume/trend) ────────────────────────────────────────────────

interface AreaChartProps extends ChartProps { xKey: string; yKey: string; color?: string; }

export function VolumeLineChart({ data, xKey, yKey, height = 260, color = PALETTE.primary }: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.2}  />
            <stop offset="100%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(59,130,246,0.15)', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={2}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 4, fill: color, stroke: '#0f172a', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Bar Chart (rankings/comparisons) ─────────────────────────────────────────

interface BarChartProps extends ChartProps { xKey: string; yKey: string; color?: string; onBarClick?: (value: string) => void; }

function TruncatedTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const label = String(payload.value);
  const maxLen = 15;
  const display = label.length > maxLen ? label.slice(0, maxLen) + '…' : label;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{label}</title>
      <text x={0} y={0} dy={12} textAnchor="end" fill={LABEL_COLOR} fontSize={9} fontFamily={MONO} transform="rotate(-35)">
        {display}
      </text>
    </g>
  );
}

export function TopBarChart({ data, xKey, yKey, height = 280, color = PALETTE.primary, onBarClick }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 8, left: -8 }}
        barCategoryGap="20%"
        style={onBarClick ? { cursor: 'pointer' } : undefined}
        onClick={onBarClick ? (e: { activePayload?: { payload: Record<string, unknown> }[] }) => {
          const value = e?.activePayload?.[0]?.payload?.[xKey];
          if (value) onBarClick(String(value));
        } : undefined}
      >
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="none" vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={AXIS_COLOR}
          tick={TruncatedTick as never}
          axisLine={false}
          tickLine={false}
          height={60}
          interval={0}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(59,130,246,0.04)' }} />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]} fill={color} fillOpacity={0.85} />
      </ReBarChart>
    </ResponsiveContainer>
  );
}

// ── Donut/Pie Chart (distribution) ───────────────────────────────────────────

interface PieChartProps extends ChartProps { nameKey: string; valueKey: string; }

export function DistributionPieChart({ data, nameKey, valueKey, height = 260 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={86}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.9} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          wrapperStyle={{ fontFamily: MONO, fontSize: 10, color: LABEL_COLOR, paddingTop: 8 }}
          iconType="circle"
          iconSize={7}
          formatter={(value: string) => <span style={{ color: '#94a3b8', fontSize: 10 }}>{value}</span>}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}
