import React from 'react';
import { X, TrendingUp, TrendingDown, Package, Activity, Zap, Target } from 'lucide-react';

interface AISidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  data: any;
}

export const AISidebar: React.FC<AISidebarProps> = ({ isOpen, onClose, isLoading, data }) => {
  const formatCompact = (val: number) => {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    return `${sign}$${abs.toLocaleString()}`;
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[140] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <div className={`fixed top-0 right-0 h-full w-[460px] bg-white shadow-2xl z-[150] transition-transform duration-500 ease-[cubic-bezier(0.4, 0, 0.2, 1)] flex flex-col ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}>
        
        {/* Header */}
        <div className="p-8 flex justify-between items-center bg-white shrink-0 sticky top-0 z-20">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none italic uppercase">Analytics</h2>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Market Intelligence Report</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-90 border border-slate-100"
          >
            <X className="w-6 h-6" strokeWidth={3} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-10 custom-scrollbar">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
                <div className="absolute inset-0 rounded-full border-[3px] border-slate-100 border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Activity className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">Analyzing Market</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Generating Insight Report...</p>
              </div>
            </div>
          ) : data?.payload ? (
            <>
              {/* 1. GROWTH DRIVERS */}
              {(data.payload.drivers?.top_gainers?.length > 0 || data.payload.drivers?.other_clients?.gainers) && (
                <section className="space-y-4">
                  <h3 className="px-4 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Growth Engine
                  </h3>
                  
                  {/* Top Gainers */}
                  {data.payload.drivers.top_gainers?.map((c: any, idx: number) => (
                    <div key={idx} className="bg-[#F3FFEF] p-7 rounded-[32px] border border-black/5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-2xl font-black tracking-tight leading-none text-slate-900 mb-1">{c.client}</h4>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tight text-slate-500">
                            {formatCompact(c.rev_a)} → {formatCompact(c.rev_b)}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-2xl bg-white/60 text-emerald-700 text-[12px] font-black shadow-sm">
                          +{formatCompact(c.delta)}
                        </span>
                      </div>
                      <div className="space-y-3 pt-5 border-t border-black/5">
                        {c.products?.map((p: any, pi: number) => (
                          <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic opacity-50 mt-1' : 'text-slate-600 font-bold'}`}>
                            <span className="truncate max-w-[220px]">{p.name.replace(/\bitems\b/i, 'products')}</span>
                            <span className="font-black text-slate-900">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Other Gainers */}
                  {data.payload.drivers.other_clients?.gainers && (
                    <div className="bg-[#F3FFEF] p-7 rounded-[32px] border border-black/5 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-2xl font-black tracking-tight leading-none text-slate-900 mb-1">
                            {data.payload.drivers.other_clients.gainers.client.replace(/Other/i, '').replace(/Drivers/i, 'clients').trim()}
                          </h4>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tight text-slate-500">
                            {formatCompact(data.payload.drivers.other_clients.gainers.rev_a)} → {formatCompact(data.payload.drivers.other_clients.gainers.rev_b)}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-2xl bg-white/60 text-emerald-700 text-[12px] font-black shadow-sm">
                          +{formatCompact(data.payload.drivers.other_clients.gainers.delta)}
                        </span>
                      </div>
                      <div className="space-y-3 pt-5 border-t border-black/5">
                        {data.payload.drivers.other_clients.gainers.products?.map((p: any, pi: number) => (
                          <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic opacity-50 mt-1' : 'text-slate-600 font-bold'}`}>
                            <span className="truncate max-w-[220px]">{p.name.replace(/\bitems\b/i, 'products')}</span>
                            <span className="font-black text-slate-900">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 2. PERFORMANCE DECLINES */}
              {(data.payload.drivers?.top_decliners?.length > 0 || data.payload.drivers?.other_clients?.decliners) && (
                <section className="space-y-4 pt-4">
                  <h3 className="px-4 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Performance Declines
                  </h3>
                  
                  {/* Top Decliners */}
                  {data.payload.drivers.top_decliners?.map((c: any, idx: number) => (
                    <div key={idx} className="bg-[#FFE5E8] p-7 rounded-[32px] border border-black/5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-2xl font-black tracking-tight leading-none text-slate-900 mb-1">{c.client}</h4>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tight text-slate-500">
                            {formatCompact(c.rev_a)} → {formatCompact(c.rev_b)}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-2xl bg-white/60 text-rose-700 text-[12px] font-black shadow-sm">
                          {formatCompact(c.delta)}
                        </span>
                      </div>
                      <div className="space-y-3 pt-5 border-t border-black/5">
                        {c.products?.map((p: any, pi: number) => (
                          <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic opacity-50 mt-1' : 'text-slate-600 font-bold'}`}>
                            <span className="truncate max-w-[220px]">{p.name.replace(/\bitems\b/i, 'products')}</span>
                            <span className="font-black text-slate-900">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Other Decliners */}
                  {data.payload.drivers.other_clients?.decliners && (
                    <div className="bg-[#FFE5E8] p-7 rounded-[32px] border border-black/5 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-2xl font-black tracking-tight leading-none text-slate-900 mb-1">
                            {data.payload.drivers.other_clients.decliners.client.replace(/Other/i, '').replace(/Drivers/i, 'clients').trim()}
                          </h4>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tight text-slate-500">
                            {formatCompact(data.payload.drivers.other_clients.decliners.rev_a)} → {formatCompact(data.payload.drivers.other_clients.decliners.rev_b)}
                          </p>
                        </div>
                        <span className="px-3 py-1.5 rounded-2xl bg-white/60 text-rose-700 text-[12px] font-black shadow-sm">
                          {formatCompact(data.payload.drivers.other_clients.decliners.delta)}
                        </span>
                      </div>
                      <div className="space-y-3 pt-5 border-t border-black/5">
                        {data.payload.drivers.other_clients.decliners.products?.map((p: any, pi: number) => (
                          <div key={pi} className={`flex justify-between items-center text-[11px] ${p.is_summary ? 'italic opacity-50 mt-1' : 'text-slate-600 font-bold'}`}>
                            <span className="truncate max-w-[220px]">{p.name.replace(/\bitems\b/i, 'products')}</span>
                            <span className="font-black text-slate-900">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* 3. NEW BUSINESS */}
              {data.payload.new_business?.new_clients?.length > 0 && (
                <section className="space-y-4 pt-4">
                  <h3 className="px-4 text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-blue-500" /> New Horizons
                  </h3>
                  <div className="bg-[#E5F6FF] p-7 rounded-[32px] border border-black/5 shadow-sm">
                    <div className="space-y-4">
                      {data.payload.new_business.new_clients.slice(0, 5).map((nc: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-900 tracking-tight">{nc.name}</span>
                          <span className="px-2 py-1 rounded-lg bg-white/60 text-blue-700 text-[11px] font-black">+{formatCompact(nc.rev_b)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Global Performance Footer */}
              <div className="pt-8 border-t border-slate-100 bg-slate-50/50 -mx-6 px-6 pb-6 mt-4">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Snapshot</span>
                  <Activity className="w-4 h-4 text-slate-300" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Baseline</p>
                      <p className="text-xl font-black text-slate-900 leading-none tracking-tighter">{formatCompact(data.payload.global_metrics.rev_a)}</p>
                   </div>
                   <div className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">Target</p>
                      <p className="text-xl font-black text-slate-900 leading-none tracking-tighter">{formatCompact(data.payload.global_metrics.rev_b)}</p>
                   </div>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 font-black uppercase text-xs tracking-widest">
               No report data
            </div>
          )}
        </div>

        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #e2e8f0;
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #cbd5e1;
          }
        `}</style>
      </div>
    </>
  );
};
