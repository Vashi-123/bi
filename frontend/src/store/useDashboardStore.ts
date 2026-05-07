import { create } from 'zustand';

// --- Types ---

type Metric = 'revenue' | 'profit' | 'margin' | 'qty' | 'stock';
type Dimension = 'type' | 'Category' | 'Currency' | 'counterparty' | 'Groupclient' | 'ClientCountryGroup' | 'Product country' | 'CountryGroup' | 'Item name' | 'Product name';

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
  groupByClient: boolean;
  setActiveMetric: (metric: Metric) => void;
  setLegendDimension: (dim: Dimension) => void;
  setTopN: (n: number) => void;
  setSelectedGroup: (group: string | null) => void;
  setFilter: (column: string, values: string[]) => void;
  setDateFilter: (filter: DateFilter) => void;
  setGroupByClient: (v: boolean) => void;
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
  groupByClient: false,
  setActiveMetric: (activeMetric) => set({ activeMetric }),
  setLegendDimension: (legendDimension) => set({ legendDimension, selectedGroup: null }),
  setTopN: (topN) => set({ topN }),
  setSelectedGroup: (selectedGroup) => set({ selectedGroup }),
  setFilter: (column, values) => set((state) => ({
    filters: { ...state.filters, [column]: values }
  })),
  setDateFilter: (dateFilter) => set({ dateFilter }),
  setGroupByClient: (groupByClient) => set({ groupByClient }),
  clearFilters: () => set({ filters: {}, dateFilter: DEFAULT_DATE_FILTER, groupByClient: false }),
}));
