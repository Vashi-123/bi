'use client';

import { useDashboardStore } from '@/store/useDashboardStore';
import { Card, Title, Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell, Badge, Flex } from '@tremor/react';
import { FilterIcon, UserIcon, Maximize2, Minimize2, Expand, X, ChevronsRight, ChevronsLeft, Download, UserPlus, Layout, LayoutGrid } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';
import useSWR from 'swr';
import { useEffect, useState, useMemo } from 'react';

// --- Modular Imports ---
import Link from 'next/link';
import { API_BASE, fetcher, getColor, METRIC_DB_MAP } from '@/lib/constants';
import { formatValue, formatTrend } from '@/lib/formatters';
import { KPICard } from '@/components/KPICard';
import { ChartSection } from '@/components/ChartSection';
import { FilterSidebar } from '@/components/FilterSidebar';
import { KPICardSkeleton, ChartSkeleton, DistributionSkeleton, TableSkeleton } from '@/components/Skeletons';

export default function Dashboard() {
  const { 
    activeMetric, setActiveMetric, 
    legendDimension, setLegendDimension, 
    topN, setTopN, 
    selectedGroup, setSelectedGroup,
    dateFilter, setDateFilter,
    filters
  } = useDashboardStore();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTable, setExpandedTable] = useState<'master' | 'detail' | null>(null);
  const [fullscreenTable, setFullscreenTable] = useState<'master' | 'detail' | null>(null);
  const [chartView, setChartView] = useState<'combined' | 'multiples'>('combined');

  // Initialize date filter with default 6-month window (max - 6 months to max)
  const { data: globalRange } = useSWR(`${API_BASE}/api/filters/date-range`, fetcher);
  useEffect(() => {
    // Initialize with 3 months relative filter when global max is available
    if (globalRange?.max && dateFilter.mode === 'between' && dateFilter.value?.start === '') {
      setDateFilter({
        mode: 'relative',
        value: 3,
        unit: 'month'
      });
    }
  }, [globalRange, dateFilter.mode, dateFilter.value?.start, setDateFilter]);

  // --- URL Building ---
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    
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
  // Single distribution fetch with top_n=100 — used for both rating (full) and donut (sliced)
  const fullDistUrl = `${API_BASE}/api/distribution?metric=${metricParam}&dimension=${legendDimension}&top_n=100&${filterParams}`;
  const masterUrl = `${API_BASE}/api/master?dimension=${legendDimension}&${filterParams}`;
  const detailUrl = `${API_BASE}/api/detail?dimension=${legendDimension}${selectedGroup ? `&selected_group=${encodeURIComponent(selectedGroup)}` : ''}&top_n=5000&${filterParams}`;

  // --- Smart Comparison Detection ---
  const canCompare = useMemo(() => {
    return dateFilter.mode !== 'all';
  }, [dateFilter.mode]);

  // --- Data Fetching ---
  const { data: kpiData, isLoading: kpiLoading } = useSWR(kpiUrl, fetcher);
  const { data: weeklyRaw, isLoading: weeklyLoading } = useSWR(trendsUrl('week'), fetcher);
  const { data: monthlyRaw, isLoading: monthlyLoading } = useSWR(trendsUrl('month'), fetcher);
  const { data: dailyRaw, isLoading: dailyLoading } = useSWR(trendsUrl('day'), fetcher);
  const { data: fullDistData, isLoading: distLoading } = useSWR(fullDistUrl, fetcher);
  const { data: masterData, isLoading: masterLoading } = useSWR(masterUrl, fetcher);
  const { data: detailData, isLoading: detailLoading } = useSWR(detailUrl, fetcher);

  // Derive donut data (top N + Other) from full distribution
  const ratingData = fullDistData;
  const distData = useMemo(() => {
    if (!Array.isArray(fullDistData)) return [];
    
    const total = fullDistData.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
    const threshold = total * 0.01; // 1% threshold

    const topItems = fullDistData
        .filter((d: any) => d.dimension_value !== 'Other')
        .slice(0, topN);

    const mainItems = topItems.filter((d: any) => d.value >= threshold);
    const smallItems = topItems.filter((d: any) => d.value < threshold);
    const droppedItems = fullDistData.filter((d: any) => d.dimension_value !== 'Other').slice(topN);
    const serverOther = fullDistData.find((d: any) => d.dimension_value === 'Other')?.value || 0;

    const aggregatedOtherValue = serverOther + 
                                 smallItems.reduce((acc, curr) => acc + curr.value, 0) + 
                                 droppedItems.reduce((acc, curr) => acc + curr.value, 0);

    return [
        ...mainItems,
        { dimension_value: 'Other', value: aggregatedOtherValue }
    ].filter(item => item.value > 0);
  }, [fullDistData, topN]);

  // --- Data Transforms ---
  const weeklyData = useMemo(() => formatTrend(weeklyRaw), [weeklyRaw]);
  const monthlyData = useMemo(() => formatTrend(monthlyRaw), [monthlyRaw]);
  const dailyData = useMemo(() => formatTrend(dailyRaw), [dailyRaw]);

  const sharedCategories = useMemo(() => {
      if (!distData || !Array.isArray(distData)) return [];
      const cats = distData.map((d: any) => d.dimension_value).filter((v: string) => v !== 'Other').slice(0, topN);
      return [...cats, 'Other'];
  }, [distData, topN]);

  const isCurrencyMetric = activeMetric !== 'qty' && activeMetric !== 'margin';
  
  // --- Export Function ---
  const handleExport = () => {
      const data = fullscreenTable === 'master' ? masterData : detailData;
      if (!data || !Array.isArray(data) || data.length === 0) return;

      const headers = fullscreenTable === 'master' 
          ? ['Group Name', 'Revenue', 'Profit', 'Margin (%)', 'Qty']
          : ['SKU Name', 'Revenue', 'Profit', 'Margin (%)', 'Qty'];

      const rows = data.map((item: any) => [
          `"${item.name.replace(/"/g, '""')}"`, // Escape quotes
          item.revenue,
          item.profit,
          item.margin?.toFixed(2),
          item.qty
      ]);

      const csvContent = "\uFEFF" + [ // BOM for Excel UTF-8 support
          headers.join(','),
          ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `giftery_${fullscreenTable}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900 bg-[#F8FAFC]">
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <Flex className="gap-6 w-auto" justifyContent="start">
          <div className="bg-[#0C0C0C] p-2 rounded-xl shadow-lg shadow-black/20 cursor-pointer" onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0C0C0C] leading-none mb-1">Giftery Analytics</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Performance Intelligence</p>
          </div>
        </Flex>

        <Flex className="w-auto gap-4" justifyContent="end">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all relative group text-[13px] font-bold">
            <FilterIcon className="w-4 h-4 text-[#FF843B]" /> Filters
            {Object.values(filters).some(v => v?.length > 0) && <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#FF843B] rounded-full border-2 border-white" />}
          </button>
          <div className="h-10 w-[1px] bg-slate-100 mx-2" />
          <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800">Usman Ganaev</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200"><UserIcon className="w-5 h-5 text-slate-400" /></div>
          </div>
        </Flex>
      </nav>

      <main className="relative z-10 max-w-[1600px] mx-auto p-10 space-y-12 pb-24">
        {/* Quick Date Filters */}
        <div className="flex justify-end mb-6">
            <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/10">
                {[
                    { label: 'All', mode: 'all', val: null, unit: 'day' },
                    { label: '3 Months', mode: 'relative', val: 3, unit: 'month' },
                    { label: '1 Month', mode: 'relative', val: 1, unit: 'month' }
                ].map((btn) => {
                    const isActive = (btn.mode === 'all' && dateFilter.mode === 'all') || 
                                   (btn.mode === 'relative' && dateFilter.mode === 'relative' && dateFilter.value === btn.val && dateFilter.unit === btn.unit);
                    return (
                        <button
                            key={btn.label}
                            onClick={() => setDateFilter({ mode: btn.mode as any, value: btn.val as any, unit: btn.unit as any })}
                            className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                                isActive 
                                ? 'bg-[#0C0C0C] text-white shadow-xl shadow-slate-900/20' 
                                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {btn.label}
                        </button>
                    );
                })}
            </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpiLoading ? (
                <>{Array.from({length: 4}).map((_, i) => <KPICardSkeleton key={i} />)}</>
            ) : (
                <>
                    <KPICard 
                        title="Total Revenue" 
                        period={kpiData?.meta.current_period}
                        baselinePeriod={kpiData?.meta.prev_period}
                        value={kpiData?.revenue.value} 
                        baseline={kpiData?.revenue.prev} 
                        growth={kpiData?.revenue.growth}
                        active={activeMetric === 'revenue'}
                        onClick={() => setActiveMetric('revenue')}
                        isCurrency={true}
                        hasComparison={canCompare}
                    />
                    <KPICard 
                        title="Net Profit" 
                        value={kpiData?.profit.value} 
                        baseline={kpiData?.profit.prev} 
                        growth={kpiData?.profit.growth}
                        active={activeMetric === 'profit'}
                        onClick={() => setActiveMetric('profit')}
                        isCurrency={true}
                        hasComparison={canCompare}
                    />
                    <KPICard 
                        title="Profit Margin" 
                        value={kpiData?.margin.value} 
                        baseline={kpiData?.margin.prev} 
                        growth={kpiData?.margin.growth}
                        active={activeMetric === 'margin'}
                        onClick={() => setActiveMetric('margin')}
                        isPercent={true}
                        hasComparison={canCompare}
                    />
                    <KPICard 
                        title="Total Qty" 
                        value={kpiData?.qty.value} 
                        baseline={kpiData?.qty.prev} 
                        growth={kpiData?.qty.growth}
                        active={activeMetric === 'qty'}
                        onClick={() => setActiveMetric('qty')}
                        hasComparison={canCompare}
                    />
                </>
            )}
        </div>

        {/* Global Controls */}
        <Flex className="gap-6 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/20">
            <div className="flex items-center gap-3 ml-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Show Top:</span>
                <select className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer" value={topN} onChange={e => setTopN(parseInt(e.target.value))}>
                    {(chartView === 'combined' ? [3, 5] : [10, 25, 50, 100]).map(v => <option key={v} value={v}>Top {v}</option>)}
                </select>
            </div>
            <div className="w-px h-5 bg-slate-100" />
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl">
                <button 
                    onClick={() => {
                        setChartView('combined');
                        setTopN(5);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${chartView === 'combined' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Combined View"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => {
                        setChartView('multiples');
                        setTopN(10);
                    }}
                    className={`p-1.5 rounded-lg transition-all ${chartView === 'multiples' ? 'bg-white shadow-sm text-[#0C0C0C]' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Small Multiples"
                >
                    <Layout className="w-4 h-4" />
                </button>
            </div>
            <div className="w-px h-5 bg-slate-100" />
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dimension:</span>
                <select className="bg-transparent border-none text-sm font-bold text-[#0C0C0C] focus:ring-0 cursor-pointer" value={legendDimension} onChange={e => setLegendDimension(e.target.value as any)}>
                    <option value="Category">Category</option>
                    <option value="Product name">Product</option>
                    <option value="Item name">SKU</option>
                    <option value="Product country">Country</option>
                    <option value="counterparty">Client</option>
                    <option value="type">Sales Type</option>
                </select>
            </div>
        </Flex>

        {/* Trends */}
        <section className="space-y-12">
            <ChartSection title="Weekly Trend" label="Weekly Analysis" data={weeklyData} categories={sharedCategories} minColWidth={130} barCategoryGap="20%" isCurrency={isCurrencyMetric} view={chartView} />
            <ChartSection title="Monthly Trend" label="Monthly Overview" data={monthlyData} categories={sharedCategories} minColWidth={50} barCategoryGap="25%" isCurrency={isCurrencyMetric} view={chartView} />
            <ChartSection title="Daily Trend" label="Day-by-Day" data={dailyData} categories={sharedCategories} minColWidth={60} barCategoryGap="15%" isCurrency={isCurrencyMetric} view={chartView} />
        </section>

        {/* Distribution Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Market Share Rating */}
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[580px] flex flex-col">
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <Title className="text-xl font-bold text-[#0C0C0C]">Market Share Rating</Title>
                    <Badge className="bg-slate-50 text-slate-600 rounded-md border-slate-100 px-3 py-1 font-bold text-[10px] uppercase tracking-wider">{legendDimension}</Badge>
                </div>
                <div className="flex-1 overflow-y-auto pr-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {Array.isArray(ratingData) && ratingData.filter((d: any) => d.dimension_value !== 'Other').map((d: any, i: number) => {
                        const maxValue = Math.max(...(ratingData.filter((x: any) => x.dimension_value !== 'Other').map((x: any) => x.value) || [1]));
                        const color = getColor(i, ratingData.length);
                        return (
                            <div key={d.dimension_value} className="space-y-2">
                                <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                    <span className="truncate pr-4">{d.dimension_value}</span>
                                    <span className="text-[#0C0C0C] font-extrabold shrink-0">{formatValue(d.value)}</span>
                                </div>
                                <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                                        style={{ width: `${(d.value / maxValue) * 100}%`, backgroundColor: color }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>

            {/* Portfolio Structure */}
            <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[580px] flex flex-col">
                <Title className="text-xl font-bold mb-8 text-[#0C0C0C] shrink-0">Portfolio Structure</Title>
                <div className="flex-1 flex flex-col md:flex-row items-center gap-8 min-h-0">
                    <div className="w-full md:w-1/2 flex justify-center">
                        <div className="h-72 w-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={Array.isArray(distData) ? distData : []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="dimension_value">
                                        {Array.isArray(distData) && distData.map((_: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={getColor(index, distData.length)} />
                                        ))}
                                    </Pie>
                                    <ReTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="w-full md:w-1/2 flex-1 overflow-y-auto pr-2 scrollbar-thin space-y-3">
                        {Array.isArray(distData) && distData.map((item: any, i: number) => {
                            const total = distData.reduce((acc: number, curr: any) => acc + curr.value, 0) || 1;
                            const color = getColor(i, distData.length);
                            return (
                                <div key={item.dimension_value} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 rounded-full shadow-md border-2 border-white" style={{ backgroundColor: color }} />
                                        <span className="text-[11px] font-bold text-slate-400 group-hover:text-[#0C0C0C] uppercase tracking-tight transition-colors">{item.dimension_value}</span>
                                    </div>
                                    <div className="text-sm font-extrabold text-[#0C0C0C]">{((item.value / total) * 100).toFixed(2)}%</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>
        </div>

        {/* Details Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Master Table */}
            <Card className={`rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden relative transition-all duration-500
                            ${expandedTable === 'master' ? 'lg:col-span-2' : expandedTable === 'detail' ? 'hidden' : ''}`}>
                {/* Action Buttons at the Edge */}
                <div className="absolute top-1 right-6 flex items-center gap-1 z-20">
                    <button 
                        onClick={() => setFullscreenTable('master')}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]"
                        title="Fullscreen"
                    >
                        <Expand className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setExpandedTable(expandedTable === 'master' ? null : 'master')}
                        className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C] group"
                        title={expandedTable === 'master' ? "Collapse" : "Expand to Width"}
                    >
                        {expandedTable === 'master' ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                    </button>
                </div>

                <div className="max-h-[500px] overflow-y-auto overflow-x-auto pr-2 scrollbar-hide">
                    <Table className="min-w-[600px]">
                        <TableHead className="bg-slate-50/80 sticky top-0 z-10">
                            <TableRow className="border-b border-slate-100">
                                <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Group Name</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Revenue</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Profit</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Margin</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {masterLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-20 text-center"><div className="inline-block w-6 h-6 border-2 border-[#0C0C0C] border-t-transparent rounded-full animate-spin" /></TableCell></TableRow>
                            ) : Array.isArray(masterData) && masterData.map((item: any) => (
                                <TableRow 
                                    key={item.name} 
                                    className={`cursor-pointer transition-all border-b border-slate-100/50 border-l-4 ${selectedGroup === item.name ? 'bg-slate-50/50 border-l-slate-400' : 'hover:bg-slate-50/30 border-l-transparent'}`}
                                    onClick={() => setSelectedGroup(item.name === selectedGroup ? null : item.name)}
                                >
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4 font-bold max-w-[220px] truncate" title={item.name}>{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin?.toFixed(2) ?? '0.00'}%</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Detail Table */}
            <Card className={`rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white overflow-hidden relative transition-all duration-500
                            ${expandedTable === 'detail' ? 'lg:col-span-2' : expandedTable === 'master' ? 'hidden' : ''}`}>
                {/* Action Buttons at the Edges */}
                <button 
                    onClick={() => setExpandedTable(expandedTable === 'detail' ? null : 'detail')}
                    className="absolute top-1 left-6 p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C] z-20"
                    title={expandedTable === 'detail' ? "Collapse" : "Expand to Width"}
                >
                    {expandedTable === 'detail' ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                </button>
                <button 
                    onClick={() => setFullscreenTable('detail')}
                    className="absolute top-1 right-6 p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C] z-20"
                    title="Fullscreen"
                >
                    <Expand className="w-4 h-4" />
                </button>

                <div className="max-h-[500px] overflow-y-auto overflow-x-auto pr-2 scrollbar-hide">
                    <Table className="min-w-[700px]">
                        <TableHead className="bg-slate-50/80 sticky top-0 z-10">
                            <TableRow className="border-b border-slate-100">
                                <TableHeaderCell className="text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">SKU Name</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Revenue</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Profit</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Margin</TableHeaderCell>
                                <TableHeaderCell className="text-right text-[10px] font-bold !text-slate-500 uppercase tracking-widest py-4">Qty</TableHeaderCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {detailLoading ? (
                                <TableRow><TableCell colSpan={5} className="py-20 text-center"><div className="inline-block w-6 h-6 border-2 border-[#0C0C0C] border-t-transparent rounded-full animate-spin" /></TableCell></TableRow>
                            ) : (Array.isArray(detailData) && detailData.length > 0) ? detailData.map((item: any) => (
                                <TableRow key={item.name} className="hover:bg-slate-50/30 transition-colors border-b border-slate-50">
                                    <TableCell className="text-sm !text-[#0C0C0C] py-4 max-w-[300px] truncate font-bold" title={item.name}>{item.name}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.revenue)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{formatValue(item.profit)}</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{item.margin?.toFixed(2) ?? '0.00'}%</TableCell>
                                    <TableCell className="text-right text-sm !text-[#0C0C0C] py-4">{Math.round(item.qty).toLocaleString()}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic font-bold">Select a group in the left table to see SKU details</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>
        </div>

      </main>

      {/* Filter Sidebar */}
      {isSidebarOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
              <FilterSidebar onClose={() => setSidebarOpen(false)} />
          </div>
      )}

      {/* Fullscreen Table Overlay */}
      {fullscreenTable && (
          <div className="fixed inset-0 z-[200] bg-white flex flex-col p-10 animate-in zoom-in-95 duration-200">
              <div className="flex justify-end items-center mb-8 shrink-0">
                  <div className="flex items-center gap-3">
                      <button 
                          onClick={handleExport}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-[#0C0C0C] hover:text-white rounded-xl transition-all text-slate-500 text-sm font-bold border border-slate-100"
                      >
                          <Download className="w-4 h-4" />
                          Export to Excel (CSV)
                      </button>
                      <button 
                          onClick={() => setFullscreenTable(null)}
                          className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
              </div>
              
              <div className="flex-1 overflow-auto border border-slate-100 rounded-3xl p-8 shadow-inner bg-slate-50/30">
                  <Table className="min-w-full">
                      <TableHead className="bg-white sticky top-[-32px] z-20 shadow-sm">
                          <TableRow className="border-b border-slate-100">
                              <TableHeaderCell className="text-[11px] font-black !text-slate-500 uppercase tracking-widest py-6">
                                  {fullscreenTable === 'master' ? 'Group Name' : 'SKU Name'}
                              </TableHeaderCell>
                              <TableHeaderCell className="text-right text-[11px] font-black !text-slate-500 uppercase tracking-widest py-6">Revenue</TableHeaderCell>
                              <TableHeaderCell className="text-right text-[11px] font-black !text-slate-500 uppercase tracking-widest py-6">Profit</TableHeaderCell>
                              <TableHeaderCell className="text-right text-[11px] font-black !text-slate-500 uppercase tracking-widest py-6">Margin</TableHeaderCell>
                              <TableHeaderCell className="text-right text-[11px] font-black !text-slate-500 uppercase tracking-widest py-6">Qty</TableHeaderCell>
                          </TableRow>
                      </TableHead>
                      <TableBody className="bg-white">
                          {(fullscreenTable === 'master' ? masterData : detailData)?.map((item: any) => (
                              <TableRow key={item.name} className="hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                  <TableCell className={`text-base !text-[#0C0C0C] py-6 font-bold ${fullscreenTable === 'detail' ? 'max-w-[600px] truncate' : ''}`} title={item.name}>
                                      {item.name}
                                  </TableCell>
                                  <TableCell className="text-right text-base !text-[#0C0C0C] py-6">{formatValue(item.revenue)}</TableCell>
                                  <TableCell className="text-right text-base !text-[#0C0C0C] py-6">{formatValue(item.profit)}</TableCell>
                                  <TableCell className="text-right text-base !text-[#0C0C0C] py-6">{item.margin?.toFixed(2) ?? '0.00'}%</TableCell>
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
