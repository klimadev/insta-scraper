import { logger } from './logger';

interface OperationMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  metadata?: Record<string, any>;
}

interface SessionMetrics {
  operations: Map<string, OperationMetrics[]>;
  errors: Map<string, number>;
  startTime: number;
}

export class MetricsCollector {
  private session: SessionMetrics;
  private currentOperations: Map<string, number> = new Map();

  constructor() {
    this.session = {
      operations: new Map(),
      errors: new Map(),
      startTime: Date.now()
    };
  }

  startOperation(name: string): void {
    this.currentOperations.set(name, Date.now());
  }

  endOperation(name: string, metadata?: Record<string, any>): void {
    const startTime = this.currentOperations.get(name);
    if (!startTime) return;

    const endTime = Date.now();
    const duration = endTime - startTime;

    const operation: OperationMetrics = {
      startTime,
      endTime,
      duration,
      success: true,
      metadata
    };

    if (!this.session.operations.has(name)) {
      this.session.operations.set(name, []);
    }
    this.session.operations.get(name)!.push(operation);

    this.currentOperations.delete(name);
  }

  recordError(operationName: string): void {
    const currentCount = this.session.errors.get(operationName) || 0;
    this.session.errors.set(operationName, currentCount + 1);

    const startTime = this.currentOperations.get(operationName);
    if (startTime) {
      const operation: OperationMetrics = {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success: false
      };

      if (!this.session.operations.has(operationName)) {
        this.session.operations.set(operationName, []);
      }
      this.session.operations.get(operationName)!.push(operation);

      this.currentOperations.delete(operationName);
    }
  }

  getTotalOperations(): number {
    let total = 0;
    this.session.operations.forEach(ops => total += ops.length);
    return total;
  }

  getSuccessfulOperations(): number {
    let total = 0;
    this.session.operations.forEach(ops => {
      total += ops.filter(op => op.success).length;
    });
    return total;
  }

  getFailedOperations(): number {
    let total = 0;
    this.session.errors.forEach(count => total += count);
    return total;
  }

  getAverageDuration(operationName: string): number {
    const operations = this.session.operations.get(operationName);
    if (!operations || operations.length === 0) return 0;

    const successful = operations.filter(op => op.success && op.duration);
    if (successful.length === 0) return 0;

    const total = successful.reduce((sum, op) => sum + (op.duration || 0), 0);
    return Math.round(total / successful.length);
  }

  getSessionDuration(): number {
    return Date.now() - this.session.startTime;
  }

  printSummary(): void {
    const sessionDuration = this.getSessionDuration();
    const totalOps = this.getTotalOperations();
    const successful = this.getSuccessfulOperations();
    const failed = this.getFailedOperations();

    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║           METRICAS DA SESSAO             ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║ Duracao: ${this.formatDuration(sessionDuration).padEnd(32)} ║`);
    console.log(`║ Operacoes: ${String(totalOps).padEnd(30)} ║`);
    console.log(`║ Sucesso: ${String(successful).padEnd(32)} ║`);
    console.log(`║ Falhas: ${String(failed).padEnd(33)} ║`);
    console.log('╠══════════════════════════════════════════╣');

    this.session.operations.forEach((ops, name) => {
      const avgDuration = this.getAverageDuration(name);
      const opCount = ops.length;
      console.log(`║ ${name.padEnd(15)}: ${String(opCount).padEnd(3)} ops | ${this.formatDuration(avgDuration).padEnd(12)} ║`);
    });

    console.log('╚══════════════════════════════════════════╝');
    console.log('');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}
