'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { 
  Card, Title, Text, Table, TableHead, TableRow, 
  TableHeaderCell, TableBody, TableCell, Badge, Flex,
  BarChart
} from '@tremor/react';
import { 
  Activity, Package, ArrowLeft, Download, RefreshCcw
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE, fetcher } from '@/lib/constants';

function formatCompact(val: number) {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
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
  const { data, isLoading, error, mutate } = useSWR<TurnoverItem[]>(
    `${API_BASE}/api/inventory/turnover`, 
    fetcher
  );

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const headers = ['SKU ID', 'SKU Name', 'Product', 'Median Stock', 'Current Stock', 'Sales (30d)', 'Ratio', 'Days'];
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
    const turnoverDays = itemsWithSales.map(i => i.turnover_days).sort((a, b) => a - b);
    let medianDays = 0;
    if (turnoverDays.length > 0) {
      const mid = Math.floor(turnoverDays.length / 2);
      medianDays = turnoverDays.length % 2 !== 0 
        ? turnoverDays[mid] 
        : (turnoverDays[mid - 1] + turnoverDays[mid]) / 2;
    }
    
    const bestItem = [...data].sort((a, b) => b.turnover_ratio - a.turnover_ratio)[0];
    
    return {
      medianDays: medianDays.toFixed(1),
      bestItem: bestItem.item_name,
      totalItems: data.length,
      activeItems: itemsWithSales.length
    };
  }, [data]);

  const categoryData = useMemo(() => {
    if (!data) return [];
    const categories: Record<string, { name: string, totalSales: number, count: number }> = {};
    
    data.forEach(item => {
      const cat = item.product_name || 'Uncategorized';
      if (!categories[cat]) {
        categories[cat] = { name: cat, totalSales: 0, count: 0 };
      }
      categories[cat].totalSales += item.total_sales;
      categories[cat].count += 1;
    });

    return Object.values(categories)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 15);
  }, [data]);

  const distributionData = useMemo(() => {
    if (!data) return [];
    
    const buckets = [
      { label: '0-1', min: 0, max: 1 },
      { label: '1-5', min: 1, max: 5 },
      { label: '5-15', min: 5, max: 15 },
      { label: '15-30', min: 15, max: 30 },
      { label: '30-60', min: 30, max: 60 },
      { label: '60+', min: 60, max: Infinity }
    ];

    const result = buckets.map(b => {
      const count = data.filter(i => {
        if (b.min === 0) {
           return i.turnover_days >= 0 && i.turnover_days <= 1;
        }
        return i.turnover_days > b.min && i.turnover_days <= b.max;
      }).length;
      return { range: b.label, 'SKU Count': count };
    });

    return result;
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
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#E8ECEF] via-[#F8FAFC] to-[#FDF1D6] opacity-100" />
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#638994]/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#79783F]/5 blur-[150px] rounded-full" />
      </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[600px] flex flex-col">
            <Flex className="mb-8 shrink-0" justifyContent="between" alignItems="center">
              <div>
                <Title className="text-xl font-bold text-[#0C0C0C]">Leaderboard</Title>
                <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Top Categories by Sales</Text>
              </div>
              <Badge color="slate" className="rounded-md font-bold uppercase text-[9px]">By Volume</Badge>
            </Flex>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-6 scrollbar-hide">
              {isLoading ? (
                Array.from({length: 6}).map((_, i) => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="flex justify-between h-4 bg-slate-50 rounded w-full" />
                    <div className="h-2 bg-slate-50 rounded-full" />
                  </div>
                ))
              ) : categoryData.map((cat, idx) => {
                const maxVal = categoryData[0].totalSales;
                const percentage = (cat.totalSales / maxVal) * 100;
                const colors = ['#8F3F48', '#638994', '#FF843B', '#79783F', '#A68B7A'];
                const color = colors[idx % colors.length];

                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                      <span className="truncate pr-4">{cat.name}</span>
                      <span className="text-[#0C0C0C] font-extrabold shrink-0">{formatCompact(cat.totalSales)}</span>
                    </div>
                    <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-1000 ease-out shadow-sm" 
                        style={{ width: `${percentage}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[600px] flex flex-col">
            <Title className="text-xl font-bold text-[#0C0C0C] mb-2">Turnover Distribution</Title>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">SKU Count by Turnover Days</Text>
            <div className="flex-1">
              <BarChart
                className="h-full mt-4"
                data={distributionData}
                index="range"
                categories={["SKU Count"]}
                colors={["blue"]}
                valueFormatter={(number) => number.toLocaleString()}
                showAnimation={true}
                yAxisWidth={48}
              />
            </div>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white flex flex-col min-h-[500px]">
          <div className="flex-1 overflow-auto scrollbar-hide">
            <Table>
              <TableHead>
                <TableRow className="border-b border-slate-100">
                  <TableHeaderCell className="text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">SKU Name</TableHeaderCell>
                  <TableHeaderCell className="text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest py-4">Median Stock</TableHeaderCell>
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
                ) : data?.slice(0, 100).map((item) => (
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
      </main>
    </div>
  );
}
