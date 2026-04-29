'use client';

import { useDashboardStore } from '@/store/useDashboardStore';
import { Card, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Flex } from '@tremor/react';
import { FilterIcon, UserIcon, Maximize2, Minimize2, Expand, X, ChevronsRight, ChevronsLeft, Download, UserPlus, Layout, LayoutGrid, Package, XCircle, TrendingUp, TrendingDown, Zap, Target, Lightbulb } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Sector, Tooltip as ReTooltip } from 'recharts';
import useSWR from 'swr';
import { useEffect, useState, useMemo, Fragment } from 'react';

// --- Modular Imports ---
import Link from 'next/link';
import { API_BASE, fetcher, getColor, METRIC_DB_MAP } from '@/lib/constants';
import { formatValue, formatTrend } from '@/lib/formatters';
import { KPICard } from '@/components/KPICard';
import { ChartSection } from '@/components/ChartSection';
import { FilterSidebar } from '@/components/FilterSidebar';
import { KPICardSkeleton, ChartSkeleton, DistributionSkeleton, TableSkeleton } from '@/components/Skeletons';
import { AISidebar } from '@/components/AISidebar';

export default function PurchaseDashboard() {
  const { 
    activeMetric, setActiveMetric, 
    legendDimension, setLegendDimension, 
    topN, setTopN, 
    selectedGroup, setSelectedGroup,
    dateFilter, setDateFilter,
    filters, setFilter
  } = useDashboardStore();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTable, setExpandedTable] = useState<'master' | 'detail' | null>(null);
  const [fullscreenTable, setFullscreenTable] = useState<'master' | 'detail' | null>(null);
  const [chartView, setChartView] = useState<'combined' | 'multiples'>('combined');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);

  const source = 'purchase';

  // Initialize date filter with default 6-month window (max - 6 months to max)
  const { data: globalRange } = useSWR(`${API_BASE}/api/filters/date-range?source=${source}`, fetcher);

  // --- URL Building ---
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    params.append('source', source);
    
    Object.entries(filters).forEach(([col, values]) => {
      if (values && values.length > 0) {
        params.append(col, JSON.stringify(values));
      }
    });

    params.append('dateMode', dateFilter.mode);
    if (dateFilter.mode === 'between' && dateFilter.value?.start && dateFilter.value?.end) {
      params.append('startDate', dateFilter.value.start);
      params.append('endDate', dateFilter.value.end);
    } else if (dateFilter.mode === 'relative' && dateFilter.value) {
      params.append('relativeValue', dateFilter.value.toString());
      params.append('relativeUnit', dateFilter.unit || 'day');
    } else if (dateFilter.mode === 'before' && dateFilter.value) {
      params.append('endDate', dateFilter.value);
    } else if (dateFilter.mode === 'after' && dateFilter.value) {
      params.append('startDate', dateFilter.value);
    }

    return params.toString();
  }, [filters, dateFilter]);

  const metricParam = encodeURIComponent(METRIC_DB_MAP[activeMetric] || 'Amount_USD');
  const kpiUrl = `${API_BASE}/api/kpi?${filterParams}`;
  const trendsUrl = (interval: string) => `${API_BASE}/api/trends?metric=${metricParam}&dimension=${legendDimension}&top_n=${topN}&interval=${interval}&${filterParams}`;
  const fullDistUrl = `${API_BASE}/api/distribution?metric=${metricParam}&dimension=${legendDimension}&top_n=100&${filterParams}`;
  const masterUrl = `${API_BASE}/api/master?dimension=${legendDimension}&${filterParams}`;
  const detailUrl = `${API_BASE}/api/detail?dimension=${legendDimension}${selectedGroup ? `&selected_group=${encodeURIComponent(selectedGroup)}` : ''}&top_n=5000&${filterParams}`;

  // --- Smart Comparison Detection ---
  const canCompare = useMemo(() => {
    return dateFilter.mode !== 'all';
  }, [dateFilter.mode]);

  // --- Data Fetching ---
  const swrConfig = { 
    keepPreviousData: true, 
    revalidateOnFocus: false, 
    shouldRetryOnError: true, 
    errorRetryCount: 20, 
    errorRetryInterval: 3000 
  };
  const { data: kpiData, isLoading: kpiLoading, error: kpiError } = useSWR(kpiUrl, fetcher, swrConfig);
  const { data: weeklyRaw, isLoading: weeklyLoading } = useSWR(trendsUrl('week'), fetcher, swrConfig);
  const { data: monthlyRaw, isLoading: monthlyLoading } = useSWR(trendsUrl('month'), fetcher, swrConfig);
  const { data: dailyRaw, isLoading: dailyLoading } = useSWR(trendsUrl('day'), fetcher, swrConfig);
  const { data: fullDistData, isLoading: distLoading } = useSWR(fullDistUrl, fetcher, swrConfig);
  const { data: masterData, isLoading: masterLoading } = useSWR(masterUrl, fetcher, swrConfig);
  const { data: detailData, isLoading: detailLoading } = useSWR(detailUrl, fetcher, swrConfig);

  // Check if server is potentially restarting (connection refused or 5xx)
  const isServerInitializing = kpiError && !kpiData;

  // --- Initializing Overlay ---
  if (isServerInitializing) {
    return (
      <div className="fixed inset-0 z-[1000] bg-[#0C0C0C] flex flex-col items-center justify-center overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#DDFF55]/10 blur-[120px] rounded-full animate-pulse" />
        <div className="relative z-10 flex flex-col items-center text-center px-6">
          <div className="w-24 h-24 mb-10 relative animate-bounce">
             <svg viewBox="0 0 60 60" fill="none" className="w-full h-full drop-shadow-[0_0_15px_rgba(221,255,85,0.4)]">
                <path d="M34.6569 6.37258C31.5327 3.24839 26.4673 3.24839 23.3431 6.37258L6.37258 23.3431C3.24839 26.4673 3.24839 31.5327 6.37258 34.6569L23.3431 51.6274C26.4673 54.7516 31.5327 54.7516 34.6569 51.6274L51.6274 34.6569C54.7516 31.5327 54.7516 26.4673 51.6274 23.3431L34.6569 6.37258ZM29.9685 11.5117L33.3918 23.9838L45.8642 27.9743C46.8117 28.2775 46.7836 29.6277 45.8243 29.8911L33.0787 33.3902L29.9395 46.1884C29.6926 47.1948 28.2663 47.2076 28.0015 46.2058L24.6134 33.3902L11.4162 29.9028C10.4413 29.6451 10.4173 28.2701 11.3827 27.9786L24.6134 23.9838L28.0399 11.5115C28.3091 10.5313 29.6994 10.5314 29.9685 11.5117Z" fill="#DDFF55" stroke="black" strokeWidth="1.5"/>
             </svg>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">
            Purchase Engine <span className="text-[#DDFF55]">Initializing</span>
          </h1>
          <div className="flex items-center gap-3 justify-center mb-8">
             <div className="w-2 h-2 bg-[#DDFF55] rounded-full animate-ping" />
             <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">
                Synchronizing Purchase Datasets
             </p>
          </div>
          <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mb-12">
             <div className="h-full bg-[#DDFF55] w-full animate-[loading_1.5s_infinite_ease-in-out]" style={{
               animation: 'loading 1.5s infinite ease-in-out'
             }} />
          </div>
          <style jsx>{`
            @keyframes loading {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
          <p className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.2em] max-w-[240px] mx-auto leading-relaxed opacity-60">
            Please wait while we load analytics into memory for maximum performance.
          </p>
        </div>
      </div>
    );
  }

  const ratingData = fullDistData;
  const distData = useMemo(() => {
    if (!Array.isArray(fullDistData)) return [];
    const total = fullDistData.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
    const threshold = total * 0.01;
    const topItems = fullDistData.filter((d: any) => d.dimension_value !== 'Other').slice(0, topN);
    const mainItems = topItems.filter((d: any) => d.value >= threshold);
    const smallItems = topItems.filter((d: any) => d.value < threshold);
    const droppedItems = fullDistData.filter((d: any) => d.dimension_value !== 'Other').slice(topN);
    const serverOther = fullDistData.find((d: any) => d.dimension_value === 'Other')?.value || 0;
    const aggregatedOtherValue = serverOther + smallItems.reduce((acc, curr) => acc + curr.value, 0) + droppedItems.reduce((acc, curr) => acc + curr.value, 0);
    return [...mainItems, { dimension_value: 'Other', value: aggregatedOtherValue }].filter(item => item.value > 0);
  }, [fullDistData, topN]);

  const [aiData, setAiData] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiSidebar, setShowAiSidebar] = useState(false);
  
  const handleAIAnalysis = async (currentPoint: any, interval: 'day' | 'week' | 'month') => {
    setIsAiLoading(true);
    setShowAiSidebar(true);
    setAiData(null);
    try {
       const rawDate = currentPoint.date;
       if (!rawDate) throw new Error("Missing date");
       const d = new Date(rawDate);
       const endB = rawDate;
       let startB = endB, startA, endA;
       if (interval === 'day') {
          const prev = new Date(d); prev.setDate(d.getDate() - 1);
          startA = endA = prev.toISOString().split('T')[0];
       } else if (interval === 'week') {
          const sB = new Date(d); sB.setDate(d.getDate() - 6);
          startB = sB.toISOString().split('T')[0];
          const eA = new Date(sB); eA.setDate(sB.getDate() - 1);
          const sA = new Date(eA); sA.setDate(eA.getDate() - 6);
          endA = eA.toISOString().split('T')[0];
          startA = sA.toISOString().split('T')[0];
       } else {
          const sB = new Date(d.getFullYear(), d.getMonth(), 1);
          startB = sB.toISOString().split('T')[0];
          const eA = new Date(d.getFullYear(), d.getMonth(), 0);
          const sA = new Date(eA.getFullYear(), eA.getMonth(), 1);
          endA = eA.toISOString().split('T')[0];
          startA = sA.toISOString().split('T')[0];
       }
       const url = `${API_BASE}/api/ai/analyze?start_a=${startA}&end_a=${endA}&start_b=${startB}&end_b=${endB}&source=${source}`;
       const res = await fetch(url);
       setAiData(await res.json());
    } catch (e) {
       setAiData({ ai_summary: "❌ Analysis error", status: "error" });
    } finally {
       setIsAiLoading(false);
    }
  };

  const weeklyData = useMemo(() => formatTrend(weeklyRaw?.data), [weeklyRaw]);
  const monthlyData = useMemo(() => formatTrend(monthlyRaw?.data), [monthlyRaw]);
  const dailyData = useMemo(() => formatTrend(dailyRaw?.data), [dailyRaw]);
  const allStatuses = useMemo(() => ({ ...(weeklyRaw?.statuses || {}), ...(monthlyRaw?.statuses || {}), ...(dailyRaw?.statuses || {}) }), [weeklyRaw, monthlyRaw, dailyRaw]);
  const sharedCategories = useMemo(() => {
      if (!distData || !Array.isArray(distData)) return [];
      const cats = distData.map((d: any) => d.dimension_value).filter((v: string) => v !== 'Other').slice(0, topN);
      return [...cats, 'Other'];
  }, [distData, topN]);
  const isCurrencyMetric = activeMetric !== 'qty' && activeMetric !== 'margin';

  const CustomTooltip = ({ active, payload, label, interval }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="relative p-10 -m-10 pointer-events-auto group/tooltip">
          <div className="bg-white/95 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-slate-100 min-w-[340px] z-[100] relative">
            <div className="flex justify-between items-center mb-4 border-b border-slate-50 pb-3 gap-8">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
               <button onClick={() => handleAIAnalysis(data, interval)} className="px-3 py-1 bg-[#0C0C0C] hover:bg-[#DDFF55] text-white hover:text-black rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-2 group shadow-sm shrink-0">
                  <div className="w-1.5 h-1.5 bg-[#DDFF55] group-hover:bg-black rounded-full animate-pulse" /> Analyze
               </button>
            </div>
            <div className="space-y-4">
              {payload.filter((p: any) => p.dataKey !== 'total' && p.dataKey !== 'growth').sort((a: any, b: any) => Number(b.value) - Number(a.value)).map((entry: any) => {
                const color = entry.name === 'Other' ? '#0C0C0C' : getColor(sharedCategories.indexOf(entry.name), sharedCategories.length);
                return (
                  <div key={entry.name} className="flex justify-between items-center gap-6">
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tighter truncate">{entry.name}</span>
                    </div>
                    <span className="text-xs font-black text-[#0C0C0C] w-24 text-right">
                      {isCurrencyMetric ? '$' : ''}{entry.value?.toLocaleString()}{entry.name === 'margin' ? '%' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100 mt-5">
              <div className="flex items-center gap-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">TOTAL</p>
                <p className="text-xl font-bold text-[#0C0C0C]">{isCurrencyMetric ? '$' : ''}{data.total?.toLocaleString()}</p>
              </div>
              <div className={`px-3 py-1 rounded-md text-[11px] font-bold ${(data.growth ?? 0) >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {(data.growth ?? 0) >= 0 ? '+' : ''}{(data.growth ?? 0).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleExport = () => {
      const data = fullscreenTable === 'master' ? masterData : detailData;
      if (!data || !Array.isArray(data) || data.length === 0) return;
      const headers = fullscreenTable === 'master' ? ['Group Name', 'Cost', 'Profit', 'Margin (%)', 'Qty'] : ['SKU Name', 'Cost', 'Profit', 'Margin (%)', 'Qty'];
      const rows = data.map((item: any) => [`"${item.name.replace(/"/g, '""')}"`, item.revenue, item.profit, item.margin?.toFixed(2), item.qty]);
      const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `purchase_${fullscreenTable}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const renderGrowthCell = (growthVal: number | null | undefined) => {
      if (growthVal == null) return <TableCell className="text-right text-sm !text-slate-400 py-4">-</TableCell>;
      const isPos = growthVal >= 0;
      return (
          <TableCell className="text-right py-4 w-[80px]">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${isPos ? 'text-emerald-700 bg-emerald-100' : 'text-rose-700 bg-rose-100'}`}>
                  {isPos ? '+' : ''}{growthVal.toFixed(2)}%
              </span>
          </TableCell>
      );
  };

  return (
    <div className="min-h-screen text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900 bg-[#F8FAFC]">
      <AISidebar isOpen={showAiSidebar} onClose={() => setShowAiSidebar(false)} isLoading={isAiLoading} data={aiData} />
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <Flex className="gap-6 w-auto cursor-pointer" justifyContent="start">
          <h1 className="text-2xl font-black text-[#0C0C0C] tracking-tighter uppercase italic">Purchase <span className="text-[#DDFF55]">Dashboard</span></h1>
        </Flex>
        <Flex className="w-auto gap-4" justifyContent="end">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all relative group text-[13px] font-bold">
            <FilterIcon className="w-4 h-4 text-[#FF843B]" /> Filters
          </button>
        </Flex>
      </nav>

      <main className="relative z-10 max-w-[1600px] mx-auto p-10 space-y-12 pb-24">
        <div className="flex justify-end mb-6">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/10">
                {[{ label: 'All', mode: 'all', val: null }, { label: '3M', mode: 'relative', val: 3, unit: 'month' }, { label: '30D', mode: 'relative', val: 30, unit: 'day' }].map((btn) => (
                    <button key={btn.label} onClick={() => setDateFilter({ mode: btn.mode as any, value: btn.val as any, unit: (btn as any).unit })} className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${dateFilter.mode === btn.mode && dateFilter.value === btn.val ? 'bg-[#0C0C0C] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{btn.label}</button>
                ))}
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <KPICard title="Total Spending" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.revenue.value} baseline={kpiData?.revenue.prev} growth={kpiData?.revenue.growth} active={activeMetric === 'revenue'} onClick={() => setActiveMetric('revenue')} isCurrency={true} hasComparison={canCompare} />
            <KPICard title="Net Profit" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.profit.value} baseline={kpiData?.profit.prev} growth={kpiData?.profit.growth} active={activeMetric === 'profit'} onClick={() => setActiveMetric('profit')} isCurrency={true} hasComparison={canCompare} />
            <KPICard title="Margin" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.margin.value} baseline={kpiData?.margin.prev} growth={kpiData?.margin.growth} active={activeMetric === 'margin'} onClick={() => setActiveMetric('margin')} isPercent={true} hasComparison={canCompare} />
            <KPICard title="Quantity" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.qty.value} baseline={kpiData?.qty.prev} growth={kpiData?.qty.growth} active={activeMetric === 'qty'} onClick={() => setActiveMetric('qty')} isCurrency={false} hasComparison={canCompare} />
        </div>

        <Flex className="gap-6 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/20">
            <div className="flex items-center gap-3 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension:</span>
                <select className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer" value={legendDimension} onChange={e => setLegendDimension(e.target.value as any)}>
                    <option value="Category">Category</option>
                    <option value="Product name">Product</option>
                    <option value="counterparty">Vendor</option>
                </select>
            </div>
            <div className="w-px h-5 bg-slate-100" />
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                <button onClick={() => setChartView('combined')} className={`p-1.5 rounded-lg transition-all ${chartView === 'combined' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                <button onClick={() => setChartView('multiples')} className={`p-1.5 rounded-lg transition-all ${chartView === 'multiples' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400'}`}><Layout className="w-4 h-4" /></button>
            </div>
        </Flex>

        <section className="space-y-12">
            <ChartSection title="Weekly Trend" data={weeklyData} categories={sharedCategories} statuses={allStatuses} isCurrency={isCurrencyMetric} view={chartView} legendDimension={legendDimension} activeFilters={filters} customTooltip={<CustomTooltip interval="week" />} />
            <ChartSection title="Monthly Trend" data={monthlyData} categories={sharedCategories} statuses={allStatuses} isCurrency={isCurrencyMetric} view={chartView} legendDimension={legendDimension} activeFilters={filters} customTooltip={<CustomTooltip interval="month" />} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="rounded-3xl p-8 bg-white h-[580px] flex flex-col shadow-xl shadow-slate-200/50">
                <Title className="text-xl font-bold mb-8">Vendor Leaderboard</Title>
                <div className="flex-1 overflow-y-auto space-y-6 pr-4 scrollbar-thin">
                    {ratingData?.filter((d: any) => d.dimension_value !== 'Other').map((d: any, i: number) => (
                        <div key={d.dimension_value} className="space-y-2">
                            <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase">
                                <span>{d.dimension_value}</span>
                                <span>{formatValue(d.value)}</span>
                            </div>
                            <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-1000" style={{ width: `${(d.value / ratingData[0].value) * 100}%`, backgroundColor: getColor(i, 10) }} />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
            <Card className="rounded-3xl p-8 bg-white h-[580px] flex flex-col shadow-xl shadow-slate-200/50">
                <Title className="text-xl font-bold mb-8">Supply Structure</Title>
                <div className="flex-1 flex flex-col items-center justify-center">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={distData} innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" nameKey="dimension_value">
                                {distData.map((item: any, index: number) => <Cell key={index} fill={item.dimension_value === 'Other' ? '#0C0C0C' : getColor(index, distData.length)} />)}
                            </Pie>
                            <ReTooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>

        <Card className="rounded-3xl p-8 bg-white shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <Title className="text-xl font-bold">Deep Dive Analysis</Title>
            </div>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableHeaderCell className="text-[10px] font-bold uppercase tracking-widest">Group Name</TableHeaderCell>
                        <TableHeaderCell className="text-right text-[10px] font-bold uppercase tracking-widest">Spending</TableHeaderCell>
                        <TableHeaderCell className="text-right text-[10px] font-bold uppercase tracking-widest">Growth</TableHeaderCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {masterData?.map((item: any) => (
                        <TableRow key={item.name} className={`cursor-pointer ${selectedGroup === item.name ? 'bg-slate-50' : ''}`} onClick={() => setSelectedGroup(item.name)}>
                            <TableCell className="text-sm font-bold">{item.name}</TableCell>
                            <TableCell className="text-right text-sm">{formatValue(item.revenue)}</TableCell>
                            <TableCell className="text-right">{renderGrowthCell(item.revenue_growth)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
      </main>

      {isSidebarOpen && <FilterSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} source={source} />}
    </div>
  );
}
