const initialized = new WeakSet();

export function withEmailEnvironment(t) {
  if (initialized.has(t)) return;
  initialized.add(t);
  for (const [name, value] of Object.entries({
    JWT_SECRET: "test-only-email-subscription-secret",
    APP_ORIGIN: "https://way.example.org",
  })) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
}
