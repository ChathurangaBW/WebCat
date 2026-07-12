declare const process: any;
declare const Buffer: any;
declare const console: any;
declare function fetch(input: any, init?: any): Promise<any>;
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number, ...args: any[]): any;
declare function clearTimeout(handle: any): void;
declare class URL { constructor(input: string, base?: string); protocol: string; hostname: string; host: string; port: string; pathname: string; search: string; href: string; }
declare module "node:fs" { const value: any; export = value; }
declare module "node:fs/promises" { const value: any; export = value; }
declare module "node:path" { const value: any; export = value; }
declare module "node:os" { const value: any; export = value; }
declare module "node:crypto" { const value: any; export = value; }
declare module "node:readline/promises" { const value: any; export = value; }
declare module "node:readline" { const value: any; export = value; }
declare module "node:events" { export class EventEmitter { on(...args: any[]): this; once(...args: any[]): this; emit(...args: any[]): boolean; removeListener(...args: any[]): this; } }
declare module "node:test" { const test: any; export default test; }
declare module "node:assert/strict" { const assert: any; export default assert; }

declare module "node:http" { const value: any; export = value; }
declare module "node:net" { const value: { isIP(input: string): number }; export = value; }
declare module "node:child_process" { export function spawn(...args: any[]): any; export function execFile(...args: any[]): any; }
