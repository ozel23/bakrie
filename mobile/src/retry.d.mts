export function retryDelay(attempt: number, random?: () => number): number;
export function failureState(status: number): string;
export function canAccessOffline(until: string, now?: number): boolean;
