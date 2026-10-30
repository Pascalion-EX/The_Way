import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile as run, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(run);
const cwd = fileURLToPath(new URL("../../", import.meta.url));
const composeAvailable = spawnSync("docker", ["compose", "version"], { stdio: "ignore" }).status === 0;
const options = { skip: !composeAvailable && "Docker Compose CLI is unavailable (no daemon is needed)" };
const enabled = "com.centurylinklabs.watchtower.enable";
const scope = "com.centurylinklabs.watchtower.scope";
const applications = ["web", "web2", "api", "api2", "worker"];

async function config(extraFiles = [], values = {}) {
  // Use synthetic settings, never a workstation's private .env or credentials.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("COMPOSE_") || ["GHCR_OWNER", "APP_VERSION"].includes(key)) delete env[key];
  }
  Object.assign(env, {
    DOMAIN: "way.example.org", ACME_EMAIL: "admin@example.org",
    MONGO_ROOT_PASSWORD: "test-only-root", MONGO_APP_PASSWORD: "test-only-app",
    JWT_SECRET: "test-only-secret", SMTP_PASS: "test-only-smtp",
    SMTP_HOST: "smtp.example.org", SMTP_USER: "sender@example.org",
    SENDER_EMAIL: "sender@example.org", VIDEO_REQUEST_EMAIL: "staff@example.org",
    ASSET_RETENTION_DAYS: "30", ...values,
  });
  const files = extraFiles.length ? ["compose.yaml", "compose.override.yaml", ...extraFiles].flatMap((file) => ["-f", file]) : [];
  const { stdout } = await execFile("docker", ["compose", "--env-file", "/dev/null", ...files, "--profile", "tools", "config", "--format", "json"], { cwd, env });
  return JSON.parse(stdout).services;
}

function checkApplications(services, owner, version) {
  for (const name of applications) {
    const service = services[name];
    const image = name.startsWith("web") ? "web" : "api";
    assert.equal(service.image, `ghcr.io/${owner}/the-way-${image}:${version}`, name);
    assert.equal(service.labels[enabled], "true", name);
    assert.equal(service.labels[scope], "the-way", name);
    assert.equal(service.build, undefined, name);
    assert.equal(service.ports, undefined, name);
  }
  for (const name of ["db", "traefik", "backup", "indexes", "uploads-init"]) {
    assert.equal(services[name].labels[enabled], "false", name);
  }
  for (const name of ["indexes", "uploads-init"]) assert.equal(services[name].build, undefined, name);
  assert.equal(services.db.image, "mongo:8.0");
  assert.equal(services.traefik.image, "traefik:v3.7.16");
  for (const name of ["web", "web2"]) {
    const service = services[name];
    assert.equal(service.environment.ASSET_RETENTION_DAYS, "30", name);
    assert.ok(service.volumes.some((volume) => volume.source === "frontend_assets" && volume.target === "/srv/assets" && !volume.read_only), name);
    assert.ok(service.volumes.some((volume) => volume.source === "uploads_data" && volume.target === "/srv/uploads" && volume.read_only), name);
    assert.ok(!service.volumes.some((volume) => volume.target === "/srv"), name);
    assert.notEqual(service.healthcheck?.disable, true, name);
  }
  assert.deepEqual(services.worker.command, ["node", "worker.js"]);
}

test("default production Compose selects both frontend replicas and only the five app services for updates", options, async () => {
  checkApplications(await config(), "pascalion-ex", "production");
});

test("manual release pinning keeps both frontend replicas and all backend jobs on the same SHA", options, async () => {
  const version = `sha-${"a".repeat(40)}`;
  const services = await config([], { GHCR_OWNER: "test-owner", APP_VERSION: version });
  checkApplications(services, "test-owner", version);
  for (const name of ["indexes", "uploads-init"]) assert.equal(services[name].image, `ghcr.io/test-owner/the-way-api:${version}`);
});

test("Watchtower override enforces production even with an old SHA in the environment", options, async () => {
  const services = await config(["compose.watchtower.yaml"], { APP_VERSION: `sha-${"b".repeat(40)}` });
  checkApplications(services, "pascalion-ex", "production");
  assert.deepEqual(Object.keys(services).filter((name) => services[name].labels?.[enabled] === "true").sort(), [...applications].sort());
  assert.equal(services.watchtower.labels[enabled], "false");
  for (const argument of ["--label-enable", "--scope=the-way", "--rolling-restart", "--use-compose-depends-on=false"]) {
    assert.ok(services.watchtower.command.includes(argument), argument);
  }
  for (const name of ["indexes", "uploads-init"]) assert.equal(services[name].image, "ghcr.io/pascalion-ex/the-way-api:production");
});
