import { memo } from 'react';

const OptionsTable = ({ options, type, currentPrice, strikeRange, onTrade }) => {
  if (!options || options.length === 0) {
    return <p className="text-zinc-500 text-center py-8">No {type} data available</p>;
  }

  if (!currentPrice) {
    return <p className="text-zinc-500 text-center py-8">Loading price data...</p>;
  }

  // Apply strike range filter based on percentage
  const rangePct = strikeRange / 100;
  const minS = currentPrice * (1 - rangePct);
  const maxS = currentPrice * (1 + rangePct);
  const filteredOptions = options.filter(opt => opt.strike >= minS && opt.strike <= maxS);

  // Check if Greeks are available
  const hasGreeks = filteredOptions.some(opt => opt.delta !== null);
  const optionType = type === 'calls' ? 'call' : 'put';

  if (filteredOptions.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500">No options in selected strike range</p>
        <p className="text-zinc-600 text-sm mt-1">Try increasing the ± range</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-zinc-500 mb-2">
        Showing {filteredOptions.length} of {options.length} options (${minS.toFixed(0)} - ${maxS.toFixed(0)})
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2 font-medium">Strike</th>
            <th className="text-right py-3 px-2 font-medium">Last</th>
            <th className="text-right py-3 px-2 font-medium">Bid</th>
            <th className="text-right py-3 px-2 font-medium">Ask</th>
            <th className="text-right py-3 px-2 font-medium">IV%</th>
            {hasGreeks && (
              <>
                <th className="text-right py-3 px-2 font-medium text-blue-400">Δ</th>
                <th className="text-right py-3 px-2 font-medium text-purple-400">Γ</th>
                <th className="text-right py-3 px-2 font-medium text-amber-400">Θ</th>
                <th className="text-right py-3 px-2 font-medium text-emerald-400">V</th>
              </>
            )}
            <th className="text-right py-3 px-2 font-medium">Vol</th>
            <th className="text-right py-3 px-2 font-medium">OI</th>
            <th className="text-center py-3 px-2 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {filteredOptions.map((opt, idx) => (
            <tr 
              key={idx} 
              className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                opt.inTheMoney ? (type === 'calls' ? 'bg-green-500/5' : 'bg-red-500/5') : ''
              }`}
            >
              <td className="py-2.5 px-2 font-mono font-medium text-white">
                ${opt.strike.toFixed(2)}
                {opt.inTheMoney && (
                  <span className={`ml-2 text-xs ${type === 'calls' ? 'text-green-500' : 'text-red-500'}`}>ITM</span>
                )}
              </td>
              <td className="text-right py-2.5 px-2 font-mono text-white">${opt.lastPrice.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${opt.bid.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">${opt.ask.toFixed(2)}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.impliedVolatility.toFixed(1)}%</td>
              {hasGreeks && (
                <>
                  <td className="text-right py-2.5 px-2 font-mono text-blue-400">
                    {opt.delta !== null ? opt.delta.toFixed(3) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-purple-400">
                    {opt.gamma !== null ? opt.gamma.toFixed(4) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-amber-400">
                    {opt.theta !== null ? opt.theta.toFixed(3) : '-'}
                  </td>
                  <td className="text-right py-2.5 px-2 font-mono text-emerald-400">
                    {opt.vega !== null ? opt.vega.toFixed(3) : '-'}
                  </td>
                </>
              )}
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.volume?.toLocaleString() || '-'}</td>
              <td className="text-right py-2.5 px-2 font-mono text-zinc-400">{opt.openInterest?.toLocaleString() || '-'}</td>
              <td className="text-center py-2.5 px-2">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => onTrade && onTrade(
                      opt,
                      `long_${optionType}`,
                      `Buy ${optionType.toUpperCase()} ${opt.strike}`,
                      [{ option_type: optionType, action: 'buy', strike: opt.strike, price: opt.ask, quantity: 1 }],
                      -opt.ask
                    )}
                    className="text-green-400 hover:text-green-300 transition-colors text-xs px-1"
                    title={`Buy ${optionType.toUpperCase()}`}
                  >
                    BUY
                  </button>
                  <span className="text-zinc-600">|</span>
                  <button
                    onClick={() => onTrade && onTrade(
                      opt,
                      `short_${optionType}`,
                      `Sell ${optionType.toUpperCase()} ${opt.strike}`,
                      [{ option_type: optionType, action: 'sell', strike: opt.strike, price: opt.bid, quantity: 1 }],
                      opt.bid
                    )}
                    className="text-red-400 hover:text-red-300 transition-colors text-xs px-1"
                    title={`Sell ${optionType.toUpperCase()}`}
                  >
                    SELL
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredOptions.length === 0 && (
        <p className="text-zinc-500 text-center py-4">No options near current price</p>
      )}
      {hasGreeks && (
        <div className="flex gap-4 mt-3 text-xs text-zinc-500 justify-end">
          <span><span className="text-blue-400">Δ</span> Delta</span>
          <span><span className="text-purple-400">Γ</span> Gamma</span>
          <span><span className="text-amber-400">Θ</span> Theta</span>
          <span><span className="text-emerald-400">V</span> Vega</span>
        </div>
      )}
    </div>
  );
};

export default memo(OptionsTable);
