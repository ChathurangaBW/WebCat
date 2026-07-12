declare const process: any;
declare const Buffer: any;
declare const console: any;
declare function structuredClone<T>(value: T): T;

declare module "node:fs" { const value: any; export = value; }
declare module "node:fs/promises" { const value: any; export = value; }
declare module "node:path" { const value: any; export = value; }
declare module "node:os" { const value: any; export = value; }
declare module "node:crypto" { const value: any; export = value; }
declare module "node:net" { const value: any; export = value; }
declare module "node:child_process" { export function spawn(...args: any[]): any; }
declare module "node:readline/promises" { const value: any; export = value; }
declare module "node:readline" { const value: any; export = value; }
declare module "node:events" {
  export class EventEmitter {
    on(...args: any[]): this;
    once(...args: any[]): this;
    emit(...args: any[]): boolean;
    removeListener(...args: any[]): this;
  }
}
declare module "node:http" { const value: any; export = value; }
declare module "node:test" { const test: any; export default test; }
declare module "node:assert/strict" { const assert: any; export default assert; }
