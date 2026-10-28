import { AsyncLocalStorage } from "node:async_hooks";

export const requestContext = new AsyncLocalStorage();

export async function timeOperation(name, operation) {
  const started = performance.now();
  try {
    return await operation();
  } finally {
    const context = requestContext.getStore();
    if (context) context.phases[name] = (context.phases[name] || 0) + performance.now() - started;
  }
}
