import { Global, Injectable, Logger } from "@nestjs/common";
import * as CONSTANTS from "../constants";
import { wrap } from "module";

type Task<T = any> = () => Promise<T>

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  private readonly concurrency = CONSTANTS.CONCURRENCY;
  private readonly maxPending = CONSTANTS.MAX_PENDING;

  private readonly queue: Task[] = [];
  private activeCount = 0;

  public add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (this.queue.length >= this.maxPending) {
        return reject(new Error('System queue is full'));
      }

      const wrappedTask = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeCount--;
          this.next();
        }
      };

      this.queue.push(wrappedTask);

      if (this.activeCount < this.concurrency) {
        this.next();
      }
    })
  }

  private next() {
    if (this.activeCount < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();

      if (task) {
        task().catch(error => this.logger.error(`Task execution failed: ${error}`));

        this.next();
      }
    }
  }

  public isBusy(): boolean {
    return this.queue.length >= this.maxPending;
  }

  getStatus() {
    return {
      active: this.activeCount,
      pending: this.queue.length,
      concurrency: this.concurrency,
      maxPending: this.maxPending,
    }

  }
}