import { create } from 'zustand';

interface DashboardState {
  activeMetric: 'revenue' | 'profit' | 'margin' | 'qty';
  legendDimension: 'type' | 'Category' | 'Currency' | 'counterparty' | 'Groupclient' | 'Product country' | 'CountryGroup' | 'Item name' | 'Product name';
  topN: number;
  selectedGroup: string | null;
  filters: Record<string, string[]>;
  dateFilter: {
    mode: 'all' | 'between' | 'relative' | 'before' | 'after';
    value: any;
    unit?: string;
  };
  setActiveMetric: (metric: 'revenue' | 'profit' | 'margin' | 'qty') => void;
  setLegendDimension: (dim: 'type' | 'Category' | 'Currency' | 'counterparty' | 'Groupclient' | 'Product country' | 'CountryGroup' | 'Item name' | 'Product name') => void;
  setTopN: (n: number) => void;
  setSelectedGroup: (group: string | null) => void;
  setFilter: (column: string, values: string[]) => void;
  setDateFilter: (filter: { mode: any, value: any, unit?: string }) => void;
  clearFilters: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  activeMetric: 'revenue',
  legendDimension: 'Category',
  topN: 5,
  selectedGroup: null,
  filters: {},
  dateFilter: { mode: 'between', value: { start: '', end: '' }, unit: 'day' },
  setActiveMetric: (activeMetric) => set({ activeMetric }),
  setLegendDimension: (legendDimension) => set({ legendDimension, selectedGroup: null }),
  setTopN: (topN) => set({ topN }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup }),
  setFilter: (column, values) => set((state) => ({
    filters: { ...state.filters, [column]: values }
  })),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  clearFilters: () => set({ filters: {}, dateFilter: { mode: 'between', value: { start: '', end: '' }, unit: 'day' } }),
}));
