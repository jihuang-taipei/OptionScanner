import { memo } from 'react';
import { LineChart as LineChartIcon, Plus } from 'lucide-react';

const CreditSpreadTable = memo(({ spreads, type, currentPrice, minCredit, maxRiskReward, minProbOTM, onSelectStrategy, onTrade, maxRiskAmount, minRewardAmount }) => {
  if (!spreads || spreads.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} spreads available</p>;
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

  const filteredSpreads = spreads.filter(spread => 
    spread.net_credit >= minCredit && 
    spread.risk_reward_ratio <= maxRiskReward &&
    (spread.probability_otm || 0) >= minProbOTM
  );

  const isBullPut = type === "Bull Put";

  if (filteredSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No spreads match your filters</p>
        <p className="text-zinc-600 text-sm mt-1">Try lowering min credit or increasing max risk/reward</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredSpreads.length} of {spreads.length} spreads
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strikes</th>
            <th className="text-right py-3 px-2 font-medium">Sell</th>
            <th className="text-right py-3 px-2 font-medium">Buy</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium text-red-400">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakeven</th>
            <th className="text-right py-3 px-2 font-medium text-cyan-400">P(OTM)</th>
            <th className="text-center py-3 px-2 font-medium text-purple-400">Contracts</th>
            <th className="text-center py-3 px-2 font-medium">P/L</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredSpreads.map((spread, idx) => {
            const distanceFromPrice = isBullPut 
              ? ((currentPrice - spread.sell_strike) / currentPrice * 100).toFixed(1)
              : ((spread.sell_strike - currentPrice) / currentPrice * 100).toFixed(1);
            const posSize = calculatePositionSize(spread.max_loss, spread.max_profit);
            
            return (
              <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <td className="py-2.5 px-2">
                  <div className="font-mono font-medium text-white">
                    ${spread.sell_strike} / ${spread.buy_strike}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {distanceFromPrice}% {isBullPut ? 'below' : 'above'} spot
                  </div>
                </td>
                <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.sell_premium.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${spread.buy_premium.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">${spread.net_credit.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-green-400">${spread.max_profit.toFixed(0)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.max_loss.toFixed(0)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-white">${spread.breakeven.toFixed(2)}</td>
                <td className="text-right py-2.5 px-2 font-mono text-cyan-400 font-medium">
                  {spread.probability_otm ? `${spread.probability_otm.toFixed(0)}%` : '-'}
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
                      type: isBullPut ? 'bull_put' : 'bear_call',
                      name: `${type} ${spread.sell_strike}/${spread.buy_strike}`,
                      sell_strike: spread.sell_strike,
                      buy_strike: spread.buy_strike,
                      net_credit: spread.net_credit
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
                      spread,
                      isBullPut ? 'bull_put' : 'bear_call',
                      `${type} ${spread.sell_strike}/${spread.buy_strike}`,
                      [
                        { option_type: 'put', action: 'sell', strike: spread.sell_strike, price: spread.sell_premium, quantity: 1 },
                        { option_type: 'put', action: 'buy', strike: spread.buy_strike, price: spread.buy_premium, quantity: 1 }
                      ],
                      spread.net_credit
                    )}
                    className="text-green-400 hover:text-green-300 transition-colors"
                    title="Paper Trade"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default CreditSpreadTable;
