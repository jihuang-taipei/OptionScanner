import { memo } from "react";
import { X } from "lucide-react";

/**
 * Close position dialog
 */
export const ClosePositionDialog = memo(({
  closeDialog,
  setCloseDialog,
  closePrice,
  setClosePrice,
  quote,
  calculateCurrentStrategyPrice,
  onClosePosition,
}) => {
  if (!closeDialog.open || !closeDialog.position) return null;

  const position = closeDialog.position;
  const currentStrategyPrice = calculateCurrentStrategyPrice(position);

  const handleClose = () => {
    onClosePosition(position.id, parseFloat(closePrice) || 0);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
      onClick={() => setCloseDialog({ open: false, position: null })}
      data-testid="close-position-dialog"
    >
      <div 
        className="glass-card p-6 w-full max-w-md" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">Close Position</h3>
          <button 
            onClick={() => setCloseDialog({ open: false, position: null })} 
            className="text-zinc-400 hover:text-white"
            data-testid="close-dialog-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="text-zinc-400 text-sm mb-1">Position</div>
            <div className="text-white font-medium">{position.strategy_name}</div>
          </div>
          
          <div>
            <div className="text-zinc-400 text-sm mb-1">Entry Price</div>
            <div className="text-green-400 font-mono">${position.entry_price.toFixed(2)}</div>
          </div>

          {currentStrategyPrice !== null ? (
            <div>
              <div className="text-zinc-400 text-sm mb-1">Current Strategy Quote</div>
              <div className="text-cyan-400 font-mono">${Math.abs(currentStrategyPrice).toFixed(2)}</div>
              <p className="text-zinc-500 text-xs mt-1">Based on current option prices</p>
            </div>
          ) : (
            <div>
              <div className="text-zinc-400 text-sm mb-1">Current Price</div>
              <div className="text-white font-mono">${quote?.price?.toFixed(2) || 'N/A'}</div>
              <p className="text-zinc-500 text-xs mt-1">Option chain not loaded for this expiration</p>
            </div>
          )}
          
          <div>
            <label className="text-zinc-400 text-sm mb-1 block">Exit Price (per contract)</label>
            <input
              type="number"
              step="0.01"
              value={closePrice}
              onChange={(e) => setClosePrice(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white px-3 py-2 rounded-lg font-mono"
              placeholder="0.00"
              data-testid="exit-price-input"
            />
            <p className="text-zinc-500 text-xs mt-1">
              For credit spreads: Enter the debit to close (typically less than entry credit if profitable)
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setCloseDialog({ open: false, position: null })}
              className="flex-1 px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
              data-testid="cancel-close-btn"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
              data-testid="confirm-close-btn"
            >
              Close Position
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ClosePositionDialog.displayName = 'ClosePositionDialog';

export default ClosePositionDialog;
