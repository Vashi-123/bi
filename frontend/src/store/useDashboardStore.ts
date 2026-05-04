import { create } from 'zustand';

// --- Types ---

type Metric = 'revenue' | 'profit' | 'margin' | 'qty' | 'inventory';
type Dimension = 'type' | 'Category' | 'Currency' | 'counterparty' | 'Groupclient' | 'Product country' | 'CountryGroup' | 'Item name' | 'Product name';

interface DateFilter {
  mode: 'all' | 'between' | 'relative' | 'before' | 'after';
  value: any;
  unit?: string;
}

interface DashboardState {
  activeMetric: Metric;
  legendDimension: Dimension;
  topN: number;
  selectedGroup: string | null;
  filters: Record<string, string[]>;
  dateFilter: DateFilter;
  sortCol: string;
  sortDir: 'asc' | 'desc';
  setActiveMetric: (metric: Metric) => void;
  setLegendDimension: (dim: Dimension) => void;
  setTopN: (n: number) => void;
  setSelectedGroup: (group: string | null) => void;
  setFilter: (column: string, values: string[]) => void;
  setDateFilter: (filter: DateFilter) => void;
  setSortCol: (col: string) => void;
  setSortDir: (dir: 'asc' | 'desc') => void;
  clearFilters: () => void;
}

// --- Store ---

const DEFAULT_DATE_FILTER: DateFilter = { mode: 'relative', value: 3, unit: 'month' };

export const useDashboardStore = create<DashboardState>((set) => ({
  activeMetric: 'revenue',
  legendDimension: 'Category',
  topN: 5,
  selectedGroup: null,
  filters: {},
  dateFilter: DEFAULT_DATE_FILTER,
  sortCol: 'item_name',
  sortDir: 'desc',
  setActiveMetric: (activeMetric) => set({ activeMetric }),
  setLegendDimension: (legendDimension) => set({ legendDimension, selectedGroup: null }),
  setTopN: (topN) => set({ topN }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup }),
  setFilter: (column, values) => set((state) => ({
    filters: { ...state.filters, [column]: values }
  })),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setSortCol: (sortCol) => set({ sortCol }),
  setSortDir: (sortDir) => set({ sortDir }),
  clearFilters: () => set({ filters: {}, dateFilter: DEFAULT_DATE_FILTER, sortCol: 'item_name', sortDir: 'desc' }),
}));
