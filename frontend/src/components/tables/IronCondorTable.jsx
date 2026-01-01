import { memo } from 'react';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';

const IronCondorTable = memo(({ condors, currentPrice, minCredit, maxRiskReward, minProfitProb, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!condors || condors.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No Iron Condors available</p>;
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

  const filteredCondors = condors.filter(ic => 
    ic.net_credit >= minCredit && 
    ic.risk_reward_ratio <= maxRiskReward &&
    (ic.probability_profit || 0) >= minProfitProb
  );

  if (filteredCondors.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No Iron Condors match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit, P(Profit), or increasing max risk/reward</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredCondors.length} of {condors.length} Iron Condors
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Put Spread</th>
            <th className="text-left py-3 px-2 font-medium">Call Spread</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Profit Zone</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(Profit)</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredCondors.map((ic, idx) => {
            const posSize = calculatePositionSize(ic.max_loss, ic.max_profit);
            return (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 px-2">
                <div className="font-mono text-white">
                  <span className="text-red-400">${ic.put_sell_strike}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400">${ic.put_buy_strike}</span>
                </div>
                <div className="text-xs text-green-400">+${ic.put_credit.toFixed(2)}</div>
              </td>
              <td className="py-2.5 px-2">
                <div className="font-mono text-white">
                  <span className="text-red-400">${ic.call_sell_strike}</span>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400">${ic.call_buy_strike}</span>
                </div>
                <div className="text-xs text-green-400">+${ic.call_credit.toFixed(2)}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">
                ${ic.net_credit.toFixed(2)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">
                ${ic.max_profit.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">
                ${ic.max_loss.toFixed(0)}
              </td>
              <td className="text-right py-2.5 px-2">
                <div className="font-mono text-white text-xs">
                  ${ic.lower_breakeven.toFixed(0)} - ${ic.upper_breakeven.toFixed(0)}
                </div>
                <div className="text-xs text-zinc-500">
                  {ic.profit_zone_pct.toFixed(1)}% width
                </div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                {ic.probability_profit ? `${ic.probability_profit.toFixed(0)}%` : '-'}
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
                    type: 'iron_condor',
                    name: `IC ${ic.put_sell_strike}/${ic.put_buy_strike} - ${ic.call_sell_strike}/${ic.call_buy_strike}`,
                    put_sell_strike: ic.put_sell_strike,
                    put_buy_strike: ic.put_buy_strike,
                    put_credit: ic.put_credit,
                    call_sell_strike: ic.call_sell_strike,
                    call_buy_strike: ic.call_buy_strike,
                    call_credit: ic.call_credit,
                    net_credit: ic.net_credit
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
                    ic,
                    'iron_condor',
                    `IC ${ic.put_sell_strike}/${ic.put_buy_strike} - ${ic.call_sell_strike}/${ic.call_buy_strike}`,
                    [
                      { option_type: 'put', action: 'sell', strike: ic.put_sell_strike, price: ic.put_credit, quantity: 1 },
                      { option_type: 'put', action: 'buy', strike: ic.put_buy_strike, price: 0, quantity: 1 },
                      { option_type: 'call', action: 'sell', strike: ic.call_sell_strike, price: ic.call_credit, quantity: 1 },
                      { option_type: 'call', action: 'buy', strike: ic.call_buy_strike, price: 0, quantity: 1 }
                    ],
                    ic.net_credit
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

export default IronCondorTable;
