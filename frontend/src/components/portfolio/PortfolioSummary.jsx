import { memo } from "react";

/**
 * Portfolio summary statistics cards
 */
export const PortfolioSummary = memo(({
  openCount,
  closedCount,
  totalUnrealizedPnL,
  totalRealizedPnL,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <div className="text-zinc-500 text-sm">Open Positions</div>
        <div className="text-2xl font-bold text-white" data-testid="open-positions-count">
          {openCount}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <div className="text-zinc-500 text-sm">Closed/Expired</div>
        <div className="text-2xl font-bold text-white" data-testid="closed-positions-count">
          {closedCount}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <div className="text-zinc-500 text-sm">Unrealized P/L</div>
        <div 
          className={`text-2xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}
          data-testid="unrealized-pnl"
        >
          {totalUnrealizedPnL >= 0 ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
        </div>
      </div>
      <div className="bg-zinc-800/50 rounded-lg p-4">
        <div className="text-zinc-500 text-sm">Realized P/L</div>
        <div 
          className={`text-2xl font-bold ${totalRealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}
          data-testid="realized-pnl"
        >
          ${totalRealizedPnL.toFixed(2)}
        </div>
      </div>
    </div>
  );
});

PortfolioSummary.displayName = 'PortfolioSummary';

export default PortfolioSummary;
