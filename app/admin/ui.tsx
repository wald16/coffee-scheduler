"use client";

import { useEffect, useMemo, useState } from "react";
import MonthCalendar from "@/components/admin/MonthCalendar";
import { ymdLocal } from "@/lib/date";
import { timesForSlot } from "@/lib/shifts";

type Employee = { id: string; full_name: string | null; role: "admin" | "employee" };
type DayOff = { employee_id: string; date: string };
type Shift = { date: string; start_time: string; end_time: string };

export default function AdminUI({
    employees,
    initialDaysOff,
}: {
    employees: Employee[];
    initialDaysOff: DayOff[];
    monthStart: string;
    monthEnd: string;
}) {
    const [selectedEmp, setSelectedEmp] = useState<string>(employees[0]?.id ?? "");
    const [daysOff, setDaysOff] = useState<DayOff[]>(initialDaysOff);
    const [month, setMonth] = useState<Date>(new Date());
    const [monthSlot, setMonthSlot] = useState<"TM" | "TT">("TM");
    const t = timesForSlot(monthSlot);

    // --- INVITE ---
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviteRole, setInviteRole] = useState<"employee" | "admin">("employee");
    const [jobRole, setJobRole] = useState<"caja" | "camarero" | "runner_bacha">("camarero"); // ⬅️ NUEVO
    const [inviteLoading, setInviteLoading] = useState(false);

    async function sendInvite() {
        if (!inviteEmail) return alert("Email requerido");
        try {
            setInviteLoading(true);
            const res = await fetch("/api/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: inviteEmail.trim(),
                    full_name: inviteName.trim() || null,
                    role: inviteRole,
                    job_role: jobRole, // ⬅️ NUEVO
                }),
            });
            const ct = res.headers.get("content-type") || "";
            const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
            if (!res.ok) throw new Error(payload?.error || `Invite failed (${res.status})`);
            alert("Invitación enviada ✅");
            setInviteEmail("");
            setInviteName("");
            setInviteRole("employee");
            setJobRole("camarero"); // ⬅️ reset
        } catch (e: any) {
            alert(e.message || "Error enviando invitación");
        } finally {
            setInviteLoading(false);
        }
    }

    // --- SHIFTS DEL EMPLEADO SELECCIONADO ---
    const [empShifts, setEmpShifts] = useState<Shift[]>([]);
    const [loadingShifts, setLoadingShifts] = useState(false);

    function monthBounds(d: Date) {
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return { start: ymdLocal(start), end: ymdLocal(end) };
    }

    useEffect(() => {
        async function load() {
            if (!selectedEmp) return;
            const { start, end } = monthBounds(month);
            setLoadingShifts(true);
            try {
                const res = await fetch("/api/employee-month", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employee_id: selectedEmp, start, end }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || "Error cargando horarios");
                setEmpShifts(data.shifts || []);
            } catch (e) {
                console.error(e);
                setEmpShifts([]);
            } finally {
                setLoadingShifts(false);
            }
        }
        load();
    }, [selectedEmp, month]);

    // Mapa id -> nombre (tooltips de francos)
    const employeeById = useMemo(() => {
        const r: Record<string, string | null> = {};
        for (const e of employees) r[e.id] = e.full_name;
        return r;
    }, [employees]);

    // Alternar franco (del empleado seleccionado)
    async function toggleFranco(dateStr: string, willTurnOn: boolean) {
        setDaysOff(prev => (willTurnOn ? [...prev, { employee_id: selectedEmp, date: dateStr }] : prev.filter(d => !(d.employee_id === selectedEmp && d.date === dateStr))));
        if (willTurnOn) setEmpShifts(prev => prev.filter(s => s.date !== dateStr));

        const res = await fetch("/api/days-off", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: selectedEmp, date: dateStr, on: willTurnOn }),
        });
        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
        if (!res.ok) {
            setDaysOff(prev => (willTurnOn ? prev.filter(d => !(d.employee_id === selectedEmp && d.date === dateStr)) : [...prev, { employee_id: selectedEmp, date: dateStr }]));
            alert(payload?.error || "Error guardando franco");
            return;
        }
        if (willTurnOn) {
            try {
                await fetch("/api/shift-day", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employee_id: selectedEmp, date: dateStr }),
                });
            } catch { }
        }
    }

    function incMonth(n: number) {
        const d = new Date(month);
        d.setMonth(d.getMonth() + n);
        setMonth(d);
    }

    // --- EDITOR DE DÍA ---
    const [editor, setEditor] = useState<{ open: boolean; date: string; start: string; end: string }>({
        open: false,
        date: "",
        start: "09:00",
        end: "17:00",
    });
    const isOffThisDay = editor.open && daysOff.some(d => d.employee_id === selectedEmp && d.date === editor.date);

    function openEditor(date: string, current?: { start_time: string; end_time: string } | null) {
        setEditor({
            open: true,
            date,
            start: (current?.start_time || "09:00").slice(0, 5),
            end: (current?.end_time || "17:00").slice(0, 5),
        });
    }

    async function saveEditor() {
        if (!editor.date) return;
        if (editor.start >= editor.end) return alert("Inicio debe ser menor que Fin");
        setEmpShifts(prev => {
            const rest = prev.filter(s => s.date !== editor.date);
            return [...rest, { date: editor.date, start_time: editor.start, end_time: editor.end }];
        });
        const res = await fetch("/api/shift-day", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: selectedEmp,
                date: editor.date,
                start_time: editor.start,
                end_time: editor.end,
            }),
        });
        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
        if (!res.ok) {
            setEmpShifts(prev => prev.filter(s => s.date !== editor.date));
            alert(payload?.error || "Error guardando turno");
            return;
        }
        setEditor(e => ({ ...e, open: false }));
    }

    async function removeShiftForDay() {
        if (!editor.date) return;
        setEmpShifts(prev => prev.filter(s => s.date !== editor.date));
        const res = await fetch("/api/shift-day", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: selectedEmp, date: editor.date }),
        });
        if (!res.ok) alert("No se pudo eliminar el turno");
        setEditor(e => ({ ...e, open: false }));
    }

    async function toggleFrancoFromEditor() {
        if (!editor.date) return;
        const willTurnOn = !isOffThisDay;
        setDaysOff(prev => (willTurnOn ? [...prev, { employee_id: selectedEmp, date: editor.date }] : prev.filter(d => !(d.employee_id === selectedEmp && d.date === editor.date))));
        if (willTurnOn) setEmpShifts(prev => prev.filter(s => s.date !== editor.date));

        const res = await fetch("/api/days-off", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: selectedEmp, date: editor.date, on: willTurnOn }),
        });
        if (!res.ok) {
            setDaysOff(prev => (willTurnOn ? prev.filter(d => !(d.employee_id === selectedEmp && d.date === editor.date)) : [...prev, { employee_id: selectedEmp, date: editor.date }]));
            alert("No se pudo actualizar el franco");
            return;
        }
        if (willTurnOn) {
            try {
                await fetch("/api/shift-day", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ employee_id: selectedEmp, date: editor.date }),
                });
            } catch { }
            setEditor(e => ({ ...e, open: false }));
        }
    }

    // --- AGENDA MENSUAL ---
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>(employees.map(e => e.id));
    const [overwrite, setOverwrite] = useState(true);
    const [building, setBuilding] = useState(false);
    const [exportWeekByEmp, setExportWeekByEmp] = useState<string>(""); // o usa exportWeek
    const [showHours, setShowHours] = useState(true);


    return (
        <div className="space-y-6">
            {/* INVITE */}
            <section className="ig-card ig-section">
                <div className="pb-3">
                    <h2 className="h2">Invitar empleado</h2>
                    <p className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                        Envía una invitación por email. Al aceptar, definirá su contraseña.
                    </p>
                </div>

                <div className="grid md:grid-cols-5 gap-3">{/* ⬅️ cambié a 5 columnas */}
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Nombre completo</label>
                        <input className="ig-input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ej: Ana Pérez" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Email</label>
                        <input className="ig-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="ana@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Rol (permisos)</label>
                        <select className="ig-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                            <option value="employee">Empleado</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    {/* ⬇️ NUEVO: Puesto */}
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Puesto</label>
                        <select className="ig-select" value={jobRole} onChange={(e) => setJobRole(e.target.value as any)}>
                            <option value="caja">Caja</option>
                            <option value="camarero">Camarero/a</option>
                            <option value="runner_bacha">Runner/Bacha</option>
                        </select>
                    </div>
                </div>

                <div className="mt-3">
                    <button className="ig-btn ig-btn--primary" onClick={sendInvite} disabled={inviteLoading}>
                        {inviteLoading ? "Enviando…" : "Enviar invitación"}
                    </button>
                </div>
            </section>

            {/* Top controls */}
            <section className="ig-card ig-section">
                <div className="pb-3"><h2 className="h2">EDITAR HORARIOS</h2></div>
                <div className="grid gap-3 md:grid-cols-3 my-6">
                    <div>
                        <div className="text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Empleado</div>
                        <select className="ig-select" value={selectedEmp} onChange={(e) => setSelectedEmp(e.target.value)}>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>
                                    {e.full_name || e.id} {e.role === "admin" ? "(admin)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-end gap-2">
                        <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(-1)}>Mes anterior</button>
                        <button className="ig-btn ig-btn--ghost" onClick={() => setMonth(new Date())}>Hoy</button>
                        <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(1)}>Mes siguiente</button>
                    </div>
                    <div className="text-right text-sm md:self-end" style={{ color: "var(--ig-text-dim)" }}>
                        <span>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                    </div>
                </div>


                {/* Calendar */}
                <MonthCalendar
                    month={month}
                    selectedEmployeeId={selectedEmp}
                    daysOff={daysOff}
                    employeeById={employeeById}
                    onToggle={toggleFranco}
                    shiftsForSelectedEmp={empShifts}
                    onEditDay={(date, current) => openEditor(date, current)}
                />
            </section>
            {/* Agenda mensual */}
            <section className="ig-card ig-section">
                <div className="pb-3">
                    <h2 className="h2">Agenda mensual</h2>
                    <p className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                        Genera turnos para todo el mes seleccionado (omite francos automáticamente).
                    </p>
                </div>

                <div className="grid md:grid-cols-6 gap-3">
                    {/* Selector de mes */}
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Mes</label>
                        <input
                            type="month"
                            className="ig-input"
                            value={month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0")}
                            onChange={(e) => {
                                const [yy, mm] = e.target.value.split("-").map(Number);
                                if (yy && mm) setMonth(new Date(yy, mm - 1, 1));
                            }}
                        />
                    </div>

                    {/* Horarios */}
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Turno</label>
                        <div className="flex gap-2">
                            <button type="button"
                                className={`ig-btn ${monthSlot === "TM" ? "ig-btn--primary" : "ig-btn--ghost"}`}
                                onClick={() => setMonthSlot("TM")}>TM</button>
                            <button type="button"
                                className={`ig-btn ${monthSlot === "TT" ? "ig-btn--primary" : "ig-btn--ghost"}`}
                                onClick={() => setMonthSlot("TT")}>TT</button>
                        </div>
                    </div>


                    {/* Overwrite */}
                    <label className="flex items-center gap-2 h-[46px] px-3 rounded-[14px] border" style={{ background: "var(--ig-card)" }}>
                        <input type="checkbox" className="h-4 w-4" checked={overwrite} onChange={(e) => setOverwrite(e.currentTarget.checked)} />
                        <span className="text-sm">Sobrescribir mes</span>
                    </label>

                    {/* Botón generar */}
                    <div className="md:col-span-2">
                        <button
                            onClick={async () => {
                                const yearMonth = month.getFullYear() + "-" + String(month.getMonth() + 1).padStart(2, "0");
                                try {
                                    setBuilding(true);
                                    const res = await fetch("/api/schedule-month", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            month: yearMonth,
                                            start_time: t.start,
                                            end_time: t.end,
                                            employee_ids: selectedEmployees,
                                            overwrite,
                                        }),
                                    });
                                    const ct = res.headers.get("content-type") || "";
                                    const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
                                    if (!res.ok) throw new Error(payload?.error || `Error generando agenda (${res.status})`);
                                    alert(`Agenda del mes creada: ${payload.count} turnos`);
                                    if (selectedEmployees.includes(selectedEmp)) {
                                        const { start, end } = monthBounds(month);
                                        const r2 = await fetch("/api/employee-month", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ employee_id: selectedEmp, start, end }),
                                        });
                                        const d2 = await r2.json();
                                        if (r2.ok) setEmpShifts(d2.shifts || []);
                                    }
                                } catch (e: any) {
                                    alert(e.message);
                                } finally {
                                    setBuilding(false);
                                }
                            }}
                            disabled={building}
                            className="ig-btn ig-btn--primary w-full"
                        >
                            {building ? "Generando…" : "Generar agenda mensual"}
                        </button>
                    </div>
                </div>

                {/* Chips de empleados incluidos */}
                <div className="mt-4">
                    <div className="text-sm mb-2" style={{ color: "var(--ig-text-dim)" }}>Empleados incluidos</div>
                    <div className="flex flex-wrap gap-2">
                        {employees.map((e) => {
                            const checked = selectedEmployees.includes(e.id);
                            return (
                                <button
                                    key={e.id}
                                    onClick={() =>
                                        setSelectedEmployees((prev) => (checked ? prev.filter((id) => id !== e.id) : [...prev, e.id]))
                                    }
                                    className="ig-badge"
                                    style={{
                                        background: checked ? "var(--ig-grad)" : "#232429",
                                        color: checked ? "var(--ig-text-inv)" : "#cfd3db",
                                        borderColor: "var(--ig-line)",
                                    }}
                                >
                                    {e.full_name || e.id}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>
            {/* Exportar semana */}
            <section className="ig-card ig-section">
                <div className="pb-1">
                    <h2 className="h3">Exportar semana</h2>
                </div>

                <div className="grid md:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Lunes de la semana</label>
                        <input type="date" className="ig-input" value={exportWeekByEmp} onChange={(e) => setExportWeekByEmp(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 h-[65px] px-3 rounded-[14px] border" style={{ background: "var(--ig-card)" }}>
                        <input type="checkbox" className="h-4 w-4" checked={showHours} onChange={(e) => setShowHours(e.currentTarget.checked)} />
                        <span className="text-sm">Mostrar horas (en lugar de TM/TT)</span>
                    </label>
                    <div className="md:col-span-2 flex items-end">
                        <button
                            className="ig-btn ig-btn--primary"
                            onClick={async () => {
                                if (!exportWeekByEmp) return alert("Selecciona el lunes de la semana");
                                const res = await fetch("/api/export/week-by-employee", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ weekStart: exportWeekByEmp, showHours, cutoff: "14:00" }),
                                });
                                if (!res.ok) {
                                    const { error } = await res.json().catch(() => ({ error: "Error" }));
                                    alert(error || "No se pudo exportar");
                                    return;
                                }
                                const blob = await res.blob();
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `agenda_por_empleado_${exportWeekByEmp}.xlsx`;
                                a.click();
                                URL.revokeObjectURL(url);
                            }}
                        >
                            Descargar Excel
                        </button>
                    </div>
                </div>
            </section>

            {/* Editor modal simple */}
            {
                editor.open && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        <div className="absolute inset-0 bg-black/40" onClick={() => setEditor(e => ({ ...e, open: false }))} />
                        <div className="relative z-10 w-full max-w-sm ig-card ig-section">
                            <h3 className="h2">Editar horario — {editor.date} {isOffThisDay ? "· (Franco)" : ""}</h3>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <button className="ig-btn ig-btn--ghost" onClick={() => setEditor(e => ({ ...e, start: "08:00", end: "15:00" }))}>
                                    TM
                                </button>
                                <button className="ig-btn ig-btn--ghost" onClick={() => setEditor(e => ({ ...e, start: "14:00", end: "21:00" }))}>
                                    TT
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Inicio</label>
                                    <input type="time" className="ig-input" value={editor.start} onChange={e => setEditor(ed => ({ ...ed, start: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Fin</label>
                                    <input type="time" className="ig-input" value={editor.end} onChange={e => setEditor(ed => ({ ...ed, end: e.target.value }))} />
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2">
                                <button className="ig-btn ig-btn--primary flex-1" onClick={saveEditor}>Guardar</button>
                                <button
                                    className="ig-btn ig-btn--primary"
                                    onClick={toggleFrancoFromEditor}
                                    title={isOffThisDay ? "Quitar franco" : "Franco"}
                                >
                                    {isOffThisDay ? "Quitar franco" : "Franco"}
                                </button>
                                <button className="ig-btn ig-btn--ghost" onClick={removeShiftForDay}>Eliminar turno</button>
                            </div>

                            <p className="mt-2 text-xs" style={{ color: "var(--ig-text-dim)" }}>
                                Si este día está marcado como <b>franco</b>, primero quitalo para poder asignar horario.
                            </p>
                        </div>
                    </div>
                )
            }

            {
                loadingShifts && (
                    <div className="text-xs" style={{ color: "var(--ig-text-dim)" }}>
                        Cargando horarios…
                    </div>
                )
            }
        </div >
    );
}
