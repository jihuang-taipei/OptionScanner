import { memo } from "react";
import { DollarSign, X } from "lucide-react";

/**
 * Trade dialog for paper trading
 */
export const TradeDialog = memo(({
  tradeDialog,
  setTradeDialog,
  tradeQuantity,
  setTradeQuantity,
  symbol,
  selectedExpiration,
  onCreatePosition,
}) => {
  if (!tradeDialog.open || !tradeDialog.strategy) return null;

  const { strategyName, entryPrice, strategy, strategyType, legs } = tradeDialog.strategy;

  const handleExecuteTrade = () => {
    onCreatePosition(
      strategy,
      strategyType,
      strategyName,
      legs,
      entryPrice,
      tradeQuantity
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
      onClick={() => setTradeDialog({ open: false, strategy: null })}
      data-testid="trade-dialog"
    >
      <div 
        className="glass-card p-6 w-full max-w-md" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Paper Trade
          </h3>
          <button 
            onClick={() => setTradeDialog({ open: false, strategy: null })} 
            className="text-zinc-400 hover:text-white"
            data-testid="close-trade-dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="text-zinc-400 text-sm mb-1">Strategy</div>
            <div className="text-white font-medium">{strategyName}</div>
          </div>
          
          <div>
            <div className="text-zinc-400 text-sm mb-1">Symbol</div>
            <div className="text-white font-mono">{symbol}</div>
          </div>
          
          <div>
            <div className="text-zinc-400 text-sm mb-1">Expiration</div>
            <div className="text-white">{selectedExpiration}</div>
          </div>
          
          <div>
            <div className="text-zinc-400 text-sm mb-1">Entry Credit/Debit</div>
            <div className="text-green-400 font-mono">${entryPrice.toFixed(2)}</div>
          </div>
          
          <div>
            <label className="text-zinc-400 text-sm mb-1 block">Number of Contracts</label>
            <input
              type="number"
              min="1"
              value={tradeQuantity}
              onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg"
              data-testid="trade-quantity-input"
            />
          </div>
          
          <div className="pt-2">
            <div className="text-zinc-400 text-sm">Total Premium</div>
            <div className="text-xl font-bold text-white">
              ${(entryPrice * tradeQuantity * 100).toFixed(2)}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setTradeDialog({ open: false, strategy: null })}
              className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
              data-testid="cancel-trade-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleExecuteTrade}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500"
              data-testid="execute-trade-btn"
            >
              Execute Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

TradeDialog.displayName = 'TradeDialog';

export default TradeDialog;
