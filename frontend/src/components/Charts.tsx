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
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

interface ChartProps {
  data: Record<string, unknown>[];
  height?: number;
}

interface LineChartProps extends ChartProps {
  xKey: string;
  yKey: string;
  xLabel?: string;
  yLabel?: string;
}

export function VolumeLineChart({
  data,
  xKey,
  yKey,
  height = 280,
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReLineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
        <XAxis
          dataKey={xKey}
          stroke="#556677"
          tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#1e2a3a' }}
        />
        <YAxis
          stroke="#556677"
          tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#1e2a3a' }}
        />
        <Tooltip
          contentStyle={{
            background: '#1e2738',
            border: '1px solid #2a3a4e',
            borderRadius: 8,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke="#00d4ff"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#00d4ff', stroke: '#0a0e14', strokeWidth: 2 }}
        />
      </ReLineChart>
    </ResponsiveContainer>
  );
}

interface BarChartProps extends ChartProps {
  xKey: string;
  yKey: string;
}

export function TopBarChart({ data, xKey, yKey, height = 280 }: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" />
        <XAxis
          dataKey={xKey}
          stroke="#556677"
          tick={{ fill: '#8899aa', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#1e2a3a' }}
          angle={-30}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#556677"
          tick={{ fill: '#8899aa', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#1e2a3a' }}
        />
        <Tooltip
          contentStyle={{
            background: '#1e2738',
            border: '1px solid #2a3a4e',
            borderRadius: 8,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
          }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              opacity={0.85}
            />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}

interface PieChartProps extends ChartProps {
  nameKey: string;
  valueKey: string;
}

export function DistributionPieChart({
  data,
  nameKey,
  valueKey,
  height = 280,
}: PieChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RePieChart>
        <Pie
          data={data}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#1e2738',
            border: '1px solid #2a3a4e',
            borderRadius: 8,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{
            fontFamily: 'JetBrains Mono',
            fontSize: 11,
            color: '#8899aa',
          }}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}
