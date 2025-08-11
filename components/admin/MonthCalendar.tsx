"use client";

import { useMemo, useState } from "react";
import { ymdLocal } from "@/lib/date";

type DayOff = { employee_id: string; date: string };
type Shift = { date: string; start_time: string; end_time: string };

function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addDays(date: Date, n: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}
function sameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
function formatHM(t?: string | null) {
    if (!t) return "";
    return t.slice(0, 5); // HH:MM (oculta segundos)
}

export default function MonthCalendar({
    month, // cualquier fecha dentro del mes a mostrar
    selectedEmployeeId,
    daysOff, // francos de TODOS (para contador)
    employeeById, // map: id -> nombre (para tooltip)
    onToggle, // (dateStr, willTurnOn) => Promise<void>  (franco del seleccionado)
    shiftsForSelectedEmp, // turnos del empleado seleccionado en el mes
    onEditDay, // (dateStr, currentShiftOrNull) => void (abre editor)
}: {
    month: Date;
    selectedEmployeeId: string;
    daysOff: DayOff[];
    employeeById: Record<string, string | null | undefined>;
    onToggle: (dateStr: string, willTurnOn: boolean) => Promise<void>;
    shiftsForSelectedEmp: Shift[];
    onEditDay: (dateStr: string, current?: { start_time: string; end_time: string } | null) => void;
}) {
    const [loadingDate, setLoadingDate] = useState<string | null>(null);

    // Grilla 6x7 empezando lunes
    const grid = useMemo(() => {
        const first = startOfMonth(month);
        const start = addDays(first, -((first.getDay() + 6) % 7));
        return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    }, [month]);

    // Index de francos por fecha
    const offsByDate = useMemo(() => {
        const m = new Map<string, DayOff[]>();
        for (const d of daysOff) {
            const arr = m.get(d.date) || [];
            arr.push(d);
            m.set(d.date, arr);
        }
        return m;
    }, [daysOff]);

    // Index de shifts del empleado seleccionado
    const shiftByDate = useMemo(() => {
        const m = new Map<string, Shift>();
        for (const s of shiftsForSelectedEmp) m.set(s.date, s);
        return m;
    }, [shiftsForSelectedEmp]);

    const thisMonth = month.getMonth();
    const today = new Date();

    async function handleToggleFranco(dateStr: string) {
        const mine = (offsByDate.get(dateStr) || []).some(
            (d) => d.employee_id === selectedEmployeeId
        );
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
                <h2 className="h2">Calendario mensual</h2>
                <div className="text-xs flex items-center gap-3" style={{ color: "var(--ig-text-dim)" }}>
                    <span className="inline-flex items-center gap-1">
                        <i style={{ width: 10, height: 10, borderRadius: 3, background: "#ff4d4f", display: "inline-block" }} />
                        Franco
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <i style={{ width: 10, height: 10, borderRadius: 3, background: "#29c46a", display: "inline-block" }} />
                        Laboral
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--ig-card)", border: "1px solid var(--ig-line)", display: "inline-block" }} />
                        Sin asignar
                    </span>
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
                    const offs = offsByDate.get(ds) || [];
                    const isOffMine = offs.some((o) => o.employee_id === selectedEmployeeId);
                    const faded = d.getMonth() !== thisMonth;
                    const isToday = sameDay(d, today);
                    const countOffs = offs.length;

                    const shift = shiftByDate.get(ds) || null;
                    const hasShift = !!shift;

                    // Colores: rojo franco (mío) > verde laboral (mío) > neutro
                    let bg = "var(--ig-card)";
                    let fg = "inherit";
                    if (isOffMine) {
                        bg = "#ff4d4f"; // rojo franco
                        fg = "white";
                    } else if (hasShift) {
                        bg = "#29c46a"; // verde laboral
                        fg = "white";
                    }

                    const title =
                        isOffMine
                            ? "Franco (click para quitar)"
                            : hasShift
                                ? `Turno: ${formatHM(shift?.start_time)}–${formatHM(shift?.end_time)}`
                                : "Sin asignar (click para agregar turno)";

                    return (
                        <button
                            key={ds}
                            onClick={() => {
                                if (isOffMine) {
                                    // si es franco, click alterna franco
                                    handleToggleFranco(ds);
                                } else {
                                    // si NO es franco, abre editor de horario del día
                                    onEditDay(ds, shift ? { start_time: shift.start_time, end_time: shift.end_time } : null);
                                }
                            }}
                            disabled={!!loadingDate}
                            title={
                                countOffs
                                    ? `${title}\nFrancos: ${offs
                                        .map((o) => employeeById[o.employee_id] || o.employee_id)
                                        .join(", ")}`
                                    : title
                            }
                            className={`relative h-24 rounded-[14px] border text-left p-2 transition ${faded ? "opacity-50" : ""
                                }`}
                            style={{ background: bg, color: fg, borderColor: "var(--ig-line)" }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-sm">{d.getDate()}</div>
                                {isToday && (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full border"
                                        style={{
                                            background: isOffMine || hasShift ? "rgba(0,0,0,.25)" : "#232429",
                                            borderColor: "rgba(255,255,255,.35)",
                                        }}
                                    >
                                        Hoy
                                    </span>
                                )}
                            </div>

                            {/* horarios visibles cuando es laboral */}
                            {!isOffMine && hasShift && (
                                <div className="absolute left-2 right-2 bottom-2 text-[11px] opacity-95">
                                    {shift?.start_time ? (shift.start_time.slice(0, 2) < "14" ? "TM" : "TT") : ""}
                                </div>
                            )}

                            {/* contador de francos (otros) */}
                            {countOffs > 0 && (
                                <div className="absolute top-2 right-1">
                                    <span
                                        className="ig-badge"
                                        style={{
                                            background: isOffMine || hasShift ? "rgba(0,0,0,.15)" : "#232429",
                                            color: isOffMine || hasShift ? "white" : "#cfd3db",
                                            borderColor: "var(--ig-line)",
                                        }}
                                    >
                                        {countOffs} {countOffs === 1 ? "franco" : "francos"}
                                    </span>
                                </div>
                            )}

                            {/* loading overlay */}
                            {loadingDate === ds && (
                                <div
                                    className="absolute inset-0 rounded-[14px]"
                                    style={{ background: "rgba(0,0,0,.12)" }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            <p className="mt-2 text-xs" style={{ color: "var(--ig-text-dim)" }}>
                Tip: Click en un día <strong>con franco</strong> alterna el franco. Click en un día <strong>sin
                    franco</strong> abre el editor para asignar/editar horario.
            </p>
        </div >
    );
}
