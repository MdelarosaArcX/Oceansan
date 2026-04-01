// copy.engine.ts
import { EventEmitter } from "events";

export type CopyMode = "archive" | "sync";

export interface CopyOptions {
  recycle?: boolean;
  recycle_path?: string;
}

export abstract class CopyEngine extends EventEmitter {
  abstract archive(src: string, dest: string): Promise<void>;
  abstract sync(src: string, dest: string, opts?: CopyOptions): Promise<void>;
}
