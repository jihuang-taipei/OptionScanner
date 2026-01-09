import { memo } from "react";
import { Briefcase, Download, X } from "lucide-react";
import { exportPortfolio } from "../../utils/exportUtils";
import { AutoClosePanel } from "./AutoClosePanel";
import { PortfolioSummary } from "./PortfolioSummary";
import { PositionsTable } from "./PositionsTable";

/**
 * Portfolio modal component
 */
export const PortfolioModal = memo(({
  showPortfolio,
  setShowPortfolio,
  positions,
  openPositions,
  closedPositions,
  isLoadingPositions,
  totalUnrealizedPnL,
  totalRealizedPnL,
  calculateCurrentStrategyPrice,
  calculatePLPercent,
  onClosePosition,
  onDeletePosition,
  // Auto-close props
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
  if (!showPortfolio) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" 
      onClick={() => setShowPortfolio(false)}
      data-testid="portfolio-modal"
    >
      <div 
        className="glass-card p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium text-white flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-emerald-400" />
            Paper Trading Portfolio
          </h3>
          <div className="flex items-center gap-3">
            {/* Export Buttons */}
            <button
              onClick={() => exportPortfolio(positions, 'all')}
              disabled={!positions.length}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Export All Positions to CSV"
              data-testid="export-all-btn"
            >
              <Download className="w-3 h-3" />
              All
            </button>
            <button
              onClick={() => exportPortfolio(positions, 'open')}
              disabled={!openPositions.length}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Export Open Positions to CSV"
              data-testid="export-open-btn"
            >
              <Download className="w-3 h-3" />
              Open
            </button>
            <button
              onClick={() => exportPortfolio(positions, 'closed')}
              disabled={!closedPositions.length}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Export Closed/Expired Positions to CSV"
              data-testid="export-closed-btn"
            >
              <Download className="w-3 h-3" />
              Closed
            </button>
            <button 
              onClick={() => setShowPortfolio(false)}
              className="text-zinc-400 hover:text-white transition-colors ml-2"
              data-testid="close-portfolio-modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Auto-close settings */}
        <AutoClosePanel
          autoCloseEnabled={autoCloseEnabled}
          setAutoCloseEnabled={setAutoCloseEnabled}
          takeProfitPercent={takeProfitPercent}
          setTakeProfitPercent={setTakeProfitPercent}
          stopLossPercent={stopLossPercent}
          setStopLossPercent={setStopLossPercent}
          closeBeforeExpiryHours={closeBeforeExpiryHours}
          setCloseBeforeExpiryHours={setCloseBeforeExpiryHours}
          autoCloseLog={autoCloseLog}
        />

        {/* Portfolio Summary */}
        <PortfolioSummary
          openCount={openPositions.length}
          closedCount={closedPositions.length}
          totalUnrealizedPnL={totalUnrealizedPnL}
          totalRealizedPnL={totalRealizedPnL}
        />

        {/* Positions Table */}
        <PositionsTable
          positions={positions}
          isLoading={isLoadingPositions}
          calculateCurrentStrategyPrice={calculateCurrentStrategyPrice}
          calculatePLPercent={calculatePLPercent}
          autoCloseEnabled={autoCloseEnabled}
          takeProfitPercent={takeProfitPercent}
          stopLossPercent={stopLossPercent}
          onClosePosition={onClosePosition}
          onDeletePosition={onDeletePosition}
        />
      </div>
    </div>
  );
});

PortfolioModal.displayName = 'PortfolioModal';

export default PortfolioModal;
