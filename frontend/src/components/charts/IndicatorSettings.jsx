import { memo } from "react";
import { Settings, TrendingUp, Activity, BarChart2 } from "lucide-react";
import { Input } from "../ui/input";

/**
 * Technical Indicators Settings Panel
 * Configurable MA, RSI, and MACD settings
 */
export const IndicatorSettings = memo(({
  showMA,
  setShowMA,
  showRSI,
  setShowRSI,
  showMACD,
  setShowMACD,
  maShortPeriod,
  setMAShortPeriod,
  maLongPeriod,
  setMALongPeriod,
  rsiPeriod,
  setRSIPeriod,
  macdFast,
  setMACDFast,
  macdSlow,
  setMACDSlow,
  macdSignal,
  setMACDSignal,
  latestIndicators,
  rsiSignal,
  macdSignalStatus,
}) => {
  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800 p-3 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-white">Technical Indicators</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Moving Averages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showMA}
                onChange={(e) => setShowMA(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
              />
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="text-zinc-300">Moving Averages</span>
            </label>
          </div>
          
          {showMA && (
            <div className="pl-6 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">Short:</span>
                <Input
                  type="number"
                  min="5"
                  max="100"
                  value={maShortPeriod}
                  onChange={(e) => setMAShortPeriod(Math.max(5, Math.min(100, parseInt(e.target.value) || 20)))}
                  className="w-16 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                />
                <span className="text-xs text-cyan-400">
                  {latestIndicators?.smaShort ? `$${latestIndicators.smaShort.toLocaleString()}` : '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">Long:</span>
                <Input
                  type="number"
                  min="10"
                  max="200"
                  value={maLongPeriod}
                  onChange={(e) => setMALongPeriod(Math.max(10, Math.min(200, parseInt(e.target.value) || 50)))}
                  className="w-16 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                />
                <span className="text-xs text-orange-400">
                  {latestIndicators?.smaLong ? `$${latestIndicators.smaLong.toLocaleString()}` : '-'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* RSI */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showRSI}
                onChange={(e) => setShowRSI(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
              />
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-zinc-300">RSI</span>
            </label>
          </div>
          
          {showRSI && (
            <div className="pl-6 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 w-16">Period:</span>
                <Input
                  type="number"
                  min="5"
                  max="50"
                  value={rsiPeriod}
                  onChange={(e) => setRSIPeriod(Math.max(5, Math.min(50, parseInt(e.target.value) || 14)))}
                  className="w-16 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                />
                <span className={`text-xs ${rsiSignal?.color || 'text-zinc-400'}`}>
                  {latestIndicators?.rsi ? `${latestIndicators.rsi.toFixed(1)} (${rsiSignal?.status})` : '-'}
                </span>
              </div>
              <div className="flex gap-1 text-xs">
                <span className="text-green-400/60">Oversold &lt;30</span>
                <span className="text-zinc-600">|</span>
                <span className="text-red-400/60">Overbought &gt;70</span>
              </div>
            </div>
          )}
        </div>

        {/* MACD */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showMACD}
                onChange={(e) => setShowMACD(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0"
              />
              <BarChart2 className="w-4 h-4 text-amber-400" />
              <span className="text-zinc-300">MACD</span>
            </label>
          </div>
          
          {showMACD && (
            <div className="pl-6 space-y-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="5"
                  max="30"
                  value={macdFast}
                  onChange={(e) => setMACDFast(Math.max(5, Math.min(30, parseInt(e.target.value) || 12)))}
                  className="w-12 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                  title="Fast EMA"
                />
                <span className="text-zinc-600">/</span>
                <Input
                  type="number"
                  min="10"
                  max="50"
                  value={macdSlow}
                  onChange={(e) => setMACDSlow(Math.max(10, Math.min(50, parseInt(e.target.value) || 26)))}
                  className="w-12 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                  title="Slow EMA"
                />
                <span className="text-zinc-600">/</span>
                <Input
                  type="number"
                  min="3"
                  max="20"
                  value={macdSignal}
                  onChange={(e) => setMACDSignal(Math.max(3, Math.min(20, parseInt(e.target.value) || 9)))}
                  className="w-12 h-6 bg-zinc-800 border-zinc-700 text-white text-xs text-center px-1"
                  title="Signal"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${macdSignalStatus?.color || 'text-zinc-400'}`}>
                  {latestIndicators?.macd !== null ? (
                    <>
                      MACD: {latestIndicators.macd?.toFixed(2)} | Signal: {latestIndicators.macdSignal?.toFixed(2)}
                      <span className="ml-1">({macdSignalStatus?.status})</span>
                    </>
                  ) : '-'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

IndicatorSettings.displayName = 'IndicatorSettings';

export default IndicatorSettings;
