"use client";
import { useState } from "react";
type Employee = { id: string; full_name: string | null; role: "admin" | "employee" };

function Section({ title, subtitle, children }: {
    title: string; subtitle?: string; children: React.ReactNode
}) {
    return (
        <section className="ig-card ig-section">
            <div className="pb-4">
                <h2 className="h2">{title}</h2>
                {subtitle && <p className="text-sm" style={{ color: "var(--ig-text-dim)" }}>{subtitle}</p>}
            </div>
            {children}
        </section>
    );
}

export default function AdminClient({ employees }: { employees: Employee[] }) {
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteName, setInviteName] = useState("");
    const [inviteRole, setInviteRole] = useState<"admin" | "employee">("employee");
    const [inviteLoading, setInviteLoading] = useState(false);

    const [selectedEmp, setSelectedEmp] = useState<string>(employees[0]?.id ?? "");
    const [weekStart, setWeekStart] = useState<string>("");
    const [francos, setFrancos] = useState<Record<string, boolean>>({});

    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>(employees.map(e => e.id));
    const [overwrite, setOverwrite] = useState(true);
    const [building, setBuilding] = useState(false);

    function weekDates() {
        if (!weekStart) return [];
        const s = new Date(weekStart);
        return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
    }
    const dates = weekDates();

    async function invite() {
        try {
            setInviteLoading(true);
            const res = await fetch("/api/invite", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail, full_name: inviteName, role: inviteRole })
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Invite failed");
            setInviteEmail(""); setInviteName("");
            alert("Invitación enviada");
        } catch (e: any) { alert(e.message); } finally { setInviteLoading(false); }
    }

    async function saveFrancos() {
        if (!selectedEmp || !weekStart) return alert("Selecciona empleado y semana");
        const ds = weekDates();
        const selected = ds.filter(d => francos[d]);

        const start = new Date(weekStart);
        const end = new Date(start); end.setDate(start.getDate() + 6);

        const res = await fetch("/api/francos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                employee_id: selectedEmp,
                weekStart: weekStart,
                weekEnd: end.toISOString().slice(0, 10),
                dates: selected
            }),
        });

        let j: any = {};
        try { j = await res.json(); } catch { }
        if (!res.ok) return alert(j.error || "Error guardando francos");
        alert("Francos guardados");
    }


    async function buildSchedule() {
        if (!weekStart) return alert("Selecciona semana (lunes)");
        const s = new Date(weekStart); const e = new Date(s); e.setDate(s.getDate() + 6);
        try {
            setBuilding(true);
            const res = await fetch("/api/schedule", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    weekStart,
                    weekEnd: e.toISOString().slice(0, 10),
                    start_time: startTime,
                    end_time: endTime,
                    employee_ids: selectedEmployees,
                    overwrite
                })
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.error || "Error generando agenda");
            alert(`Agenda creada: ${j.count} turnos`);
        } catch (e: any) { alert(e.message); } finally { setBuilding(false); }
    }

    return (
        <div className="space-y-6">
            {/* Invite */}
            <Section title="Invitar empleado" subtitle="Crea usuarios por email y asigna su rol.">
                <div className="grid gap-3 md:grid-cols-5">
                    <input className="ig-input" placeholder="Nombre" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                    <input className="ig-input md:col-span-2" placeholder="email@empresa.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                    <select className="ig-select" value={inviteRole} onChange={e => setInviteRole(e.target.value as any)}>
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
                    </select>
                    <button onClick={invite} disabled={inviteLoading} className="ig-btn ig-btn--primary">
                        {inviteLoading ? "Enviando…" : "Invitar"}
                    </button>
                </div>
            </Section>

            {/* Francos */}
            <Section title="Francos (semana)" subtitle="Marca los días libres para la semana seleccionada.">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px]">
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Empleado</label>
                        <select className="ig-select" value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                            {employees.map(e => (
                                <option key={e.id} value={e.id}>{e.full_name || e.id} {e.role === "admin" ? "(admin)" : ""}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Lunes de la semana</label>
                        <input type="date" className="ig-input" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                    </div>
                    <div className="ml-auto">
                        <button onClick={saveFrancos} className="ig-btn ig-btn--ghost">Guardar francos</button>
                    </div>
                </div>

                {dates.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-7 gap-2">
                        {dates.map(d => {
                            const on = !!francos[d];
                            return (
                                <button
                                    key={d}
                                    onClick={() => setFrancos(prev => ({ ...prev, [d]: !on }))}
                                    className={`h-10 rounded-[14px] border text-sm px-3 ${on ? "text-[var(--ig-text-inv)]" : ""}`}
                                    style={{
                                        background: on ? "var(--ig-grad)" : "var(--ig-card)",
                                        borderColor: "var(--ig-line)"
                                    }}
                                >
                                    {new Date(d).toLocaleDateString()}
                                </button>
                            );
                        })}
                    </div>
                )}
            </Section>

            {/* Schedule */}
            <Section title="Agenda semanal" subtitle="Genera turnos (omite francos automáticamente).">
                <div className="grid md:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Inicio (lunes)</label>
                        <input type="date" className="ig-input" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Entrada</label>
                        <input type="time" className="ig-input" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm mb-1" style={{ color: "var(--ig-text-dim)" }}>Salida</label>
                        <input type="time" className="ig-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 h-[46px] px-3 rounded-[14px] border" style={{ background: "var(--ig-card)" }}>
                        <input type="checkbox" className="h-4 w-4" checked={overwrite} onChange={e => setOverwrite(e.currentTarget.checked)} />
                        <span className="text-sm" style={{ color: "var(--ig-text)" }}>Sobrescribir semana</span>
                    </label>
                    <div className="md:col-span-2">
                        <button onClick={buildSchedule} disabled={building} className="ig-btn ig-btn--primary w-full">
                            {building ? "Generando…" : "Generar agenda"}
                        </button>
                    </div>
                </div>

                <div className="mt-4">
                    <div className="text-sm mb-2" style={{ color: "var(--ig-text-dim)" }}>Empleados incluidos</div>
                    <div className="flex flex-wrap gap-2">
                        {employees.map(e => {
                            const checked = selectedEmployees.includes(e.id);
                            return (
                                <button
                                    key={e.id}
                                    onClick={() => setSelectedEmployees(prev => checked ? prev.filter(id => id !== e.id) : [...prev, e.id])}
                                    className="ig-badge"
                                    style={{
                                        background: checked ? "var(--ig-grad)" : "#232429",
                                        color: checked ? "var(--ig-text-inv)" : "#cfd3db",
                                        borderColor: "var(--ig-line)"
                                    }}
                                >
                                    {e.full_name || e.id}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </Section>
        </div>
    );
}
