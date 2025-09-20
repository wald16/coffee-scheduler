"use client";

import { useEffect, useMemo, useState } from "react";

// helpers de calendario local
function ymdLocal(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function parseYmdLocal(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function monthBounds(d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { start: ymdLocal(start), end: ymdLocal(end) };
}
function addDays(date: Date, n: number) {
    const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function formatHour(h?: string | null) {
    if (!h) return "";
    return h.slice(0, 5);
}
type Shift = { id: number; date: string; start_time: string; end_time: string; notes?: string | null };
type Off = { date: string };

export default function CalendarMyShifts() {
    const [month, setMonth] = useState<Date>(new Date());
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [offs, setOffs] = useState<Off[]>([]);
    const [loading, setLoading] = useState(false);

    const { start, end } = useMemo(() => monthBounds(month), [month]);

    // cargar datos del mes actual
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/my-calendar", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ start, end }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error");
                setShifts(data.shifts || []);
                setOffs(data.daysOff || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, [start, end]);

    // index por fecha
    const offSet = useMemo(() => new Set(offs.map(o => o.date)), [offs]);
    const shiftsByDate = useMemo(() => {
        const m = new Map<string, Shift[]>();
        for (const s of shifts) {
            const arr = m.get(s.date) || [];
            arr.push(s);
            m.set(s.date, arr);
        }
        return m;
    }, [shifts]);

    // grilla 6x7 comenzando en lunes
    const grid = useMemo(() => {
        const first = parseYmdLocal(start);
        const startCell = addDays(first, -((first.getDay() + 6) % 7));
        return Array.from({ length: 42 }, (_, i) => addDays(startCell, i));
    }, [start]);

    function incMonth(n: number) {
        const d = new Date(month);
        d.setMonth(d.getMonth() + n);
        setMonth(d);
    }

    const thisMonth = month.getMonth();
    const todayYmd = ymdLocal(new Date());

    return (
        <div className="ig-card ig-section">
            <div className="flex items-center justify-between pb-3">
                <h2 className="h2">Mi calendario</h2>
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--ig-text-dim)" }}>
                    <span className="inline-flex items-center gap-1">
                        <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#29c46a" }} /> Laboral
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: "#ff4d4f" }} /> Franco
                    </span>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center mb-3">
                <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(-1)}>← Mes anterior</button>
                <div className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                    {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </div>
                <div className="flex justify-end gap-2">
                    <button className="ig-btn ig-btn--ghost" onClick={() => setMonth(new Date())}>Hoy</button>
                    <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(1)}>Mes siguiente →</button>
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
                    const faded = d.getMonth() !== thisMonth;
                    const isOff = offSet.has(ds);
                    const dayShifts = shiftsByDate.get(ds) || [];
                    const hasShift = dayShifts.length > 0;
                    const isToday = ds === todayYmd;

                    // prioridad: franco (rojo) sobre laboral (verde)
                    const bg = isOff ? "#ff4d4f" : hasShift ? "#29c46a" : "var(--ig-card)";
                    const fg = isOff || hasShift ? "white" : "inherit";

                    return (
                        <div
                            key={ds}
                            className={`h-24 rounded-[14px] border p-2 relative transition ${faded ? "opacity-50" : ""}`}
                            style={{ background: bg, color: fg, borderColor: "var(--ig-line)" }}
                            title={
                                isOff
                                    ? "Franco"
                                    : hasShift
                                        ? dayShifts.map(s => `${s.start_time}–${s.end_time}${s.notes ? " · " + s.notes : ""}`).join("\n")
                                        : "Sin turnos"
                            }
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-sm">{d.getDate()}</div>
                                {isToday && (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                        style={{ background: "rgba(0,0,0,.25)", borderColor: "rgba(255,255,255,.35)" }}
                                    >
                                        Hoy
                                    </span>
                                )}
                            </div>

                            {/* listado rápido de horarios (máx 2 líneas) */}
                            {hasShift && !isOff && (
                                <div className="absolute left-2 right-2 bottom-2 text-[11px] opacity-95 line-clamp-2">
                                    {dayShifts.map((s, i) => (
                                        <div key={s.id || i}>
                                            {formatHour(s.start_time)} – {formatHour(s.end_time)}{s.notes ? ` · ${s.notes}` : ""}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {loading && (
                <div className="mt-3 text-xs" style={{ color: "var(--ig-text-dim)" }}>
                    Cargando…
                </div>
            )}
        </div>
    );
}
