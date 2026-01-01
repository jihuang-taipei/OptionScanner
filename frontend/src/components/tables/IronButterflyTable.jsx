import { memo } from 'react';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';

const IronButterflyTable = memo(({ butterflies, currentPrice, minCredit, maxRiskReward, centerRange, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!butterflies || butterflies.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Butterflies available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  const calculatePositionSize = (maxLoss, maxProfit) => {
    const contracts = Math.floor(maxRiskAmount / maxLoss);
    const totalReward = maxProfit * contracts;
    const meetsReward = totalReward >= minRewardAmount;
    return { contracts: Math.max(1, contracts), totalReward, meetsReward };
  };

  const rangePct = centerRange / 100;
  const minCenter = currentPrice * (1 - rangePct);
  const maxCenter = currentPrice * (1 + rangePct);
  
  const filteredButterflies = butterflies.filter(ib => 
    ib.net_credit >= minCredit && 
    ib.risk_reward_ratio <= maxRiskReward &&
    ib.center_strike >= minCenter &&
    ib.center_strike <= maxCenter
  );

  if (filteredButterflies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Butterflies match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing center range or adjusting other filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredButterflies.length} of {butterflies.length} Iron Butterflies
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Center (Sell)</th>
            <th className="text-left py-3 px-2 font-medium">Wings (Buy)</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakevens</th>
            <th className="text-right py-3 px-2 font-medium">From Spot</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredButterflies.map((ib, idx) => {
            const posSize = calculatePositionSize(ib.max_loss, ib.max_profit);
            return (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 px-2">
                <div className="font-mono font-medium text-white">
                  ${ib.center_strike.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">
                  C: <span className="text-green-400">+${ib.call_premium}</span>
                  {' '}P: <span className="text-green-400">+${ib.put_premium}</span>
                </div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono text-zinc-400">
                  ${ib.lower_strike.toLocaleString()} / ${ib.upper_strike.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">
                  <span className="text-red-400">-${ib.lower_cost}</span>
                  {' / '}
                  <span className="text-red-400">-${ib.upper_cost}</span>
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">
                ${ib.net_credit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${ib.max_profit.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${ib.max_loss.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${ib.lower_breakeven.toFixed(0)} - ${ib.upper_breakeven.toFixed(0)}
                </div>
              </td>
              <td className={`text-right py-2.5 px-2 font-mono ${Math.abs(ib.distance_from_spot) < 1 ? 'text-green-400' : 'text-zinc-400'}`}>
                {ib.distance_from_spot >= 0 ? '+' : ''}{ib.distance_from_spot.toFixed(1)}%
              </td>
              <td className="text-center py-2.5 px-2">
                <div className={`font-mono font-medium ${posSize.meetsReward ? 'text-green-400' : 'text-zinc-500'}`}>
                  {posSize.contracts}
                </div>
                <div className={`text-xs ${posSize.meetsReward ? 'text-green-500' : 'text-zinc-600'}`}>
                  ${posSize.totalReward.toFixed(0)}
                </div>
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onSelectStrategy({
                    type: 'iron_butterfly',
                    name: `IB ${ib.lower_strike}/${ib.center_strike}/${ib.upper_strike}`,
                    center_strike: ib.center_strike,
                    lower_strike: ib.lower_strike,
                    upper_strike: ib.upper_strike,
                    net_credit: ib.net_credit
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
                    ib,
                    'iron_butterfly',
                    `IB ${ib.lower_strike}/${ib.center_strike}/${ib.upper_strike}`,
                    [
                      { option_type: 'call', action: 'sell', strike: ib.center_strike, price: ib.call_premium, quantity: 1 },
                      { option_type: 'put', action: 'sell', strike: ib.center_strike, price: ib.put_premium, quantity: 1 },
                      { option_type: 'call', action: 'buy', strike: ib.upper_strike, price: ib.upper_cost, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: ib.lower_strike, price: ib.lower_cost, quantity: 1 }
                    ],
                    ib.net_credit
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

export default IronButterflyTable;
