// --- API Configuration ---
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Color Palette (Rank-based) ---
export const RANK_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
    "#06B6D4", "#F472B6", "#6366F1", "#84CC16", "#EC4899", 
    "#14B8A6", "#F97316"
];
export const MIN_COLOR = "#0C0C0C";

export const getColor = (index: number, total: number): string => {
    if (index === total - 1) return MIN_COLOR;
    return RANK_COLORS[index % RANK_COLORS.length];
};

// --- SWR Fetcher ---
export const fetcher = (url: string) => fetch(url).then((res) => {
    if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
    return res.json();
});

// --- Metric Maps ---
export const METRIC_DB_MAP: Record<string, string> = {
    revenue: 'Amount_USD',
    profit: 'Profit_USD',
    margin: 'Margin_%',
    qty: 'Qty',
};
