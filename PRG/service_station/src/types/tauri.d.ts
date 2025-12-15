// Global Tauri types for TypeScript
interface Window {
  __TAURI__: {
    invoke: (command: string, args?: Record<string, unknown>) => Promise<any>;
  };
}