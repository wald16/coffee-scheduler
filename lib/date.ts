export function ymdLocal(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function parseYmdLocal(s: string) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

export function formatYmdLocalLabel(s: string, locale?: string) {
    const date = parseYmdLocal(s);
    return date.toLocaleDateString(locale ?? undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}
