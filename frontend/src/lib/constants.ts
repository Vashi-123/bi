// --- API Configuration ---
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const SETTINGS_API_BASE = process.env.NEXT_PUBLIC_SETTINGS_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:8081` : 'http://localhost:8081');

// --- Color Palette (Rank-based) ---
export const RANK_COLORS = [
    "#111111", // Черный
    "#A18B7D", // Тауп
    "#7B8147", // Оливковый
    "#FA823A", // Апельсиновый
    "#658D9C", // Приглушенный бирюзовый
    "#8C3E4A", // Бордовый
    "#E6E2D8", // Грейдж (Подложки)
    "#FDE1D3", // Нежно-персиковый
    "#C3CCAF", // Светло-шалфейный
    "#1E2C3A"  // Глубокий синий
];
export const MIN_COLOR = "#0C0C0C";

export const getColor = (index: number, total: number): string => {
    return RANK_COLORS[index % RANK_COLORS.length];
};

// --- SWR Fetcher ---
export const fetcher = async (url: string) => {
    const start = performance.now();
    try {
        const res = await fetch(url, {
            headers: {
                'x-telegram-init-data': 'admin_mock'
            }
        });
        if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
        const data = await res.json();
        const end = performance.now();
        
        // Pretty log for performance tracking
        const endpoint = url.split('/api/')[1]?.split('?')[0] || url;
        console.log(
            `%c[API] %c${endpoint.padEnd(15)} %c${(end - start).toFixed(0)}ms`,
            "color: #FF843B; font-weight: bold;",
            "color: #191B1D; font-weight: 500;",
            `color: ${end - start > 500 ? '#8F3F48' : '#79783F'}; font-weight: bold;`
        );
        return data;
    } catch (error) {
        console.error(`%c[API Error] %c${url}`, "color: white; background: #8F3F48; padding: 2px 5px; border-radius: 4px;", "color: #8F3F48;", error);
        throw error;
    }
};

// --- Metric Maps ---
export const METRIC_DB_MAP: Record<string, string> = {
    revenue: 'Amount_USD',
    profit: 'Profit_USD',
    margin: 'Margin_%',
    qty: 'Qty',
    stock: 'stock_value_usd',
};
