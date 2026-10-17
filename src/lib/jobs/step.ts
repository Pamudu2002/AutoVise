/**
 * A named unit of work. Inngest passes `step.run` (retried and memoised per step); local in-process
 * runs pass `directStep`. Step results must be JSON-serialisable.
 */
export type Step = <T>(name: string, fn: () => Promise<T>) => Promise<T>;

export const directStep: Step = (_name, fn) => fn();
