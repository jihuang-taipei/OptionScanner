import { memo } from "react";
import { TrendingUpDown } from "lucide-react";

/**
 * Auto-close settings panel for take-profit, stop-loss, and expiration-based auto-closing
 */
export const AutoClosePanel = memo(({
  autoCloseEnabled,
  setAutoCloseEnabled,
  takeProfitPercent,
  setTakeProfitPercent,
  stopLossPercent,
  setStopLossPercent,
  closeBeforeExpiryHours,
  setCloseBeforeExpiryHours,
  autoCloseLog,
}) => {
  return (
    <div className="bg-zinc-800/30 rounded-lg p-4 mb-6 border border-zinc-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUpDown className="w-5 h-5 text-amber-400" />
          <span className="text-white font-medium">Auto Take Profit / Stop Loss</span>
        </div>
        <button
          onClick={() => setAutoCloseEnabled(!autoCloseEnabled)}
          className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
            autoCloseEnabled 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
              : 'bg-zinc-700 text-zinc-400 border border-zinc-600'
          }`}
          data-testid="auto-close-toggle"
        >
          {autoCloseEnabled ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Take Profit at % gain</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={takeProfitPercent}
              onChange={(e) => setTakeProfitPercent(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm"
              min="1"
              max="500"
              data-testid="take-profit-input"
            />
            <span className="text-zinc-500 text-sm">%</span>
            <span className="text-emerald-400 text-xs ml-2">Close when profit ≥ {takeProfitPercent}%</span>
          </div>
        </div>
        <div>
          <label className="text-zinc-400 text-xs block mb-1">Stop Loss at % loss</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={stopLossPercent}
              onChange={(e) => setStopLossPercent(Math.max(1, parseInt(e.target.value) || 0))}
              className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm"
              min="1"
              max="500"
              data-testid="stop-loss-input"
            />
            <span className="text-zinc-500 text-sm">%</span>
            <span className="text-red-400 text-xs ml-2">Close when loss ≥ {stopLossPercent}%</span>
          </div>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-zinc-700/30">
        <label className="text-zinc-400 text-xs block mb-1">Close before expiration (hours)</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.5"
            value={closeBeforeExpiryHours}
            onChange={(e) => setCloseBeforeExpiryHours(Math.max(0, parseFloat(e.target.value) || 0))}
            className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-sm"
            min="0"
            max="168"
            data-testid="close-before-expiry-input"
          />
          <span className="text-zinc-500 text-sm">hours</span>
          <span className={`text-xs ml-2 ${closeBeforeExpiryHours > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
            {closeBeforeExpiryHours > 0 
              ? `Close when < ${closeBeforeExpiryHours}h to expiry` 
              : 'Disabled (0 = off)'}
          </span>
        </div>
      </div>
      
      {/* Auto-close log */}
      {autoCloseLog.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-700/50">
          <div className="text-zinc-500 text-xs mb-2">Recent Auto-Closes:</div>
          <div className="max-h-20 overflow-y-auto space-y-1">
            {autoCloseLog.slice(-5).reverse().map((log, idx) => (
              <div key={idx} className={`text-xs ${
                log.reason === 'Take Profit' ? 'text-emerald-400' : 
                log.reason.startsWith('Expiry') ? 'text-amber-400' : 
                'text-red-400'
              }`}>
                {log.timestamp} - {log.name}: {log.reason} {log.plPercent !== 'N/A' ? `at ${log.plPercent}%` : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

AutoClosePanel.displayName = 'AutoClosePanel';

export default AutoClosePanel;
