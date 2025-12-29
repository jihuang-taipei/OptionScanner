import { memo } from 'react';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';

const CalendarSpreadTable = memo(({ spreads, currentPrice, strikeRange, onSelectStrategy, onTrade, nearExpiration, farExpiration, maxRiskAmount, minRewardAmount }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Calendar Spreads available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  const calculatePositionSize = (netDebit) => {
    const maxLoss = netDebit * 100;
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    return { contracts: Math.max(1, contracts), maxLoss };
  };

  const rangePct = strikeRange / 100;
  const minStrike = currentPrice * (1 - rangePct);
  const maxStrike = currentPrice * (1 + rangePct);
  
  const filteredSpreads = spreads.filter(cs => 
    cs.strike >= minStrike && cs.strike <= maxStrike
  );

  if (filteredSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Calendar Spreads match your filter</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the strike range %</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredSpreads.length} of {spreads.length} calendar spreads
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-center py-3 px-2 font-medium">Type</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Sell (Near)</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Buy (Far)</th>
            <th className="text-right py-3 px-2 font-medium text-amber-400">Net Debit</th>
            <th className="text-right py-3 px-2 font-medium">Near IV</th>
            <th className="text-right py-3 px-2 font-medium">Far IV</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">IV Diff</th>
            <th className="text-right py-3 px-2 font-medium text-purple-400">θ Edge</th>
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpreads.map((cs, idx) => {
            const posSize = calculatePositionSize(cs.net_debit);
            return (
            <tr key={idx} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${Math.abs(cs.distance_from_spot) < 0.5 ? 'bg-blue-500/5' : ''}`}>
              <td className="py-2.5 px-2 font-mono font-medium text-white">
                ${cs.strike.toLocaleString()}
              </td>
              <td className="text-center py-2.5 px-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${cs.option_type === 'call' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {cs.option_type.toUpperCase()}
                </span>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${cs.near_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${cs.far_price.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-amber-400 font-medium">
                ${cs.net_debit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {cs.near_iv.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">
                {cs.far_iv.toFixed(1)}%
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${cs.iv_difference > 0 ? 'text-cyan-400' : 'text-zinc-500'}`}>
                {cs.iv_difference > 0 ? '+' : ''}{cs.iv_difference.toFixed(1)}%
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                {cs.theta_edge ? `$${cs.theta_edge.toFixed(2)}` : '-'}
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(cs.distance_from_spot) < 0.5 ? 'text-green-400' : 'text-zinc-400'}`}>
                {cs.distance_from_spot >= 0 ? '+' : ''}{cs.distance_from_spot.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <div className="font-mono font-medium text-green-400">
                  {posSize.contracts}
                </div>
                <div className="text-xs text-zinc-500">
                  ${posSize.maxLoss.toFixed(0)}
                </div>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'calendar_spread',
                    name: `Calendar ${cs.option_type.toUpperCase()} ${cs.strike}`,
                    strike: cs.strike,
                    net_debit: cs.net_debit,
                    option_type: cs.option_type,
                    near_price: cs.near_price,
                    far_price: cs.far_price
                  })}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                  title="View P/L Chart"
                >
                  <LineChartIcon className="w-4 h-4" />
                </button>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    cs,
                    'calendar_spread',
                    `Calendar ${cs.option_type.toUpperCase()} ${cs.strike}`,
                    [
                      { option_type: cs.option_type, action: 'sell', strike: cs.strike, price: cs.near_price, quantity: 1, expiration: nearExpiration },
                      { option_type: cs.option_type, action: 'buy', strike: cs.strike, price: cs.far_price, quantity: 1, expiration: farExpiration }
                    ],
                    -cs.net_debit
                  )}
                  className="text-green-400 hover:text-green-300 transition-colors"
                  title="Paper Trade"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  );
});

export default CalendarSpreadTable;
