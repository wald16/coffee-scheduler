// Hash determinista -> HSL (mismo color siempre para el mismo id)
export function colorForPersonKey(key: string) {
    if (key === "franco") {
        // Strong, saturated red
        const h = 0;     // hue 0 = red
        const s = 90;    // high saturation
        const l = 45;    // mid lightness for contrast
        return `hsl(${h}deg ${s}% ${l}%)`;
    }
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    const s = 68; // %
    const l = 46; // %
    return `hsl(${h}deg ${s}% ${l}%)`;
}

// HSL -> RGB -> ARGB para ExcelJS
function hslToRgb(h: number, s: number, l: number) {
    s /= 100; l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}
export function excelArgbFromHslString(hsl: string) {
    const m = /hsl\((\d+)deg\s+(\d+)%\s+(\d+)%\)/.exec(hsl);
    if (!m) return "FF999999";
    const [h, s, l] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const [r, g, b] = hslToRgb(h, s, l);
    const toHex = (v: number) => v.toString(16).padStart(2, "0").toUpperCase();
    return `FF${toHex(r)}${toHex(g)}${toHex(b)}`; // FF = alpha
}
