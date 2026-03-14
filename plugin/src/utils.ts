export function generateId(): string {
    return Math.random().toString(36).substring(2, 10);
}

export function getTodayDateString(): string {
    return new Date().toISOString().split("T")[0];
}

export function nowISO(): string {
    return new Date().toISOString();
}
