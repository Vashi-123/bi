'use client';

import { useDashboardStore } from '@/store/useDashboardStore';
import { Card, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Flex, BarChart, Text } from '@tremor/react';
import { FilterIcon, UserIcon, Maximize2, Minimize2, Expand, X, ChevronsRight, ChevronsLeft, Download, UserPlus, Layout, LayoutGrid, Package, XCircle, TrendingUp, TrendingDown, Zap, Target, Lightbulb, Activity, RefreshCcw, ChevronUp, ChevronDown } from 'lucide-react';
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

function formatCurrency(val: number) {
  if (val === 0) return '$0';
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const InventoryTooltip = ({ payload, active }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  const activePayload = payload.find((p: any) => p.value !== undefined && p.value !== null) || payload[0];
  const data = activePayload.payload;
  const colors_palette = ['#8F3F48', '#638994', '#FF843B', '#79783F', '#A68B7A', '#000000'];
  const bar_color = colors_palette[data.index % colors_palette.length];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-2xl min-w-[200px]">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-50 pb-2">
        {data.range} Days Turnover
      </p>
      <div className="space-y-3">
        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Count</Text>
            <Text className="text-[10px] font-black text-[#0C0C0C]">{data.SKUs} SKUs</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full rounded-full opacity-60" style={{ width: `${data['Share count']}%`, backgroundColor: bar_color }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share count']}% share</Text>
        </div>
        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Sales (Qty)</Text>
            <Text className="text-[10px] font-black text-emerald-600">{data.Sales.toLocaleString()}</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${data['Share sales']}%` }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share sales']}% share</Text>
        </div>
        <div>
          <Flex justifyContent="between">
            <Text className="text-[9px] font-bold text-slate-500 uppercase">Stock Value</Text>
            <Text className="text-[10px] font-black text-blue-600">{formatCurrency(data.Stock)}</Text>
          </Flex>
          <div className="h-1 bg-slate-50 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${data['Share stock']}%` }} />
          </div>
          <Text className="text-[9px] font-bold text-slate-400 mt-0.5">{data['Share stock']}% share</Text>
        </div>
      </div>
    </div>
  );
};

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
  const { data: kpiData, isLoading: kpiLoading, error: kpiError, mutate: mutateKpi } = useSWR(kpiUrl, fetcher, swrConfig);
  const { data: weeklyRaw, isLoading: weeklyLoading } = useSWR(trendsUrl('week'), fetcher, swrConfig);
  const { data: monthlyRaw, isLoading: monthlyLoading } = useSWR(trendsUrl('month'), fetcher, swrConfig);
  const { data: dailyRaw, isLoading: dailyLoading } = useSWR(trendsUrl('day'), fetcher, swrConfig);
  const { data: fullDistData, isLoading: distLoading } = useSWR(fullDistUrl, fetcher, swrConfig);
  const { data: masterData, isLoading: masterLoading } = useSWR(masterUrl, fetcher, swrConfig);
  const { data: detailData, isLoading: detailLoading } = useSWR(detailUrl, fetcher, swrConfig);

  // --- Turnover Data Fetching ---
  const { data: turnoverRaw, isLoading: turnoverLoading, mutate: mutateTurnover } = useSWR(
    activeMetric === 'stock' ? `${API_BASE}/api/inventory/turnover?${filterParams}` : null, 
    fetcher
  );

  const [sortCol, setSortCol] = useState<any>('stock_value_usd');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const turnoverData = useMemo(() => {
    if (!turnoverRaw) return [];
    return turnoverRaw.map((item: any) => ({
      ...item,
      target_15d: item.turnover_days >= 15 ? Math.round((item.total_sales / 30) * 15) : null
    }));
  }, [turnoverRaw]);

  const sortedTurnover = useMemo(() => {
    return [...turnoverData].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      if (aVal === null || aVal === undefined) return sortDir === 'asc' ? -1 : 1;
      if (bVal === null || bVal === undefined) return sortDir === 'asc' ? 1 : -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [turnoverData, sortCol, sortDir]);

  const distributionData = useMemo(() => {
    if (!turnoverRaw || turnoverRaw.length === 0) return [];
    const buckets = [
      { label: '0-1', min: 0, max: 1 }, { label: '1-5', min: 1, max: 5 }, { label: '5-15', min: 5, max: 15 },
      { label: '15-30', min: 15, max: 30 }, { label: '30-60', min: 30, max: 60 }, { label: '60+', min: 60, max: Infinity }
    ];
    const totalSKUs = turnoverRaw.length;
    const totalSales = turnoverRaw.reduce((sum: number, item: any) => sum + (item.total_sales || 0), 0) || 1;
    const totalStock = turnoverRaw.reduce((sum: number, item: any) => sum + (item.stock_value_usd || 0), 0) || 1;
    return buckets.map((b, idx) => {
      const filtered = turnoverRaw.filter((i: any) => b.min === 0 ? (i.turnover_days >= 0 && i.turnover_days <= 1) : (i.turnover_days > b.min && i.turnover_days <= b.max));
      const count = filtered.length;
      const sales = filtered.reduce((sum: number, item: any) => sum + (item.total_sales || 0), 0);
      const stockValue = filtered.reduce((sum: number, item: any) => sum + (item.stock_value_usd || 0), 0);
      return { 
        range: b.label, [b.label]: count, 'SKUs': count, 'Sales': sales, 'Stock': stockValue,
        'Share count': parseFloat(((count / totalSKUs) * 100).toFixed(1)),
        'Share sales': parseFloat(((sales / totalSales) * 100).toFixed(1)),
        'Share stock': parseFloat(((stockValue / totalStock) * 100).toFixed(1)),
        'index': idx
      };
    });
  }, [turnoverRaw]);

  // Check if server is potentially restarting (connection refused or 5xx)
  const isServerInitializing = kpiError && !kpiData;

  // --- SKU Search Logic ---
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const { data: skuSearchResults, isLoading: isSearchingSkus } = useSWR(
    skuSearchQuery.length > 1 ? `${API_BASE}/api/catalog-search?q=${skuSearchQuery}` : null,
    fetcher
  );

  const selectedSkus = filters['Item name'] || [];

  const toggleSkuSelection = (skuName: string) => {
    const current = [...selectedSkus];
    const index = current.indexOf(skuName);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(skuName);
    }
    setFilter('Item name', current);
  };

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
        <Flex className="gap-6 w-auto cursor-pointer" justifyContent="start" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
          <svg width="180" height="46" viewBox="0 0 225 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-auto h-10">
            <path d="M89.92 28.1901H78.82V31.8201H85.06C84.46 34.4901 82.45 36.3801 79.27 36.3801C74.95 36.3801 72.64 33.2001 72.64 29.0601C72.64 24.4401 75.28 21.8901 78.76 21.8901C81.64 21.8901 83.62 23.5401 84.28 25.7301H89.65C88.24 21.0501 84.34 17.8101 78.88 17.8101C72.58 17.8101 67.96 22.5801 67.96 28.9401C67.96 35.6001 72.82 40.2501 79.06 40.2501C85.93 40.2501 90.46 35.3301 89.92 28.1901Z" fill="#191B1D"/>
            <path d="M97.6554 20.06C97.6554 18.59 96.5154 17.54 94.8654 17.54C93.2154 17.54 92.0754 18.59 92.0754 20.06C92.0754 21.47 93.2154 22.52 94.8654 22.52C96.5154 22.52 97.6554 21.47 97.6554 20.06ZM96.9654 39.8V23.78H92.8254V39.8H96.9654Z" fill="#191B1D"/>
            <path d="M106.316 39.8002V27.3502H110.516V23.7802H106.316V23.0002C106.316 21.8902 107.096 21.4402 108.236 21.4402C108.776 21.4402 109.376 21.5302 109.826 21.7102V18.4102C109.136 18.1102 108.266 17.9302 107.246 17.9302C103.916 17.9302 102.176 19.7302 102.176 22.9102V23.7802H98.9657V27.3502H102.176V39.8002H106.316Z" fill="#191B1D"/>
            <path d="M122.354 39.38V35.75C121.754 36.08 121.034 36.26 120.254 36.26C118.724 36.26 117.884 35.51 117.884 33.65V27.35H122.474V23.78H117.884V19.04H113.744V23.78H110.534V27.35H113.744V34.61C113.744 38.21 115.844 40.1 119.144 40.1C120.374 40.1 121.334 39.89 122.354 39.38Z" fill="#191B1D"/>
            <path d="M139.717 34.37H135.607C135.127 35.96 133.867 36.86 132.037 36.86C129.907 36.86 128.497 35.27 128.467 32.81H139.777C140.527 27.59 137.167 23.48 132.097 23.48C127.477 23.48 124.147 26.96 124.147 31.73C124.147 36.77 127.387 40.07 132.157 40.07C136.027 40.07 138.817 37.97 139.717 34.37ZM132.007 26.54C133.957 26.54 135.247 27.95 135.337 30.17H128.467C128.647 28.04 130.027 26.54 132.007 26.54Z" fill="#191B1D"/>
            <path d="M146.562 32.0302C146.562 28.4902 148.962 27.6202 152.502 27.9202V23.7202C149.832 23.4502 147.402 24.8302 146.232 26.8702V23.7802H142.422V39.8002H146.562V32.0302Z" fill="#191B1D"/>
            <path d="M169.22 23.7798H165.05L161.36 34.7598L157.37 23.7798H152.87L159.14 39.6198L156.89 45.5898H161.39L169.22 23.7798Z" fill="#191B1D"/>
            <path d="M174.075 37.1298C174.075 35.4498 172.935 34.2798 171.285 34.2798C169.635 34.2798 168.465 35.4498 168.465 37.1298C168.465 38.7798 169.635 39.9498 171.285 39.9498C172.935 39.9498 174.075 38.7798 174.075 37.1298Z" fill="#191B1D"/>
            <path d="M185.86 32.7798C191.11 32.7798 194.38 30.1098 194.38 25.4298C194.38 20.7498 191.11 18.2598 185.86 18.2598H177.88V39.7998H182.44V32.7798H185.86ZM185.83 22.0998C188.38 22.0998 189.85 23.3298 189.85 25.4598C189.85 27.5898 188.38 28.9398 185.83 28.9398H182.44V22.0998H185.83Z" fill="#191B1D"/>
            <path d="M201.435 32.0302C201.435 28.4902 203.835 27.6202 207.375 27.9202V23.7202C204.705 23.4502 202.275 24.8302 201.105 26.8702V23.7802H197.295V39.8002H201.435V32.0302Z" fill="#191B1D"/>
            <path d="M224.753 31.79C224.753 27.11 221.243 23.48 216.623 23.48C211.973 23.48 208.493 27.11 208.493 31.79C208.493 36.44 211.973 40.1 216.623 40.1C221.243 40.1 224.753 36.44 224.753 31.79ZM212.783 31.79C212.783 28.82 214.553 27.2 216.623 27.2C218.693 27.2 220.433 28.82 220.433 31.79C220.433 34.76 218.693 36.41 216.623 36.41C214.523 36.41 212.783 34.76 212.783 31.79Z" fill="#191B1D"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M34.657 6.37244C31.5328 3.24825 26.4674 3.24825 23.3432 6.37244L6.37268 23.343C3.24849 26.4672 3.24849 31.5326 6.37268 34.6568L23.3432 51.6273C26.4674 54.7515 31.5328 54.7515 34.657 51.6273L51.6275 34.6568C54.7517 31.5326 54.7517 26.4672 51.6275 23.343L34.657 6.37244ZM29.9686 11.5116L33.3919 23.9837L45.8643 27.9742C46.8118 28.2774 46.7837 29.6276 45.8244 29.891L33.0788 33.3901L29.9396 46.1883C29.6927 47.1947 28.2664 47.2075 28.0016 46.2057L24.6135 33.3901L11.4163 29.9027C10.4414 29.645 10.4174 28.27 11.3828 27.9785L24.6135 23.9837L28.04 11.5114C28.3092 10.5312 29.6995 10.5313 29.9686 11.5116Z" fill="#DDFF55" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
        </Flex>
        <Flex className="w-auto gap-4" justifyContent="end">
          <Link href="/sales" className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all text-[11px] font-bold uppercase tracking-tight text-slate-600">
            <TrendingUp className="w-4 h-4 text-slate-400" /> Sales
          </Link>
          <button 
            onClick={() => setSidebarOpen(true)} 
            disabled={activeMetric === 'stock'}
            className={`flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all relative group text-[13px] font-bold ${activeMetric === 'stock' ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}
          >
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
            <KPICard title="Quantity" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.qty.value} baseline={kpiData?.qty.prev} growth={kpiData?.qty.growth} active={activeMetric === 'qty'} onClick={() => setActiveMetric('qty')} isCurrency={false} hasComparison={canCompare} />
            <KPICard title="Stock Value" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.stock.value} baseline={kpiData?.stock.prev} growth={kpiData?.stock.growth} active={activeMetric === 'stock'} onClick={() => setActiveMetric('stock')} isCurrency={true} hasComparison={canCompare} />
            <KPICard title="Margin" period={kpiData?.meta.current_period} baselinePeriod={kpiData?.meta.prev_period} value={kpiData?.margin.value} baseline={kpiData?.margin.prev} growth={kpiData?.margin.growth} active={activeMetric === 'margin'} onClick={() => setActiveMetric('margin')} isPercent={true} hasComparison={canCompare} />
        </div>

        <Flex className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/20" justifyContent="end" alignItems="center">
            {activeMetric === 'stock' ? (
              <div className="flex items-center gap-4">
                {/* Minimal Selected Counter */}
                {selectedSkus.length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-100/50">
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                      {selectedSkus.length} SKU Selected
                    </span>
                    <button 
                      onClick={() => setFilter('Item name', [])}
                      className="p-1 hover:bg-blue-100 rounded-md transition-colors"
                      title="Clear All"
                    >
                      <X className="w-3 h-3 text-blue-400" />
                    </button>
                  </div>
                )}

                {/* Search SKU on the RIGHT */}
                <div className="relative w-full max-w-sm group shrink-0">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    <FilterIcon className="w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search SKU..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm font-bold text-[#0C0C0C] placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:bg-white focus:border-blue-100 transition-all shadow-inner"
                    value={skuSearchQuery}
                    onChange={(e) => setSkuSearchQuery(e.target.value)}
                  />
                  {/* Dropdown shows search results OR selected items if query is empty but focused */}
                  {(skuSearchResults?.results || selectedSkus.length > 0) && skuSearchQuery.length > 1 && (
                    <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-[100] max-h-80 overflow-y-auto scrollbar-hide ring-1 ring-black/5">
                      {skuSearchResults?.results?.map((res: any) => {
                        const isSelected = selectedSkus.includes(res.name);
                        return (
                          <div 
                            key={res.sku_id}
                            onClick={() => toggleSkuSelection(res.name)}
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all mb-1 last:mb-0 ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            <span className="text-[11px] font-bold truncate max-w-[85%]">{res.name}</span>
                            {isSelected ? (
                              <XCircle className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 group-hover:border-blue-200" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 ml-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Show Top:</span>
                    <select 
                        className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer"
                        value={topN}
                        onChange={(e) => setTopN(Number(e.target.value))}
                    >
                        {[3, 5, 10, 15, 20].map(n => <option key={n} value={n}>Top {n}</option>)}
                    </select>
                </div>
                
                <div className="w-px h-5 bg-slate-100" />

                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                    <button 
                        onClick={() => setChartView('combined')}
                        className={`p-1.5 rounded-lg transition-all ${chartView === 'combined' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setChartView('multiples')}
                        className={`p-1.5 rounded-lg transition-all ${chartView === 'multiples' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Layout className="w-4 h-4" />
                    </button>
                </div>

                <div className="w-px h-5 bg-slate-100" />

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension:</span>
                        <select 
                            className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer"
                            value={legendDimension}
                            onChange={(e) => setLegendDimension(e.target.value as any)}
                        >
                            <option value="Category">Category</option>
                            <option value="Product name">Product</option>
                            <option value="Item name">SKU</option>
                            <option value="counterparty">Supplier</option>
                        </select>
                    </div>
                </div>
              </>
            )}
        </Flex>

        {activeMetric === 'stock' ? (
          <div className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[650px] flex flex-col overflow-hidden">
                <Flex className="mb-8 shrink-0" justifyContent="between" alignItems="center">
                  <div>
                    <Title className="text-xl font-bold text-[#0C0C0C]">SKU Value Leaderboard</Title>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Top SKUs by Stock Value (USD)</Text>
                  </div>
                  <Badge className="rounded-md font-bold uppercase text-[9px] bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-500/20">Capital</Badge>
                </Flex>
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
                  {turnoverLoading ? (
                    Array.from({length: 6}).map((_, i) => (
                      <div key={i} className="space-y-2 animate-pulse">
                        <div className="flex justify-between h-4 bg-slate-50 rounded w-full" />
                        <div className="h-2 bg-slate-50 rounded-full" />
                      </div>
                    ))
                  ) : turnoverData.slice(0, 50).map((item: any, idx: number) => {
                    const maxValue = turnoverData[0]?.stock_value_usd || 1;
                    const percentage = ((item.stock_value_usd || 0) / maxValue) * 100;
                    const colors = ['#8F3F48', '#638994', '#FF843B', '#79783F', '#A68B7A'];
                    const color = colors[idx % colors.length];
                    return (
                      <div key={item.item_id} className="space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                          <Flex justifyContent="start" alignItems="center" className="gap-2 truncate pr-4">
                            <span className="truncate">{item.item_name}</span>
                          </Flex>
                          <span className="text-[#0C0C0C] font-extrabold shrink-0">{formatCurrency(item.stock_value_usd)}</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${percentage}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[650px] flex flex-col overflow-hidden">
                <Flex className="mb-2 shrink-0" justifyContent="between" alignItems="start">
                  <div>
                    <Title className="text-xl font-bold text-[#0C0C0C]">Inventory Distribution</Title>
                    <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">SKU Count & Share by Turnover Days</Text>
                  </div>
                </Flex>
                <div className="flex-1 min-h-0 w-full mt-4 flex flex-col overflow-hidden">
                  <div className="flex-1 distribution-chart-container relative">
                    <style>{`
                      .distribution-chart-container .recharts-bar:nth-child(1) path { fill: #8F3F48 !important; }
                      .distribution-chart-container .recharts-bar:nth-child(2) path { fill: #638994 !important; }
                      .distribution-chart-container .recharts-bar:nth-child(3) path { fill: #FF843B !important; }
                      .distribution-chart-container .recharts-bar:nth-child(4) path { fill: #79783F !important; }
                      .distribution-chart-container .recharts-bar:nth-child(5) path { fill: #A68B7A !important; }
                      .distribution-chart-container .recharts-bar:nth-child(6) path { fill: #000000 !important; }
                    `}</style>
                    <BarChart
                      className="h-full"
                      data={distributionData}
                      index="range"
                      categories={['0-1', '1-5', '5-15', '15-30', '30-60', '60+']}
                      colors={['rose', 'cyan', 'orange', 'emerald', 'indigo', 'slate']}
                      valueFormatter={(number) => number?.toLocaleString() ?? '0'}
                      showAnimation={true}
                      yAxisWidth={48}
                      showLegend={false}
                      stack={true}
                      customTooltip={InventoryTooltip}
                    />
                  </div>
                </div>
              </Card>
            </div>

            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-0 bg-white flex flex-col h-[700px] overflow-hidden">
              <div className="p-6 pb-2 border-b border-slate-100 shrink-0">
                <Title className="text-xl font-bold text-[#0C0C0C]">Inventory Details</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Full SKU metrics and stock values</Text>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-30 shadow-sm">
                    <tr className="bg-white">
                      {['item_name', 'avg_stock', 'current_stock', 'stock_value_usd', 'total_sales', 'turnover_ratio', 'turnover_days'].map((col) => (
                        <th key={col} className="p-4 sticky top-0 z-30 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white/95 backdrop-blur-sm border-b border-slate-100 cursor-pointer hover:text-[#0C0C0C]" onClick={() => { setSortCol(col); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                          {col.replace(/_/g, ' ')} {sortCol === col && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTurnover.map((item: any) => (
                      <tr key={item.item_id} className="hover:bg-slate-50/50 border-b border-slate-100/50">
                        <td className="p-4 text-xs font-bold">{item.item_name}</td>
                        <td className="p-4 text-right text-xs">{item.avg_stock.toLocaleString()}</td>
                        <td className="p-4 text-right text-xs">{item.current_stock.toLocaleString()}</td>
                        <td className="p-4 text-right text-xs font-black text-blue-600">{formatCurrency(item.stock_value_usd)}</td>
                        <td className="p-4 text-right text-xs">{item.total_sales.toLocaleString()}</td>
                        <td className="p-4 text-right text-xs">{item.turnover_ratio.toFixed(2)}x</td>
                        <td className="p-4 text-right text-xs font-black">{item.turnover_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <>
            <section className="space-y-12">
                <ChartSection title="Weekly Trend" data={weeklyData} categories={sharedCategories} statuses={allStatuses} isCurrency={isCurrencyMetric} view={chartView} legendDimension={legendDimension} activeFilters={filters} customTooltip={<CustomTooltip interval="week" />} />
                <ChartSection title="Monthly Trend" data={monthlyData} categories={sharedCategories} statuses={allStatuses} isCurrency={isCurrencyMetric} view={chartView} legendDimension={legendDimension} activeFilters={filters} customTooltip={<CustomTooltip interval="month" />} />
                <ChartSection title="Daily Trend" data={dailyData} categories={sharedCategories} statuses={allStatuses} isCurrency={isCurrencyMetric} view={chartView} legendDimension={legendDimension} activeFilters={filters} customTooltip={<CustomTooltip interval="day" />} />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-3xl p-8 bg-white h-[580px] flex flex-col shadow-xl shadow-slate-200/50">
                    <Title className="text-xl font-bold mb-8">Supplier Leaderboard</Title>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className={`rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden relative transition-all duration-500 ${expandedTable === 'master' ? 'lg:col-span-2' : expandedTable === 'detail' ? 'hidden' : ''}`}>
                    <div className="absolute top-1 right-6 flex items-center gap-1 z-20">
                        <button onClick={() => setFullscreenTable('master')} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]"><Expand className="w-4 h-4" /></button>
                        <button onClick={() => setExpandedTable(expandedTable === 'master' ? null : 'master')} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]">{expandedTable === 'master' ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}</button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto pr-2 scrollbar-hide">
                        <Table className="min-w-[600px]">
                            <TableHead className="bg-slate-50/80 sticky top-0 z-10">
                                <TableRow className="border-b border-slate-100">
                                    <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Group Name</TableHeaderCell>
                                    <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Spending</TableHeaderCell>
                                    <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {masterData?.map((item: any) => (
                                    <TableRow key={item.name} className={`cursor-pointer transition-all border-b border-slate-100/50 border-l-4 ${selectedGroup === item.name ? 'bg-slate-50/50 border-l-slate-400' : 'hover:bg-slate-50/30 border-l-transparent'}`} onClick={() => setSelectedGroup(item.name === selectedGroup ? null : item.name)}>
                                        <TableCell className="text-sm !text-[#0C0C0C] py-4 font-bold max-w-[220px] truncate" title={item.name}>{item.name}</TableCell>
                                        <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                        <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>

                <Card className={`rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden relative transition-all duration-500 ${expandedTable === 'detail' ? 'lg:col-span-2' : expandedTable === 'master' ? 'hidden' : ''}`}>
                    <div className="absolute top-1 right-6 flex items-center gap-1 z-20">
                        <button onClick={() => setFullscreenTable('detail')} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]"><Expand className="w-4 h-4" /></button>
                        <button onClick={() => setExpandedTable(expandedTable === 'detail' ? null : 'detail')} className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]">{expandedTable === 'detail' ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}</button>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto overflow-x-auto pr-2 scrollbar-hide">
                        <Table className="min-w-[600px]">
                            <TableHead className="bg-slate-50/80 sticky top-0 z-10">
                                <TableRow className="border-b border-slate-100">
                                    <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">SKU Name</TableHeaderCell>
                                    <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Spending</TableHeaderCell>
                                    <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {detailData?.map((item: any) => (
                                    <TableRow key={item.name} className="border-b border-slate-100/50 hover:bg-slate-50/30 transition-all">
                                        <TableCell className="text-sm !text-[#0C0C0C] py-4 font-bold max-w-[220px] truncate" title={item.name}>{item.name}</TableCell>
                                        <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                        <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </div>
          </>
        )}
      </main>

      {/* Overlays */}
      {isSidebarOpen && <FilterSidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} source={source} />}
      
      {fullscreenTable && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col p-10 animate-in fade-in zoom-in duration-300">
              <div className="flex justify-between items-center mb-10 shrink-0">
                  <div className="space-y-1">
                      <h2 className="text-3xl font-black text-[#0C0C0C] tracking-tighter uppercase italic">{fullscreenTable === 'master' ? 'Group' : 'SKU'} Analysis</h2>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Detailed drill-down view</p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all text-xs font-bold uppercase tracking-widest">
                          <Download className="w-4 h-4" /> Export CSV
                      </button>
                      <button onClick={() => setFullscreenTable(null)} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all text-slate-500">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
              </div>
              <div className="flex-1 overflow-auto rounded-3xl border border-slate-100 shadow-2xl">
                  <Table>
                      <TableHead className="bg-slate-50 sticky top-0 z-10">
                          <TableRow className="border-b border-slate-200">
                              <TableHeaderCell className="text-xs font-bold !text-slate-500 uppercase tracking-widest py-6">
                                  {fullscreenTable === 'master' ? 'Group Name' : 'SKU Name'}
                              </TableHeaderCell>
                              <TableHeaderCell className="text-right text-xs font-bold !text-slate-500 uppercase tracking-widest py-6">Spending</TableHeaderCell>
                              <TableHeaderCell className="text-right text-xs font-bold !text-slate-500 uppercase tracking-widest py-6">Qty</TableHeaderCell>
                          </TableRow>
                      </TableHead>
                      <TableBody>
                          {(fullscreenTable === 'master' ? masterData : detailData)?.map((item: any) => (
                              <TableRow key={item.name} className="border-b border-slate-100 hover:bg-slate-50/50">
                                  <TableCell className="text-base font-bold !text-[#0C0C0C] py-6">{item.name}</TableCell>
                                  <TableCell className="text-right text-base !text-[#0C0C0C] py-6">{formatValue(item.revenue)}</TableCell>
                                  <TableCell className="text-right text-base !text-[#0C0C0C] py-6">{Math.round(item.qty).toLocaleString()}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </div>
          </div>
      )}
    </div>
  );
}
