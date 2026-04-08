import {
  LineChart as ReLineChart,
  Line,
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

const CHART_COLORS = [
  '#00d4ff',
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

const MONO = "'JetBrains Mono', monospace";
const GRID_COLOR  = '#1c2a3a';
const AXIS_COLOR  = '#2d3f52';
const LABEL_COLOR = '#475569';
const TOOLTIP_STYLE = {
  background: '#1a2332',
  border: '1px solid #263547',
  borderRadius: 10,
  fontFamily: MONO,
  fontSize: 11,
  color: '#f1f5f9',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
};

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
}

interface LineChartProps extends ChartProps { xKey: string; yKey: string; }

export function VolumeLineChart({ data, xKey, yKey, height = 270 }: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}    />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={{ stroke: AXIS_COLOR }}
          tickLine={false}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: '#00d4ff22', strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="#00d4ff"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 4, fill: '#00d4ff', stroke: '#020617', strokeWidth: 2 }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

interface BarChartProps extends ChartProps { xKey: string; yKey: string; }

export function TopBarChart({ data, xKey, yKey, height = 270 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
        <XAxis
          dataKey={xKey}
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 9, fontFamily: MONO }}
          axisLine={{ stroke: AXIS_COLOR }}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={54}
        />
        <YAxis
          stroke={AXIS_COLOR}
          tick={{ fill: LABEL_COLOR, fontSize: 10, fontFamily: MONO }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,212,255,0.04)' }} />
        <Bar dataKey={yKey} radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps extends ChartProps { nameKey: string; valueKey: string; }

export function DistributionPieChart({ data, nameKey, valueKey, height = 270 }: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={54}
          outerRadius={88}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={`c-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend
          wrapperStyle={{ fontFamily: MONO, fontSize: 10, color: LABEL_COLOR }}
          iconType="circle"
          iconSize={8}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}
