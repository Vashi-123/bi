// --- API Configuration ---
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// --- Color Palette (Rank-based) ---
export const RANK_COLORS = ["#8F3F48", "#638994", "#FF843B", "#79783F", "#A68B7A"];
export const MIN_COLOR = "#0C0C0C";

export const getColor = (index: number, total: number): string => {
    if (total <= 1) return RANK_COLORS[0];
    if (index === total - 1) return MIN_COLOR;
    if (index < RANK_COLORS.length) return RANK_COLORS[index];
    return RANK_COLORS[RANK_COLORS.length - 1];
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
