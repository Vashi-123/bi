'use client';

/**
 * Animated skeleton placeholders for loading states.
 * Matches the exact dimensions and layout of the real components.
 */

export function KPICardSkeleton() {
    return (
        <div className="p-8 rounded-2xl bg-white shadow-md border border-slate-100 animate-pulse">
            <div className="flex flex-col gap-6">
                <div className="space-y-2">
                    <div className="h-2.5 bg-slate-100 rounded-full w-24" />
                    <div className="h-2 bg-slate-50 rounded-full w-32" />
                </div>
                <div className="h-10 bg-slate-100 rounded-lg w-36" />
                <div className="border-t border-slate-50 pt-5 flex items-center gap-4">
                    <div className="space-y-1.5 flex-1">
                        <div className="h-2 bg-slate-50 rounded-full w-20" />
                        <div className="h-3 bg-slate-100 rounded-full w-16" />
                    </div>
                    <div className="h-7 bg-slate-100 rounded-lg w-16" />
                </div>
            </div>
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end px-2">
                <div className="space-y-2">
                    <div className="h-7 bg-slate-100 rounded-lg w-40 animate-pulse" />
                    <div className="h-2.5 bg-slate-50 rounded-full w-56 animate-pulse" />
                </div>
            </div>
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/30 p-10 border border-slate-50">
                <div className="h-[450px] flex items-end justify-around gap-3 px-8 animate-pulse">
                    {[65, 80, 45, 90, 60, 75, 55, 85, 70, 50].map((h, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full bg-slate-100 rounded-t-md" style={{ height: `${h}%` }} />
                            <div className="h-2 bg-slate-50 rounded-full w-8" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
    return (
        <div className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white animate-pulse">
            <div className="space-y-4">
                <div className="flex gap-4 border-b border-slate-100 pb-4">
                    {[120, 70, 70, 50, 50].map((w, i) => (
                        <div key={i} className="h-3 bg-slate-100 rounded-full" style={{ width: `${w}px` }} />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4 py-3">
                        <div className="h-3 bg-slate-50 rounded-full w-28" />
                        <div className="h-3 bg-slate-50 rounded-full w-16 ml-auto" />
                        <div className="h-3 bg-slate-50 rounded-full w-16" />
                        <div className="h-3 bg-slate-50 rounded-full w-12" />
                        <div className="h-3 bg-slate-50 rounded-full w-12" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function DistributionSkeleton() {
    return (
        <div className="rounded-3xl border-slate-100 shadow-xl shadow-slate-200/50 p-8 bg-white h-[580px] animate-pulse">
            <div className="flex justify-between items-center mb-8">
                <div className="h-6 bg-slate-100 rounded-lg w-44" />
                <div className="h-5 bg-slate-50 rounded-md w-20" />
            </div>
            <div className="space-y-6">
                {[100, 82, 65, 50, 38, 25, 15].map((w, i) => (
                    <div key={i} className="space-y-2">
                        <div className="flex justify-between">
                            <div className="h-2.5 bg-slate-50 rounded-full w-24" />
                            <div className="h-2.5 bg-slate-100 rounded-full w-14" />
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-100 rounded-full" style={{ width: `${w}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
