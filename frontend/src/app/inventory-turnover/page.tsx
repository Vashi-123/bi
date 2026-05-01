'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { 
  Card, Title, Text, Table, TableHead, TableRow, 
  TableHeaderCell, TableBody, TableCell, Badge, Flex, Grid,
  ProgressBar, AreaChart, BarChart, TextInput
} from '@tremor/react';
import { 
  TrendingUp, Activity, Package, Search, 
  ArrowLeft, Download, Filter, RefreshCcw, Zap, Target
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE, fetcher, getColor } from '@/lib/constants';
import { useDashboardStore } from '@/store/useDashboardStore';

function formatCompact(val: number) {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

interface TurnoverItem {
  item_id: string;
  item_name: string;
  product_name: string;
  avg_stock: number;
  current_stock: number;
  total_sales: number;
  turnover_ratio: number;
  turnover_days: number;
}

export default function InventoryTurnoverPage() {
  const { filters, setFilter } = useDashboardStore();
  const [search, setSearch] = useState('');

  // --- URL Building ---
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([col, values]) => {
      if (values && values.length > 0) {
        params.append(col, JSON.stringify(values));
      }
    });
    return params.toString();
  }, [filters]);

  const { data, isLoading, error, mutate } = useSWR<TurnoverItem[]>(
    `${API_BASE}/api/inventory/turnover?${filterParams}`, 
    fetcher
  );

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(item => 
      item.item_name.toLowerCase().includes(search.toLowerCase()) ||
      item.item_id.includes(search)
    );
  }, [data, search]);

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const headers = ['SKU ID', 'SKU Name', 'Product', 'Avg Stock', 'Current Stock', 'Sales (30d)', 'Ratio', 'Days'];
    const rows = data.map(item => [
      item.item_id,
      `"${item.item_name.replace(/"/g, '""')}"`,
      `"${item.product_name.replace(/"/g, '""')}"`,
      item.avg_stock,
      item.current_stock,
      item.total_sales,
      item.turnover_ratio,
      item.turnover_days
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventory_turnover_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const itemsWithSales = data.filter(i => i.total_sales > 0);
    const avgDays = itemsWithSales.reduce((acc, curr) => acc + curr.turnover_days, 0) / itemsWithSales.length;
    const bestItem = [...data].sort((a, b) => b.turnover_ratio - a.turnover_ratio)[0];
    
    return {
      avgDays: avgDays.toFixed(1),
      bestItem: bestItem.item_name,
      totalItems: data.length,
      activeItems: itemsWithSales.length
    };
  }, [data]);

  const topTurningItems = useMemo(() => {
    if (!data) return [];
    return [...data]
      .filter(i => i.total_sales > 0)
      .sort((a, b) => b.turnover_ratio - a.turnover_ratio)
      .slice(0, 10)
      .map(i => ({
        name: i.item_name,
        'Turnover Ratio': i.turnover_ratio
      }));
  }, [data]);

  if (error) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <Card className="max-w-md p-8 text-center rounded-3xl">
        <Title className="text-rose-600 mb-2">Error Loading Data</Title>
        <Text>Failed to connect to the analytics engine.</Text>
        <button 
          onClick={() => mutate()}
          className="mt-6 px-6 py-2 bg-[#0C0C0C] text-white rounded-xl font-bold uppercase text-[10px] tracking-widest"
        >
          Retry
        </button>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0C0C0C] font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-4 flex justify-between items-center shadow-sm">
        <Flex className="gap-6 w-auto" justifyContent="start">
          <Link href="/sales" className="p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-[#0C0C0C]">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Title className="text-xl font-black uppercase tracking-tighter italic">
            Inventory <span className="text-[#FF843B]">Turnover</span>
          </Title>
        </Flex>

        <Flex className="w-auto gap-4" justifyContent="end">
          <button 
            onClick={handleExport}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-400 hover:text-[#0C0C0C]"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button 
            onClick={() => mutate()}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-all text-slate-400 hover:text-[#0C0C0C]"
            title="Refresh Data"
          >
            <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">Usman Ganaev</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Administrator</p>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
              <Activity className="w-5 h-5 text-slate-400" />
            </div>
          </div>
        </Flex>
      </nav>

      <main className="relative z-10 max-w-[1600px] mx-auto p-10 space-y-10 pb-24">
        {/* Filter Row */}
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 pr-3 mr-1">Category</span>
              <select 
                className="bg-transparent border-none text-[11px] font-black text-[#0C0C0C] focus:ring-0 cursor-pointer uppercase tracking-tight"
                value={filters.Category?.[0] || ''}
                onChange={(e) => setFilter('Category', e.target.value ? [e.target.value] : [])}
              >
                <option value="">All Categories</option>
                <option value="Electronics">Electronics</option>
                <option value="Fashion">Fashion</option>
                <option value="Home">Home</option>
                {/* Options should ideally be dynamic, but for now we provide common ones or rely on search */}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
              <Target className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 pr-3 mr-1">Country</span>
              <select 
                className="bg-transparent border-none text-[11px] font-black text-[#0C0C0C] focus:ring-0 cursor-pointer uppercase tracking-tight"
                value={filters['Product country']?.[0] || ''}
                onChange={(e) => setFilter('Product country', e.target.value ? [e.target.value] : [])}
              >
                <option value="">All Countries</option>
                <option value="USA">USA</option>
                <option value="China">China</option>
                <option value="Germany">Germany</option>
              </select>
            </div>

            {Object.keys(filters).some(k => filters[k]?.length > 0) && (
              <button 
                onClick={() => {
                  setFilter('Category', []);
                  setFilter('Product country', []);
                  setFilter('counterparty', []);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 transition-colors ml-2"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">
            Analysis Period: 30 Days
          </div>
        </div>

        {/* KPI Grid */}
        <Grid numItemsSm={2} numItemsLg={4} className="gap-6">
          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/40 p-6 bg-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Activity className="w-16 h-16 text-[#0C0C0C]" />
            </div>
            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Avg Turnover Days</Text>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#0C0C0C]">{isLoading ? '...' : stats?.avgDays}</span>
              <span className="text-xs font-bold text-slate-400 uppercase">days</span>
            </div>
            <ProgressBar 
              value={isLoading ? 0 : Math.min(100, Math.max(0, (60 - (parseFloat(stats?.avgDays || '0'))) / 60 * 100))} 
              color={parseFloat(stats?.avgDays || '0') > 45 ? "rose" : "emerald"} 
              className="mt-4" 
            />
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/40 p-6 bg-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Zap className="w-16 h-16 text-[#DDFF55]" />
            </div>
            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Best Performing</Text>
            <div className="text-lg font-bold text-[#0C0C0C] truncate mt-1">
              {isLoading ? '...' : stats?.bestItem || 'No data'}
            </div>
            <Badge color="emerald" className="mt-4 rounded-lg uppercase text-[9px] font-black">Top Velocity</Badge>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/40 p-6 bg-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Package className="w-16 h-16 text-[#638994]" />
            </div>
            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Items Analyzed</Text>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#0C0C0C]">{isLoading ? '...' : stats?.totalItems}</span>
              <span className="text-xs font-bold text-slate-400 uppercase">SKUs</span>
            </div>
            <Text className="text-[10px] font-bold text-slate-400 mt-4 uppercase">{stats?.activeItems} items with sales</Text>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/40 p-6 bg-white overflow-hidden relative group">
             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Target className="w-16 h-16 text-[#FF843B]" />
            </div>
            <Text className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Data Recency</Text>
            <div className="text-xl font-bold text-[#0C0C0C] mt-1">Last 30 Days</div>
            <div className="mt-4 flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black uppercase text-slate-400">Live Analytics</span>
            </div>
          </Card>
        </Grid>

        {/* Charts & Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Velocity Chart */}
          <Card className="lg:col-span-1 rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[600px] flex flex-col">
            <Title className="text-xl font-bold text-[#0C0C0C] mb-6">Velocity Leaders</Title>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">Top 10 Fast Moving SKUs (Ratio)</Text>
            <div className="flex-1">
              <BarChart
                className="h-full mt-4"
                data={topTurningItems}
                index="name"
                categories={["Turnover Ratio"]}
                colors={["orange"]}
                valueFormatter={(number) => `${number.toFixed(2)}x`}
                yAxisWidth={48}
                showAnimation={true}
                layout="vertical"
              />
            </div>
          </Card>

          {/* Detailed Table */}
          <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white flex flex-col h-[600px]">
            <Flex className="mb-8" justifyContent="between" alignItems="center">
              <div>
                <Title className="text-xl font-bold text-[#0C0C0C]">Detailed Metrics</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Full Inventory Breakdown</Text>
              </div>
              <div className="flex gap-4">
                <TextInput 
                  icon={Search} 
                  placeholder="Search SKU..." 
                  className="rounded-xl w-64" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </Flex>

            <div className="flex-1 overflow-auto scrollbar-hide">
              <Table>
                <TableHead>
                  <TableRow className="border-b border-slate-100">
                    <TableHeaderCell className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">SKU Name</TableHeaderCell>
                    <TableHeaderCell className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">Avg Stock</TableHeaderCell>
                    <TableHeaderCell className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">Sales (30d)</TableHeaderCell>
                    <TableHeaderCell className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">Ratio</TableHeaderCell>
                    <TableHeaderCell className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">Days</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? (
                    Array.from({length: 8}).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-b border-slate-50">
                        <TableCell><div className="h-4 bg-slate-100 rounded w-48" /></TableCell>
                        <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                        <TableCell><div className="h-4 bg-slate-100 rounded w-16 ml-auto" /></TableCell>
                        <TableCell><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></TableCell>
                        <TableCell><div className="h-4 bg-slate-100 rounded w-12 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredData.slice(0, 100).map((item) => (
                    <TableRow key={item.item_id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/50">
                      <TableCell className="text-xs font-bold text-[#0C0C0C] py-4 max-w-[300px] truncate">
                        {item.item_name}
                        <p className="text-[9px] text-slate-400 font-normal uppercase tracking-tight mt-0.5">{item.product_name}</p>
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold text-slate-600">{item.avg_stock.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-[#0C0C0C]">{item.total_sales.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Badge size="xs" color={item.turnover_ratio > 1 ? "emerald" : item.turnover_ratio > 0.5 ? "orange" : "slate"} className="rounded-md font-bold">
                          {item.turnover_ratio.toFixed(2)}x
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-black ${item.turnover_days < 7 ? 'text-emerald-600' : item.turnover_days > 60 ? 'text-rose-600' : 'text-[#0C0C0C]'}`}>
                          {item.turnover_days === 999 ? '∞' : item.turnover_days}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
