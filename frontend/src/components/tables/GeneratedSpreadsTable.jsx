import { memo } from 'react';
import { Plus } from 'lucide-react';

const GeneratedSpreadsTable = memo(({ options, type, currentPrice, strikeRange, spreadWidth, onTrade }) => {
  if (!options || options.length === 0 || !currentPrice) {
    return <p className="text-zinc-500 text-center py-8">No options data available</p>;
  }

  const rangePct = strikeRange / 100;
  const minS = currentPrice * (1 - rangePct);
  const maxS = currentPrice * (1 + rangePct);
  const filteredOptions = options.filter(opt => opt.strike >= minS && opt.strike <= maxS);

  if (filteredOptions.length < 2) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">Need at least 2 options to generate spreads</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the ± range</p>
      </div>
    );
  }

  const spreads = [];
  const sortedOptions = [...filteredOptions].sort((a, b) => a.strike - b.strike);

  if (type === 'puts') {
    const otmPuts = sortedOptions.filter(opt => opt.strike < currentPrice);
    for (let i = 0; i < otmPuts.length; i++) {
      for (let j = 0; j < i; j++) {
        const sellPut = otmPuts[i];
        const buyPut = otmPuts[j];
        const width = sellPut.strike - buyPut.strike;
        
        if (width > 0 && width <= spreadWidth * 2 && sellPut.bid > 0 && buyPut.ask > 0) {
          const netCredit = sellPut.bid - buyPut.ask;
          if (netCredit > 0) {
            const maxProfit = netCredit * 100;
            const maxLoss = (width - netCredit) * 100;
            spreads.push({
              type: 'Bull Put',
              sell_strike: sellPut.strike,
              buy_strike: buyPut.strike,
              sell_premium: sellPut.bid,
              buy_premium: buyPut.ask,
              net_credit: netCredit,
              max_profit: maxProfit,
              max_loss: maxLoss,
              breakeven: sellPut.strike - netCredit,
              risk_reward: maxLoss / maxProfit,
              width: width,
              sell_delta: sellPut.delta,
              buy_delta: buyPut.delta,
              probability_otm: sellPut.delta ? (1 - Math.abs(sellPut.delta)) * 100 : null
            });
          }
        }
      }
    }
  } else {
    const otmCalls = sortedOptions.filter(opt => opt.strike > currentPrice);
    for (let i = 0; i < otmCalls.length; i++) {
      for (let j = i + 1; j < otmCalls.length; j++) {
        const sellCall = otmCalls[i];
        const buyCall = otmCalls[j];
        const width = buyCall.strike - sellCall.strike;
        
        if (width > 0 && width <= spreadWidth * 2 && sellCall.bid > 0 && buyCall.ask > 0) {
          const netCredit = sellCall.bid - buyCall.ask;
          if (netCredit > 0) {
            const maxProfit = netCredit * 100;
            const maxLoss = (width - netCredit) * 100;
            spreads.push({
              type: 'Bear Call',
              sell_strike: sellCall.strike,
              buy_strike: buyCall.strike,
              sell_premium: sellCall.bid,
              buy_premium: buyCall.ask,
              net_credit: netCredit,
              max_profit: maxProfit,
              max_loss: maxLoss,
              breakeven: sellCall.strike + netCredit,
              risk_reward: maxLoss / maxProfit,
              width: width,
              sell_delta: sellCall.delta,
              buy_delta: buyCall.delta,
              probability_otm: sellCall.delta ? (1 - Math.abs(sellCall.delta)) * 100 : null
            });
          }
        }
      }
    }
  }

  spreads.sort((a, b) => {
    if (a.probability_otm && b.probability_otm) {
      return b.probability_otm - a.probability_otm;
    }
    return b.net_credit - a.net_credit;
  });

  const topSpreads = spreads.slice(0, 15);

  if (topSpreads.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No valid {type === 'puts' ? 'Bull Put' : 'Bear Call'} spreads found</p>
        <p className="text-zinc-600 text-sm mt-1">
          {type === 'puts' ? 'Need OTM puts below current price' : 'Need OTM calls above current price'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Generated {topSpreads.length} {type === 'puts' ? 'Bull Put' : 'Bear Call'} spreads from filtered options
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Spread</th>
            <th className="text-right py-3 px-2 font-medium">Width</th>
            <th className="text-right py-3 px-2 font-medium text-green-400">Credit</th>
            <th className="text-right py-3 px-2 font-medium">Max Profit</th>
            <th className="text-right py-3 px-2 font-medium">Max Loss</th>
            <th className="text-right py-3 px-2 font-medium">Breakeven</th>
            <th className="text-right py-3 px-2 font-medium">R/R</th>
            <th className="text-right py-3 px-2 font-medium text-blue-400">P(OTM)</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {topSpreads.map((spread, idx) => (
            <tr key={idx} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <td className="py-2.5 px-2 font-mono">
                <div className="text-red-400 text-xs">Sell ${spread.sell_strike}</div>
                <div className="text-green-400 text-xs">Buy ${spread.buy_strike}</div>
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${spread.width}</td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400 font-medium">${spread.net_credit.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-green-400">${spread.max_profit.toFixed(0)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-red-400">${spread.max_loss.toFixed(0)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-white">${spread.breakeven.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{spread.risk_reward.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-blue-400">
                {spread.probability_otm ? `${spread.probability_otm.toFixed(1)}%` : '-'}
              </td>
              <td className="text-center py-2.5 px-2">
                <button
                  onClick={() => onTrade && onTrade(
                    spread,
                    type === 'puts' ? 'bull_put' : 'bear_call',
                    `${spread.type} ${spread.sell_strike}/${spread.buy_strike}`,
                    [
                      { option_type: type === 'puts' ? 'put' : 'call', action: 'sell', strike: spread.sell_strike, price: spread.sell_premium, quantity: 1 },
                      { option_type: type === 'puts' ? 'put' : 'call', action: 'buy', strike: spread.buy_strike, price: spread.buy_premium, quantity: 1 }
                    ],
                    spread.net_credit
                  )}
                  className="text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 px-2 py-1 rounded transition-colors"
                >
                  <Plus className="w-3 h-3 inline mr-1" />
                  Trade
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default GeneratedSpreadsTable;
