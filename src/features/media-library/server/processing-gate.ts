import 'server-only';
export class ProcessingBusy extends Error {
  constructor() {
    super('O processamento está ocupado. Tente novamente.');
  }
}
export class ProcessingGate {
  private active = false;
  private waiting?: () => void;
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.active) {
      if (this.waiting) throw new ProcessingBusy();
      await new Promise<void>((resolve) => {
        this.waiting = resolve;
      });
    } else this.active = true;
    try {
      return await operation();
    } finally {
      const resume = this.waiting;
      this.waiting = undefined;
      if (resume) resume();
      else this.active = false;
    }
  }
}
