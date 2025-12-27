import { ResponsiveContainer, ComposedChart, Area, XAxis, YAxis, ReferenceLine } from 'recharts';
import { calculatePLData } from '../../utils/calculations';

// P/L Chart Tooltip
export const PLTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const pl = payload[0].value;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-lg">
        <p className="text-zinc-400 text-sm">Price: <span className="text-white font-mono">${label}</span></p>
        <p className={`text-sm font-mono font-medium ${pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          P/L: {pl >= 0 ? '+' : ''}${pl.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// P/L Chart Component
export const PLChart = ({ strategy, currentPrice, onClose }) => {
  if (!strategy) return null;
  
  const plData = calculatePLData(strategy, currentPrice);
  const maxProfit = Math.max(...plData.map(d => d.pl));
  const maxLoss = Math.min(...plData.map(d => d.pl));
  
  // Find breakeven points
  const breakevenPoints = [];
  for (let i = 1; i < plData.length; i++) {
    if ((plData[i-1].pl < 0 && plData[i].pl >= 0) || (plData[i-1].pl >= 0 && plData[i].pl < 0)) {
      breakevenPoints.push(plData[i].price);
    }
  }
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Max Profit</p>
          <p className="text-green-400 font-mono font-medium">${maxProfit.toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Max Loss</p>
          <p className="text-red-400 font-mono font-medium">${Math.abs(maxLoss).toLocaleString()}</p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <p className="text-zinc-500 text-xs">Breakeven(s)</p>
          <p className="text-white font-mono text-xs">
            {breakevenPoints.length > 0 ? breakevenPoints.map(b => `$${b}`).join(', ') : 'N/A'}
          </p>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={plData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="plGradientPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="plGradientNegative" x1="0" y1="1" x2="0" y2="0">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="price" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#71717a', fontSize: 11 }}
              tickFormatter={(v) => `$${v}`}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
            <ReferenceLine x={currentPrice} stroke="#fbbf24" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="pl"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#plGradientPositive)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PLChart;
