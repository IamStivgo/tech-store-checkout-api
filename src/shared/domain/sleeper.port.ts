/** Waits between attempts, e.g. while polling the payment provider (injectable in tests). */
export interface Sleeper {
  sleep(milliseconds: number): Promise<void>;
}
