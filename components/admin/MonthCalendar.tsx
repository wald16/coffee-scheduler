"use client";

import { useMemo, useState } from "react";
import { ymdLocal } from "@/lib/date";

type DayOff = { employee_id: string; date: string; name?: string | null };

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addDays(date: Date, n: number) {
    const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

export default function MonthCalendar({
    month,               // any date inside the month we want to show
    selectedEmployeeId,  // who we're toggling for
    daysOff,             // all days_off of all employees in visible month
    employeeById,        // map: id -> display name
    onToggle,            // async (dateStr, willTurnOn) => Promise<void>
}: {
    month: Date;
    selectedEmployeeId: string;
    daysOff: DayOff[];
    employeeById: Record<string, string | null | undefined>;
    onToggle: (dateStr: string, willTurnOn: boolean) => Promise<void>;
}) {
    const [loadingDate, setLoadingDate] = useState<string | null>(null);

    // Build 6x7 grid
    const grid = useMemo(() => {
        const first = startOfMonth(month);
        const last = endOfMonth(month);
        const start = addDays(first, -((first.getDay() + 6) % 7)); // Monday-first grid
        return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }, [month]);

    // Index daysOff
    const byDate = useMemo(() => {
        const m = new Map<string, DayOff[]>();
        for (const d of daysOff) {
            const arr = m.get(d.date) || [];
            arr.push(d);
            m.set(d.date, arr);
        }
        return m;
    }, [daysOff]);

    const thisMonth = month.getMonth();
    const today = new Date();

    async function handleToggle(dateStr: string) {
        const mine = (byDate.get(dateStr) || []).some(d => d.employee_id === selectedEmployeeId);
        const willTurnOn = !mine;
        setLoadingDate(dateStr);
        try {
            await onToggle(dateStr, willTurnOn);
        } finally {
            setLoadingDate(null);
        }
    }

    return (
        <div className="ig-card ig-section">
            <div className="flex items-center justify-between pb-3">
                <h2 className="h2">Calendario mensual (francos)</h2>
                <div className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                    Click para alternar franco del empleado seleccionado
                </div>
            </div>

            <div className="grid grid-cols-7 text-xs mb-2" style={{ color: "var(--ig-text-dim)" }}>
                <div className="py-1 text-center">Lun</div>
                <div className="py-1 text-center">Mar</div>
                <div className="py-1 text-center">Mié</div>
                <div className="py-1 text-center">Jue</div>
                <div className="py-1 text-center">Vie</div>
                <div className="py-1 text-center">Sáb</div>
                <div className="py-1 text-center">Dom</div>
            </div>

            <div className="grid grid-cols-7 gap-2">
                {grid.map((d) => {
                    const ds = ymdLocal(d);
                    const others = byDate.get(ds) || [];
                    const isMine = others.some(o => o.employee_id === selectedEmployeeId);
                    const faded = d.getMonth() !== thisMonth;
                    const isToday = sameDay(d, today);
                    const count = others.length;

                    return (
                        <button
                            key={ds}
                            onClick={() => handleToggle(ds)}
                            disabled={!!loadingDate}
                            title={
                                count
                                    ? `Francos: ${others.map(o => employeeById[o.employee_id] || o.employee_id).join(", ")}`
                                    : "Sin francos"
                            }
                            className={`relative h-20 rounded-[14px] border text-left p-2 transition
                          ${faded ? "opacity-50" : ""}
                          ${isMine ? "text-[var(--ig-text-inv)]" : ""}
                        `}
                            style={{
                                background: isMine ? "var(--ig-grad)" : "var(--ig-card)",
                                borderColor: "var(--ig-line)",
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className={`text-sm ${isMine ? "opacity-90" : ""}`}>
                                    {d.getDate()}
                                </div>
                                {isToday && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                        style={{ background: "#232429", color: "#cfd3db", borderColor: "var(--ig-line)" }}>
                                        Hoy
                                    </span>
                                )}
                            </div>

                            {/* Counter pill (who's off) */}
                            <div className="absolute bottom-2 left-2 flex items-center gap-1">
                                {count > 0 && (
                                    <span className="ig-badge" style={{
                                        background: isMine ? "rgba(0,0,0,.15)" : "#232429",
                                        color: isMine ? "var(--ig-text-inv)" : "#cfd3db",
                                    }}>
                                        {count} {count === 1 ? "franco" : "francos"}
                                    </span>
                                )}
                            </div>

                            {/* Loading shimmer */}
                            {loadingDate === ds && (
                                <div className="absolute inset-0 rounded-[14px]"
                                    style={{ background: "rgba(0,0,0,.12)" }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
