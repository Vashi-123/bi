import type { TrendItem, FormattedTrendItem } from './types';

/**
 * Formats a number for display with optional currency symbol.
 * Handles millions (M), thousands (K), and sub-thousand values.
 */
export const formatValue = (number: number, includeSymbol = true): string => {
    if (number === undefined || number === null) return includeSymbol ? '$0' : '0';
    
    const isNeg = number < 0;
    const absNumber = Math.abs(number);
    const symbol = includeSymbol ? '$' : '';
    
    let valStr = '';
    if (absNumber >= 1000000) valStr = `${(absNumber / 1000000).toFixed(2)}M`;
    else if (absNumber >= 1000) valStr = `${(absNumber / 1000).toFixed(2)}K`;
    else valStr = Math.round(absNumber).toLocaleString();
    
    return isNeg ? `-${symbol}${valStr}` : `${symbol}${valStr}`;
};

/**
 * Groups trend data by time_label and calculates period-over-period growth.
 * Uses Map for O(n) performance instead of O(n²) .find() inside .reduce().
 */
export function formatTrend(data: TrendItem[]): FormattedTrendItem[] {
    if (!Array.isArray(data)) return [];

    const map = new Map<string, any>();
    const ordered: string[] = [];

    for (const curr of data) {
        const existing = map.get(curr.time_label);
        if (existing) {
            existing[curr.dimension_value] = curr.value;
            existing.total += curr.value;
        } else {
            const entry = { 
                time: curr.time_label, 
                date: curr.date,
                [curr.dimension_value]: curr.value, 
                total: curr.value 
            };
            map.set(curr.time_label, entry);
            ordered.push(curr.time_label);
        }
    }

    const grouped = ordered.map(key => map.get(key)!);

    return grouped.map((item, index, array) => {
        if (index === 0) return { ...item, growth: 0, categoryGrowth: {} };
        const prev = array[index - 1];
        const categoryGrowth: Record<string, number> = {};
        Object.keys(item).forEach(k => {
            if (k !== 'time' && k !== 'total' && k !== 'growth' && k !== 'categoryGrowth') {
                categoryGrowth[k] = prev[k] > 0 ? ((item[k] - prev[k]) / prev[k]) * 100 : 0;
            }
        });
        return { ...item, growth: prev.total > 0 ? ((item.total - prev.total) / prev.total) * 100 : 0, categoryGrowth };
    });
}
