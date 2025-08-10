"use client";

import { useMemo, useState } from "react";
import MonthCalendar from "@/components/admin/MonthCalendar";
import { ymdLocal, parseYmdLocal } from "@/lib/date";

type Employee = { id: string; full_name: string | null; role: "admin" | "employee" };
type DayOff = { employee_id: string; date: string };

export default function AdminUI({
    employees,
    initialDaysOff,
    monthStart,
    monthEnd,
}: {
    employees: Employee[];
    initialDaysOff: DayOff[];
    monthStart: string;
    monthEnd: string;
}) {
    const [selectedEmp, setSelectedEmp] = useState<string>(employees[0]?.id ?? "");
    const [daysOff, setDaysOff] = useState<DayOff[]>(initialDaysOff);
    const [month, setMonth] = useState<Date>(new Date());

    // ----- INVITE -----
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviteRole, setInviteRole] = useState<"employee" | "admin">("employee");
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
                }),
            });
            const ct = res.headers.get("content-type") || "";
            const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
            if (!res.ok) throw new Error(payload?.error || `Invite failed (${res.status})`);
            alert("Invitación enviada ✅");
            setInviteEmail("");
            setInviteName("");
            setInviteRole("employee");
        } catch (e: any) {
            alert(e.message || "Error enviando invitación");
        } finally {
            setInviteLoading(false);
        }
    }

    // ----- AGENDA SEMANAL -----
    const [weekStart, setWeekStart] = useState<string>(""); // YYYY-MM-DD (lunes)
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>(employees.map(e => e.id));
    const [overwrite, setOverwrite] = useState(true);
    const [building, setBuilding] = useState(false);

    const employeeById = useMemo(() => {
        const r: Record<string, string | null> = {};
        for (const e of employees) r[e.id] = e.full_name;
        return r;
    }, [employees]);

    async function toggleFranco(dateStr: string, willTurnOn: boolean) {
        // optimistic UI
        setDaysOff(prev => {
            if (willTurnOn) return [...prev, { employee_id: selectedEmp, date: dateStr }];
            return prev.filter(d => !(d.employee_id === selectedEmp && d.date === dateStr));
        });

        const res = await fetch("/api/days-off", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employee_id: selectedEmp, date: dateStr, on: willTurnOn }),
        });
        const ct = res.headers.get("content-type") || "";
        const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
        if (!res.ok) {
            // rollback
            setDaysOff(prev => {
                if (willTurnOn) return prev.filter(d => !(d.employee_id === selectedEmp && d.date === dateStr));
                return [...prev, { employee_id: selectedEmp, date: dateStr }];
            });
            alert(payload?.error || "Error guardando franco");
        }
    }

    function incMonth(n: number) {
        const d = new Date(month);
        d.setMonth(d.getMonth() + n);
        setMonth(d);
    }

    function weekDates(weekStartStr: string) {
        if (!weekStartStr) return [];
        const start = parseYmdLocal(weekStartStr);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            return ymdLocal(d);
        });
    }

    async function buildSchedule() {
        if (!weekStart) return alert("Selecciona semana (lunes)");
        const s = parseYmdLocal(weekStart);
        const e = new Date(s);
        e.setDate(e.getDate() + 6);
        const weekEnd = ymdLocal(e);

        try {
            setBuilding(true);
            const res = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weekStart,
                    weekEnd,
                    start_time: startTime,
                    end_time: endTime,
                    employee_ids: selectedEmployees,
                    overwrite,
                }),
            });
            const ct = res.headers.get("content-type") || "";
            const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
            if (!res.ok) throw new Error(payload?.error || `Error generando agenda (${res.status})`);
            alert(`Agenda creada: ${payload.count} turnos`);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setBuilding(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* INVITE — arriba de todo */}
            <section className="ig-card ig-section">
                <div className="pb-3">
                    <h2 className="h2">Invitar empleado</h2>
                    <p className="text-sm" style={{ color: "var(--ig-text-dim)" }}>
                        Envía una invitación por email. Al aceptar, definirá su contraseña.
                    </p>
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Nombre completo</label>
                        <input className="ig-input" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ej: Ana Pérez" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Email</label>
                        <input className="ig-input" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="ana@example.com" />
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Rol</label>
                        <select className="ig-select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}>
                            <option value="employee">Empleado</option>
                            <option value="admin">Admin</option>
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
                <div className="grid gap-3 md:grid-cols-3">
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
                        <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(-1)}>← Mes anterior</button>
                        <button className="ig-btn ig-btn--ghost" onClick={() => setMonth(new Date())}>Hoy</button>
                        <button className="ig-btn ig-btn--ghost" onClick={() => incMonth(1)}>Mes siguiente →</button>
                    </div>
                    <div className="text-right text-sm md:self-end" style={{ color: "var(--ig-text-dim)" }}>
                        <span>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
                    </div>
                </div>
            </section>

            {/* Calendar */}
            <MonthCalendar
                month={month}
                selectedEmployeeId={selectedEmp}
                daysOff={daysOff}
                employeeById={employeeById}
                onToggle={toggleFranco}
            />

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
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Entrada</label>
                        <input
                            type="time"
                            className="ig-input"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Salida</label>
                        <input
                            type="time"
                            className="ig-input"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                        />
                    </div>

                    {/* Overwrite */}
                    <label className="flex items-center gap-2 h-[46px] px-3 rounded-[14px] border" style={{ background: "var(--ig-card)" }}>
                        <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={overwrite}
                            onChange={(e) => setOverwrite(e.currentTarget.checked)}
                        />
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
                                            month: yearMonth,               // "YYYY-MM"
                                            start_time: startTime,
                                            end_time: endTime,
                                            employee_ids: selectedEmployees,
                                            overwrite,
                                        }),
                                    });
                                    const ct = res.headers.get("content-type") || "";
                                    const payload = ct.includes("application/json") ? await res.json() : { error: await res.text() };
                                    if (!res.ok) throw new Error(payload?.error || `Error generando agenda (${res.status})`);
                                    alert(`Agenda del mes creada: ${payload.count} turnos`);
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
                                        setSelectedEmployees((prev) =>
                                            checked ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                                        )
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

        </div>
    );
}
