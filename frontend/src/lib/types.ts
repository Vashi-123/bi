// --- API Response Types ---

export interface KPIMetric {
  value: number;
  prev: number | null;
  growth: number;
}

export interface KPIResponse {
  revenue: KPIMetric;
  profit: KPIMetric;
  margin: KPIMetric;
  qty: KPIMetric;
  meta: {
    current_period: string;
    prev_period: string | null;
  };
}

export interface TrendItem {
  sort_key: string;
  dimension_value: string;
  value: number;
  time_label: string;
}

export interface DistItem {
  dimension_value: string;
  value: number;
}

export interface MasterItem {
  name: string;
  revenue: number;
  profit: number;
  margin: number;
  qty: number;
}

export interface DateRange {
  min: string;
  max: string;
}

// --- Component Props ---

export interface KPICardProps {
  title: string;
  period?: string;
  baselinePeriod?: string;
  value: number;
  baseline: number | null;
  growth: number;
  active: boolean;
  onClick: () => void;
  isPercent?: boolean;
  isCurrency?: boolean;
  hasComparison?: boolean;
}

export interface ChartSectionProps {
  title: string;
  label: string;
  data: any[];
  categories: string[];
  minColWidth?: number;
  barCategoryGap?: string;
  isCurrency?: boolean;
  view?: 'combined' | 'multiples';
}

// --- Formatted Trend Data ---

export interface FormattedTrendItem {
  time: string;
  total: number;
  growth: number;
  categoryGrowth: Record<string, number>;
  [category: string]: any;
}
