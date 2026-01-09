import jsPDF from 'jspdf';

/**
 * Generate a comprehensive PDF performance report
 */
export const generatePerformanceReport = async ({
  positions,
  winRateStats,
  overallStats,
  pnlByStrategy,
  pnlByHoldingPeriod,
  monthlyPerformance,
  topTrades,
  analyticsPeriod,
  tradingCapital,
  riskMetrics,
}) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  const addNewPageIfNeeded = (height) => {
    if (yPos + height > pageHeight - margin) {
      pdf.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper functions
  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0.00';
    const sign = value >= 0 ? '' : '-';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPercent = (value) => {
    if (value === undefined || value === null) return '0%';
    return `${value.toFixed(1)}%`;
  };

  // =========================================================================
  // PAGE 1: TITLE & SUMMARY
  // =========================================================================

  // Title
  pdf.setFontSize(24);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Options Trading Performance Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Period & Date
  pdf.setFontSize(12);
  pdf.setTextColor(100, 100, 100);
  const periodLabels = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days', 'all': 'All Time' };
  pdf.text(`Period: ${periodLabels[analyticsPeriod] || 'All Time'}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 5;
  pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Divider
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // =========================================================================
  // EXECUTIVE SUMMARY
  // =========================================================================

  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Executive Summary', margin, yPos);
  yPos += 10;

  // Summary stats grid
  pdf.setFontSize(10);
  const statsCol1 = margin;
  const statsCol2 = pageWidth / 2;

  // Left column
  pdf.setTextColor(100, 100, 100);
  pdf.text('Total Trades:', statsCol1, yPos);
  pdf.setTextColor(30, 30, 30);
  pdf.text(String(winRateStats.totalTrades), statsCol1 + 35, yPos);

  pdf.setTextColor(100, 100, 100);
  pdf.text('Win Rate:', statsCol2, yPos);
  pdf.setTextColor(winRateStats.winRate >= 50 ? 0 : 200, winRateStats.winRate >= 50 ? 150 : 50, winRateStats.winRate >= 50 ? 0 : 50);
  pdf.text(`${formatPercent(winRateStats.winRate)} (${winRateStats.wins}W / ${winRateStats.losses}L)`, statsCol2 + 25, yPos);
  yPos += 6;

  pdf.setTextColor(100, 100, 100);
  pdf.text('Total P/L:', statsCol1, yPos);
  pdf.setTextColor(overallStats.totalPnL >= 0 ? 0 : 200, overallStats.totalPnL >= 0 ? 150 : 50, overallStats.totalPnL >= 0 ? 0 : 50);
  pdf.text(formatCurrency(overallStats.totalPnL), statsCol1 + 35, yPos);

  pdf.setTextColor(100, 100, 100);
  pdf.text('Avg P/L:', statsCol2, yPos);
  pdf.setTextColor(overallStats.avgPnL >= 0 ? 0 : 200, overallStats.avgPnL >= 0 ? 150 : 50, overallStats.avgPnL >= 0 ? 0 : 50);
  pdf.text(formatCurrency(overallStats.avgPnL), statsCol2 + 25, yPos);
  yPos += 6;

  pdf.setTextColor(100, 100, 100);
  pdf.text('Profit Factor:', statsCol1, yPos);
  pdf.setTextColor(overallStats.profitFactor >= 1 ? 0 : 200, overallStats.profitFactor >= 1 ? 150 : 50, overallStats.profitFactor >= 1 ? 0 : 50);
  pdf.text(overallStats.profitFactor.toFixed(2), statsCol1 + 35, yPos);

  pdf.setTextColor(100, 100, 100);
  pdf.text('Best Trade:', statsCol2, yPos);
  pdf.setTextColor(0, 150, 0);
  pdf.text(formatCurrency(overallStats.maxWin), statsCol2 + 25, yPos);
  yPos += 6;

  pdf.setTextColor(100, 100, 100);
  pdf.text('Avg Win:', statsCol1, yPos);
  pdf.setTextColor(0, 150, 0);
  pdf.text(formatCurrency(overallStats.avgWin), statsCol1 + 35, yPos);

  pdf.setTextColor(100, 100, 100);
  pdf.text('Worst Trade:', statsCol2, yPos);
  pdf.setTextColor(200, 50, 50);
  pdf.text(formatCurrency(overallStats.maxLoss), statsCol2 + 25, yPos);
  yPos += 6;

  pdf.setTextColor(100, 100, 100);
  pdf.text('Avg Loss:', statsCol1, yPos);
  pdf.setTextColor(200, 50, 50);
  pdf.text(formatCurrency(overallStats.avgLoss), statsCol1 + 35, yPos);

  if (tradingCapital && riskMetrics) {
    pdf.setTextColor(100, 100, 100);
    pdf.text('Return on Capital:', statsCol2, yPos);
    const roc = (overallStats.totalPnL / tradingCapital) * 100;
    pdf.setTextColor(roc >= 0 ? 0 : 200, roc >= 0 ? 150 : 50, roc >= 0 ? 0 : 50);
    pdf.text(`${roc.toFixed(2)}%`, statsCol2 + 40, yPos);
  }
  yPos += 15;

  // =========================================================================
  // P/L BY STRATEGY
  // =========================================================================

  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Performance by Strategy', margin, yPos);
  yPos += 8;

  if (pnlByStrategy.length > 0) {
    // Table header
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Strategy', margin, yPos);
    pdf.text('Trades', margin + 50, yPos);
    pdf.text('Wins', margin + 70, yPos);
    pdf.text('Win Rate', margin + 90, yPos);
    pdf.text('Total P/L', margin + 115, yPos);
    pdf.text('Avg P/L', margin + 145, yPos);
    yPos += 5;

    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    pdf.setTextColor(30, 30, 30);
    pnlByStrategy.forEach(strat => {
      addNewPageIfNeeded(6);
      pdf.text(strat.type.replace(/_/g, ' '), margin, yPos);
      pdf.text(String(strat.trades), margin + 50, yPos);
      pdf.text(String(strat.wins), margin + 70, yPos);
      pdf.text(formatPercent(strat.winRate), margin + 90, yPos);
      
      pdf.setTextColor(strat.totalPnL >= 0 ? 0 : 200, strat.totalPnL >= 0 ? 150 : 50, strat.totalPnL >= 0 ? 0 : 50);
      pdf.text(formatCurrency(strat.totalPnL), margin + 115, yPos);
      pdf.text(formatCurrency(strat.avgPnL), margin + 145, yPos);
      pdf.setTextColor(30, 30, 30);
      yPos += 5;
    });
  } else {
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('No strategy data available', margin, yPos);
  }
  yPos += 10;

  // =========================================================================
  // P/L BY HOLDING PERIOD
  // =========================================================================

  addNewPageIfNeeded(40);
  pdf.setFontSize(14);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Performance by Holding Period', margin, yPos);
  yPos += 8;

  if (pnlByHoldingPeriod.length > 0) {
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Holding Period', margin, yPos);
    pdf.text('Trades', margin + 50, yPos);
    pdf.text('Total P/L', margin + 80, yPos);
    pdf.text('Avg P/L', margin + 115, yPos);
    yPos += 5;

    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    pdf.setTextColor(30, 30, 30);
    pnlByHoldingPeriod.forEach(period => {
      if (period.trades > 0) {
        addNewPageIfNeeded(6);
        pdf.text(period.period, margin, yPos);
        pdf.text(String(period.trades), margin + 50, yPos);
        
        pdf.setTextColor(period.totalPnL >= 0 ? 0 : 200, period.totalPnL >= 0 ? 150 : 50, period.totalPnL >= 0 ? 0 : 50);
        pdf.text(formatCurrency(period.totalPnL), margin + 80, yPos);
        pdf.text(formatCurrency(period.avgPnL), margin + 115, yPos);
        pdf.setTextColor(30, 30, 30);
        yPos += 5;
      }
    });
  }
  yPos += 10;

  // =========================================================================
  // MONTHLY PERFORMANCE
  // =========================================================================

  if (monthlyPerformance.length > 0) {
    addNewPageIfNeeded(40);
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Monthly Performance', margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Month', margin, yPos);
    pdf.text('Trades', margin + 40, yPos);
    pdf.text('Wins', margin + 60, yPos);
    pdf.text('Win Rate', margin + 80, yPos);
    pdf.text('P/L', margin + 110, yPos);
    yPos += 5;

    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    pdf.setTextColor(30, 30, 30);
    monthlyPerformance.forEach(month => {
      addNewPageIfNeeded(6);
      pdf.text(month.month, margin, yPos);
      pdf.text(String(month.trades), margin + 40, yPos);
      pdf.text(String(month.wins), margin + 60, yPos);
      pdf.text(formatPercent(month.winRate), margin + 80, yPos);
      
      pdf.setTextColor(month.pnl >= 0 ? 0 : 200, month.pnl >= 0 ? 150 : 50, month.pnl >= 0 ? 0 : 50);
      pdf.text(formatCurrency(month.pnl), margin + 110, yPos);
      pdf.setTextColor(30, 30, 30);
      yPos += 5;
    });
    yPos += 10;
  }

  // =========================================================================
  // TOP TRADES
  // =========================================================================

  // Best Trades
  if (topTrades.best.length > 0) {
    addNewPageIfNeeded(50);
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Best Trades', margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Strategy', margin, yPos);
    pdf.text('Symbol', margin + 70, yPos);
    pdf.text('Closed', margin + 95, yPos);
    pdf.text('P/L', margin + 140, yPos);
    yPos += 5;

    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    topTrades.best.forEach(trade => {
      addNewPageIfNeeded(6);
      pdf.setTextColor(30, 30, 30);
      pdf.text(trade.strategy_name?.substring(0, 35) || 'N/A', margin, yPos);
      pdf.text(trade.symbol || 'N/A', margin + 70, yPos);
      pdf.text(formatDate(trade.closed_at).split(',')[0], margin + 95, yPos);
      pdf.setTextColor(0, 150, 0);
      pdf.text(formatCurrency(trade.realized_pnl), margin + 140, yPos);
      yPos += 5;
    });
    yPos += 10;
  }

  // Worst Trades
  if (topTrades.worst.length > 0) {
    addNewPageIfNeeded(50);
    pdf.setFontSize(14);
    pdf.setTextColor(30, 30, 30);
    pdf.text('Worst Trades', margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Strategy', margin, yPos);
    pdf.text('Symbol', margin + 70, yPos);
    pdf.text('Closed', margin + 95, yPos);
    pdf.text('P/L', margin + 140, yPos);
    yPos += 5;

    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    topTrades.worst.forEach(trade => {
      addNewPageIfNeeded(6);
      pdf.setTextColor(30, 30, 30);
      pdf.text(trade.strategy_name?.substring(0, 35) || 'N/A', margin, yPos);
      pdf.text(trade.symbol || 'N/A', margin + 70, yPos);
      pdf.text(formatDate(trade.closed_at).split(',')[0], margin + 95, yPos);
      pdf.setTextColor(200, 50, 50);
      pdf.text(formatCurrency(trade.realized_pnl), margin + 140, yPos);
      yPos += 5;
    });
    yPos += 10;
  }

  // =========================================================================
  // FULL TRADE HISTORY
  // =========================================================================

  pdf.addPage();
  yPos = margin;

  pdf.setFontSize(16);
  pdf.setTextColor(30, 30, 30);
  pdf.text('Complete Trade History', margin, yPos);
  yPos += 10;

  const closedPositions = positions.filter(p => p.status === 'closed' || p.status === 'expired');
  
  if (closedPositions.length > 0) {
    // Sort by closed date (newest first)
    const sortedPositions = [...closedPositions].sort((a, b) => 
      new Date(b.closed_at || b.opened_at) - new Date(a.closed_at || a.opened_at)
    );

    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('#', margin, yPos);
    pdf.text('Strategy', margin + 8, yPos);
    pdf.text('Symbol', margin + 55, yPos);
    pdf.text('Opened', margin + 75, yPos);
    pdf.text('Closed', margin + 100, yPos);
    pdf.text('Entry', margin + 125, yPos);
    pdf.text('Exit', margin + 145, yPos);
    pdf.text('P/L', margin + 165, yPos);
    yPos += 4;

    pdf.setDrawColor(220, 220, 220);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 3;

    sortedPositions.forEach((pos, idx) => {
      addNewPageIfNeeded(5);
      
      pdf.setTextColor(100, 100, 100);
      pdf.text(String(idx + 1), margin, yPos);
      
      pdf.setTextColor(30, 30, 30);
      pdf.text(pos.strategy_name?.substring(0, 25) || 'N/A', margin + 8, yPos);
      pdf.text(pos.symbol || 'N/A', margin + 55, yPos);
      pdf.text(formatDate(pos.opened_at).split(',')[0], margin + 75, yPos);
      pdf.text(formatDate(pos.closed_at).split(',')[0], margin + 100, yPos);
      pdf.text(`$${Math.abs(pos.entry_price || 0).toFixed(2)}`, margin + 125, yPos);
      pdf.text(`$${Math.abs(pos.exit_price || 0).toFixed(2)}`, margin + 145, yPos);
      
      const pnl = pos.realized_pnl || 0;
      pdf.setTextColor(pnl >= 0 ? 0 : 200, pnl >= 0 ? 150 : 50, pnl >= 0 ? 0 : 50);
      pdf.text(formatCurrency(pnl), margin + 165, yPos);
      
      yPos += 4;
    });
  } else {
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('No closed trades in this period', margin, yPos);
  }

  // =========================================================================
  // FOOTER ON EACH PAGE
  // =========================================================================

  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    pdf.text('Options Scanner Performance Report', margin, pageHeight - 8);
  }

  // Save the PDF
  const fileName = `performance_report_${analyticsPeriod}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);

  return fileName;
};

export default generatePerformanceReport;
