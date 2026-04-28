import React from 'react';
import { Flex, Badge } from '@tremor/react';
import { XCircle, Zap, Target, TrendingUp, TrendingDown, LayoutGrid, UserPlus, Package, Lightbulb } from 'lucide-react';

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
    <div className={`fixed inset-y-0 right-0 z-[1001] w-full md:w-[500px] bg-white border-l border-slate-200 shadow-[-20px_0_60px_rgba(0,0,0,0.05)] transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-full flex flex-col p-12">
        <Flex justifyContent="between" className="mb-12">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-[#0C0C0C] rounded-[1.25rem] shadow-2xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#DDFF55]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#0C0C0C] italic uppercase tracking-tighter leading-none">AI <span className="text-slate-300">Analyst</span></h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Business Intelligence v2.0</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-300 hover:text-rose-500 transition-all">
            <XCircle className="w-10 h-10" />
          </button>
        </Flex>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 border-4 border-slate-100 border-t-[#0C0C0C] rounded-full animate-spin shadow-inner" />
              <div>
                <p className="text-xs font-black text-[#0C0C0C] uppercase tracking-[0.3em] animate-pulse mb-2">Analyzing Performance</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Crunching market data...</p>
              </div>
            </div>
          ) : data ? (
            <>
                <div className="space-y-6">
                  {(() => {
                    return (
                      <>
                        {/* SHELF 1: KEY CLIENTS (SIGNIFICANCE > 15%) */}
                        <div className="p-6 rounded-2xl border bg-white border-slate-100 text-slate-600 shadow-sm transition-all hover:shadow-lg duration-500">
                          <div className="flex items-center gap-4 mb-6 opacity-90">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <UserPlus className="w-4 h-4 text-emerald-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Key Market Drivers (Significance {'>'} 15%)</span>
                          </div>
                          
                          <div className="space-y-8">
                             {/* Gainers */}
                             {data.payload?.drivers?.top_gainers?.length > 0 && (
                                <div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <TrendingUp className="w-3 h-3 text-emerald-500" /> Key Growth Drivers
                                   </p>
                                   <div className="space-y-4">
                                      {data.payload.drivers.top_gainers.map((c: any, idx: number) => (
                                         <div key={idx} className="bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/30">
                                            <div className="flex justify-between items-start mb-3">
                                               <div className="flex flex-col">
                                                  <span className="text-[12px] font-black text-slate-800 uppercase leading-none mb-1">{c.client}</span>
                                                  <span className="text-[9px] font-bold text-slate-400">WAS: {formatCompact(c.rev_a)} → NOW: {formatCompact(c.rev_b)}</span>
                                               </div>
                                               <span className="text-[12px] font-black text-emerald-600">+{formatCompact(c.delta)}</span>
                                            </div>
                                            <div className="space-y-2 border-t border-emerald-100/30 pt-3">
                                               {c.products?.map((p: any, pi: number) => (
                                                  <div key={pi} className="flex justify-between items-center text-[10px]">
                                                     <span className="font-bold text-slate-500 truncate max-w-[200px]">{p.name}</span>
                                                     <span className="font-black text-emerald-600/80 tracking-tighter">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                                                  </div>
                                               ))}
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             )}

                             {/* Decliners */}
                             {data.payload?.drivers?.top_decliners?.length > 0 && (
                                <div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                      <TrendingDown className="w-3 h-3 text-rose-500" /> Key Decline Drivers
                                   </p>
                                   <div className="space-y-4">
                                      {data.payload.drivers.top_decliners.map((c: any, idx: number) => (
                                         <div key={idx} className="bg-rose-50/20 p-5 rounded-2xl border border-rose-100/30">
                                            <div className="flex justify-between items-start mb-3">
                                               <div className="flex flex-col">
                                                  <span className="text-[12px] font-black text-slate-800 uppercase leading-none mb-1">{c.client}</span>
                                                  <span className="text-[9px] font-bold text-slate-400">WAS: {formatCompact(c.rev_a)} → NOW: {formatCompact(c.rev_b)}</span>
                                               </div>
                                               <span className="text-[12px] font-black text-rose-600">{formatCompact(c.delta)}</span>
                                            </div>
                                            <div className="space-y-2 border-t border-rose-100/30 pt-3">
                                               {c.products?.map((p: any, pi: number) => (
                                                  <div key={pi} className="flex justify-between items-center text-[10px]">
                                                     <span className="font-bold text-slate-500 truncate max-w-[200px]">{p.name}</span>
                                                     <span className="font-black text-rose-600/80 tracking-tighter">{formatCompact(p.rev_a)} → {formatCompact(p.rev_b)}</span>
                                                  </div>
                                               ))}
                                            </div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             )}
                          </div>
                        </div>

                        {/* SHELF 2: PRODUCT HEALTH (SIGNIFICANCE > 15%) */}
                        <div className="p-6 rounded-2xl border bg-white border-slate-100 text-slate-600 shadow-sm transition-all hover:shadow-lg duration-500">
                          <div className="flex items-center gap-4 mb-6 opacity-90">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <Package className="w-4 h-4 text-blue-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Global Product Trends</span>
                          </div>
                          
                          <div className="space-y-4">
                             {data.payload?.global_product_health?.top_gainers?.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-blue-50/30 p-4 rounded-2xl border border-blue-100/20">
                                   <div className="flex flex-col">
                                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{p.product}</span>
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">WAS: {formatCompact(p.rev_a)}</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[11px] font-black text-emerald-600 block">{formatCompact(p.rev_b)}</span>
                                      <span className="text-[9px] font-bold text-emerald-600/60">+{((p.delta / (p.rev_a || 1)) * 100).toFixed(1)}%</span>
                                   </div>
                                </div>
                             ))}
                             {data.payload?.global_product_health?.top_decliners?.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                                   <div className="flex flex-col">
                                      <span className="text-[11px] font-bold text-slate-500 truncate max-w-[200px]">{p.product}</span>
                                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">WAS: {formatCompact(p.rev_a)}</span>
                                   </div>
                                   <div className="text-right">
                                      <span className="text-[11px] font-black text-rose-600 block">{formatCompact(p.rev_b)}</span>
                                      <span className="text-[9px] font-bold text-rose-600/60">{((p.delta / (p.rev_a || 1)) * 100).toFixed(1)}%</span>
                                   </div>
                                </div>
                             ))}
                          </div>
                        </div>

                        {/* SHELF 3: NEW BUSINESS (DATA DRIVEN) */}
                        <div className="p-6 rounded-2xl border bg-white border-slate-100 text-slate-600 shadow-sm transition-all hover:shadow-lg duration-500">
                          <div className="flex items-center gap-4 mb-6 opacity-90">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <Target className="w-4 h-4 text-[#FF843B]" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">New Business</span>
                          </div>
                          
                          <div className="space-y-6">
                            {data.payload?.new_business?.new_clients?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">First-Time Clients</p>
                                <div className="space-y-2">
                                  {data.payload.new_business.new_clients.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-emerald-50/50 p-4 rounded-xl border border-emerald-100/30">
                                      <span className="text-[11px] font-black text-slate-700 uppercase">{c.name}</span>
                                      <span className="text-[11px] font-black text-emerald-600 tracking-tighter">
                                        $0 → {formatCompact(c.rev_b)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.payload?.new_business?.new_products_sold?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">New Products Sold</p>
                                <div className="space-y-2">
                                  {data.payload.new_business.new_products_sold.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-blue-50/50 p-4 rounded-xl border border-blue-100/30">
                                      <span className="text-[11px] font-black text-slate-700 truncate max-w-[200px] uppercase">{p.name}</span>
                                      <span className="text-[11px] font-black text-blue-600 tracking-tighter">
                                        $0 → {formatCompact(p.rev_b)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SHELF 4: CHURN & OUT OF STOCK */}
                        <div className="p-6 rounded-2xl border bg-white border-slate-100 text-slate-600 shadow-sm transition-all hover:shadow-lg duration-500">
                          <div className="flex items-center gap-4 mb-6 opacity-90">
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                              <TrendingDown className="w-4 h-4 text-rose-500" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Churn & Out of Stock</span>
                          </div>
                          
                          <div className="space-y-6">
                            {data.payload?.churn?.churned_clients?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Stopped Buying</p>
                                <div className="space-y-2">
                                  {data.payload.churn.churned_clients.map((c: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-rose-50/50 p-4 rounded-xl border border-rose-100/30">
                                      <span className="text-[11px] font-black text-slate-700 uppercase">{c.name}</span>
                                      <span className="text-[11px] font-black text-rose-600 tracking-tighter">
                                        {formatCompact(c.rev_a)} → $0
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {data.payload?.churn?.churned_products?.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Dropped SKU</p>
                                <div className="space-y-2">
                                  {data.payload.churn.churned_products.map((p: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100/50">
                                      <span className="text-[11px] font-black text-slate-500 truncate max-w-[200px] uppercase">{p.name}</span>
                                      <span className="text-[11px] font-black text-rose-400 tracking-tighter">
                                        {formatCompact(p.rev_a)} → $0
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
            </>
          ) : (
            <div className="text-center py-20 text-slate-600 font-bold uppercase text-xs">No analysis data</div>
          )}
        </div>
      </div>
    </div>
  );
};
