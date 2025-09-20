export type Slot = "TM" | "TT";

export const SLOT_TM = { id: "TM" as const, start: "08:00", end: "15:00" };
export const SLOT_TT = { id: "TT" as const, start: "14:00", end: "21:00" };

export function timesForSlot(slot: Slot) {
    return slot === "TM" ? SLOT_TM : SLOT_TT;
}

export function slotFromStart(startHHMM: string): Slot {
    // criterio: si empieza antes de 14:00 => TM, si no => TT
    return startHHMM < SLOT_TT.start ? "TM" : "TT";
}

export function labelForShift(start?: string | null) {
    if (!start) return "";
    return slotFromStart(start.slice(0, 5));
}
