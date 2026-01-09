import { memo } from "react";
import { RefreshCw, Briefcase, Plus, CheckCircle, Trash2 } from "lucide-react";

// Safe date formatting
const formatExpDate = (dateString, options = {}) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (options.includeYear) {
    return `${months[month - 1]} ${day}, ${year}`;
  }
  return `${months[month - 1]} ${day}`;
};

/**
 * Positions table for the portfolio modal
 */
export const PositionsTable = memo(({
  positions,
  isLoading,
  calculateCurrentStrategyPrice,
  calculatePLPercent,
  autoCloseEnabled,
  takeProfitPercent,
  stopLossPercent,
  onClosePosition,
  onDeletePosition,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No positions yet</p>
        <p className="text-sm mt-1">
          Click the <Plus className="w-4 h-4 inline" /> button on any strategy to add a paper trade
        </p>
      </div>
    );
  }

  // Sort: open positions first, then by opened date (newest first)
  const sortedPositions = [...positions].sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (a.status !== 'open' && b.status === 'open') return 1;
    return new Date(b.opened_at) - new Date(a.opened_at);
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-zinc-400">
            <th className="text-left py-3 px-2">Symbol</th>
            <th className="text-left py-3 px-2">Strategy</th>
            <th className="text-left py-3 px-2">Opened</th>
            <th className="text-left py-3 px-2">Expiration</th>
            <th className="text-right py-3 px-2">Entry</th>
            <th className="text-right py-3 px-2">Current/Exit</th>
            <th className="text-right py-3 px-2">Qty</th>
            <th className="text-right py-3 px-2">P/L</th>
            <th className="text-right py-3 px-2">P/L %</th>
            <th className="text-center py-3 px-2">Status</th>
            <th className="text-center py-3 px-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPositions.map((pos) => {
            const closePrice = pos.status === 'open' ? calculateCurrentStrategyPrice(pos) : null;
            const isDebitStrategy = pos.entry_price < 0;
            
            // Calculate P/L %
            let plPercent = null;
            if (pos.status === 'open') {
              plPercent = calculatePLPercent(pos, closePrice);
            } else if ((pos.status === 'closed' || pos.status === 'expired') && pos.realized_pnl !== null) {
              const entryValue = Math.abs(pos.entry_price) * pos.quantity * 100;
              if (entryValue !== 0) {
                plPercent = (pos.realized_pnl / entryValue) * 100;
              }
            }
            
            // Calculate unrealized P/L
            let unrealizedPnL = null;
            if (closePrice !== null) {
              if (isDebitStrategy) {
                unrealizedPnL = (-closePrice + pos.entry_price) * pos.quantity * 100;
              } else {
                unrealizedPnL = (pos.entry_price - closePrice) * pos.quantity * 100;
              }
            }
            
            return (
              <tr key={pos.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-3 px-2 font-mono text-white">{pos.symbol}</td>
                <td className="py-3 px-2">
                  <div className="font-medium text-white">{pos.strategy_name}</div>
                  <div className="text-xs text-zinc-500">{pos.strategy_type}</div>
                  {pos.notes && pos.notes.includes('Auto-closed') && (
                    <div className="text-xs text-amber-400 mt-1">{pos.notes}</div>
                  )}
                </td>
                <td className="py-3 px-2 text-zinc-400">
                  <div className="text-sm">{new Date(pos.opened_at).toLocaleDateString()}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(pos.opened_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </td>
                <td className="py-3 px-2 text-zinc-400">
                  {formatExpDate(pos.expiration, { includeYear: true })}
                </td>
                <td className={`py-3 px-2 text-right font-mono ${isDebitStrategy ? 'text-red-400' : 'text-green-400'}`}>
                  {isDebitStrategy ? `-$${Math.abs(pos.entry_price).toFixed(2)}` : `$${pos.entry_price.toFixed(2)}`}
                </td>
                <td className={`py-3 px-2 text-right font-mono ${
                  pos.status === 'open' 
                    ? (closePrice !== null ? (closePrice > 0 ? 'text-red-400' : 'text-green-400') : 'text-zinc-400')
                    : (pos.exit_price !== null ? (isDebitStrategy ? 'text-green-400' : 'text-red-400') : 'text-zinc-400')
                }`}>
                  {pos.status === 'open' && closePrice !== null 
                    ? (closePrice > 0 ? `-$${closePrice.toFixed(2)}` : `$${Math.abs(closePrice).toFixed(2)}`)
                    : pos.status === 'open' && closePrice === null
                      ? <span className="text-zinc-500 text-xs" title="Loading price data...">...</span>
                      : (pos.status === 'closed' || pos.status === 'expired') && pos.exit_price !== null
                        ? (isDebitStrategy 
                            ? `$${Math.abs(pos.exit_price).toFixed(2)}`
                            : `-$${Math.abs(pos.exit_price).toFixed(2)}`)
                        : '-'
                  }
                </td>
                <td className="py-3 px-2 text-right text-white">{pos.quantity}</td>
                <td className={`py-3 px-2 text-right font-mono ${
                  (pos.status === 'closed' || pos.status === 'expired')
                    ? (pos.realized_pnl >= 0 ? 'text-green-400' : 'text-red-400')
                    : unrealizedPnL !== null
                      ? (unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400')
                      : 'text-zinc-400'
                }`}>
                  {(pos.status === 'closed' || pos.status === 'expired')
                    ? `$${pos.realized_pnl?.toFixed(2) || '0.00'}`
                    : unrealizedPnL !== null
                      ? `${unrealizedPnL >= 0 ? '+' : ''}$${unrealizedPnL.toFixed(2)}`
                      : '-'
                  }
                </td>
                <td className={`py-3 px-2 text-right font-mono text-xs ${
                  plPercent !== null
                    ? plPercent >= 0 ? 'text-green-400' : 'text-red-400'
                    : 'text-zinc-500'
                }`}>
                  {plPercent !== null ? (
                    <span className={`${
                      pos.status === 'open' && autoCloseEnabled && plPercent >= takeProfitPercent ? 'bg-emerald-500/30 px-1 rounded' :
                      pos.status === 'open' && autoCloseEnabled && plPercent <= -stopLossPercent ? 'bg-red-500/30 px-1 rounded' : ''
                    }`}>
                      {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
                <td className="py-3 px-2 text-center">
                  {pos.status === 'open' ? (
                    <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">Open</span>
                  ) : pos.status === 'expired' ? (
                    <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">Expired</span>
                  ) : (
                    <span className="px-2 py-1 bg-zinc-500/20 text-zinc-400 rounded text-xs">Closed</span>
                  )}
                </td>
                <td className="py-3 px-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {pos.status === 'open' && (
                      <button
                        onClick={() => onClosePosition(pos)}
                        className="text-amber-400 hover:text-amber-300"
                        title="Close Position"
                        data-testid={`close-position-${pos.id}`}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDeletePosition(pos.id)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete Position"
                      data-testid={`delete-position-${pos.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

PositionsTable.displayName = 'PositionsTable';

export default PositionsTable;
