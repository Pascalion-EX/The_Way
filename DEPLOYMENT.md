# Deploy The Way with GitHub Actions and GHCR

Use GitHub for source control, GitHub Actions for checks and image builds,
GitHub Container Registry (GHCR) for versioned images, and Contabo for running
the application. The VPS pulls images; application builds run on GitHub's
runners. MongoDB and Traefik certificate volumes remain on the VPS.

This guide walks through **Stage 1: automated checks/builds/publishing, followed
by manual deployment over SSH**. A push does not automatically update the VPS.
First save the workflow and Compose override from steps 1–2 at the named paths
and push them with the source. The subsequent VPS commands depend on those
configuration files.

If you already ran `npm run deploy:build` on Fedora, that remains a useful local
build check. The release deployed here is built and published by GitHub Actions;
the workstation's local images are not transferred through Git.

These instructions assume a **new Ubuntu 24.04 LTS, amd64 VPS** with the
planned **4 vCPU, 8 GB RAM, and 100 GB SSD**. Your workstation can remain Fedora.
Commands marked **VPS** run over SSH on Ubuntu, not in your Fedora terminal.
If you choose another server OS, use Docker's installation instructions for
that OS instead of the Ubuntu package commands below.

Replace these examples throughout the guide:

| Example | Replace with |
| --- | --- |
| `VPS_IP` | The public IPv4 address assigned by Contabo |
| `YOUR_ACCOUNT` | Your GitHub account or organization |
| `GHCR_OWNER` | That account or organization in lowercase, used in image paths |
| `YOUR_BRANCH` | The branch you intend to deploy |
| `FULL_40_CHARACTER_COMMIT_SHA` | The full commit SHA from a successful publish run |
| `way.your-domain.com` | The public hostname you will use for the website |
| `admin@your-domain.com` | The registered account you will make the first administrator |

You can finish the GitHub and image-build steps before choosing a domain.
The current production stack requires a hostname and HTTPS before public use.

## 1. Add the GitHub Actions publishing workflow

**Workstation — repository root:**

Create `.github/workflows/publish.yml` with the following content. The example
publishes from `main`; if your release branch differs, change both `branches`
lists and the `refs/heads/main` condition. Enable GitHub Actions for the
repository and allow the workflow to write packages under your account or
organization's policy.

```yaml
name: Test and publish images

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
          package-manager-cache: false
      - name: Install locked dependencies
        run: |
          npm ci
          npm ci --prefix backend
          npm ci --prefix frontend
      - name: Run backend and frontend tests
        run: npm test
      - name: Lint frontend
        run: npm run lint --prefix frontend
      - name: Build frontend
        env:
          VITE_BACKEND_URL: ""
        run: npm run build --prefix frontend

  publish:
    needs: checks
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - image: the-way-api
            dockerfile: backend/Dockerfile
          - image: the-way-web
            dockerfile: frontend/Dockerfile
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      - name: Set lowercase registry owner
        id: registry
        shell: bash
        run: echo "owner=${GITHUB_REPOSITORY_OWNER,,}" >> "$GITHUB_OUTPUT"
      - uses: docker/setup-buildx-action@v4
      - name: Log in to GHCR
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and publish
        uses: docker/build-push-action@v7
        with:
          context: .
          file: ${{ matrix.dockerfile }}
          platforms: linux/amd64
          push: true
          tags: ghcr.io/${{ steps.registry.outputs.owner }}/${{ matrix.image }}:sha-${{ github.sha }}
          labels: |
            org.opencontainers.image.source=https://github.com/${{ github.repository }}
            org.opencontainers.image.revision=${{ github.sha }}
```

Checks run for pull requests and release-branch pushes. Publishing waits for
checks and runs only for the release branch. It uses the built-in
`GITHUB_TOKEN` with `packages: write`; no publishing PAT or VPS SSH key is
needed. Keep production database, JWT, and SMTP credentials on the VPS; these
checks and image builds require none of them. The API image also runs the
second API process, worker, and index job.

The workflow targets the planned amd64 VPS and uses the existing root-context
Dockerfiles. Version tags have the form `sha-<full 40-character commit SHA>`.
Use a completed successful run for both images, rather than `latest` or a
partially published release. A commit tag identifies source; record the image
digests if you also need to audit the exact artifacts across workflow reruns.

References: [publishing Docker images with GitHub Actions](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images),
[checkout](https://github.com/actions/checkout), [Node setup](https://github.com/actions/setup-node),
[Docker image publishing action](https://github.com/docker/build-push-action).

## 2. Configure production to use GHCR images

**Workstation — repository root:**

Create `compose.override.yaml` beside `compose.yaml` with this content:

```yaml
x-ghcr-api: &ghcr-api
  image: ghcr.io/${GHCR_OWNER:?Set GHCR_OWNER in .env}/the-way-api:${APP_VERSION:?Set APP_VERSION to a published SHA tag}
  build: !reset null

services:
  api:
    <<: *ghcr-api
  api2:
    <<: *ghcr-api
  worker:
    <<: *ghcr-api
  indexes:
    <<: *ghcr-api
  web:
    image: ghcr.io/${GHCR_OWNER:?Set GHCR_OWNER in .env}/the-way-web:${APP_VERSION:?Set APP_VERSION to a published SHA tag}
    build: !reset null
```

Docker Compose loads this override automatically with `compose.yaml`. The
override changes application images and removes their inherited build
definitions. Existing environment settings, health checks, networking, volumes,
resource limits, and startup dependencies stay in the base configuration.
MongoDB and backup tools continue using `mongo:8.0`.

Add `GHCR_OWNER=` to `.env.example`, and replace its existing `APP_VERSION=local`
line with `APP_VERSION=`. Leave the secret placeholders empty. Actual namespace
and release values are filled in on the VPS in step 8.

Use a current Compose plugin supporting `!reset`. Docker documents
[automatic override loading](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/)
and [resetting inherited fields](https://docs.docker.com/reference/compose-file/merge/).
Use the plain `sudo docker compose ...` commands shown below so the override is
loaded. Specifying only `-f compose.yaml` would omit it.

`npm run deploy:build` explicitly selects `compose.build.yaml`, so it remains
available for local image checks without loading the production override.

## 3. Push the configuration and wait for published images

**Workstation — repository root:**

```bash
git status --short
git branch --show-current
git check-ignore .env backend/.env frontend/.env
```

The last command should list the private environment files as ignored. Review
your changes and stage the files you intend to publish. Include application
source, shared modules, package lockfiles, both Dockerfiles, `compose.yaml`,
`compose.build.yaml`, `.dockerignore`, `.env.example`, and the deployment scripts.

For the deployment files and documentation in this repository:

```bash
git add .github/workflows/publish.yml compose.override.yaml
git add compose.yaml compose.build.yaml .dockerignore .gitignore .env.example
git add backend/Dockerfile frontend/Dockerfile deployment
git add README.md DOCKER.md DEPLOYMENT.md
git diff --cached --stat
git diff --cached --name-only -- .env backend/.env frontend/.env
```

The final command must print nothing. Stage any remaining application changes
you reviewed, then commit and push:

```bash
git commit -m "Publish tested application images to GHCR"
git push origin YOUR_BRANCH
```

On GitHub, open the repository's **Actions** page and wait for the checks and
both publish jobs to succeed. Under the account or organization's **Packages**,
verify that both of these images have the same published SHA tag:

```text
ghcr.io/GHCR_OWNER/the-way-api:sha-FULL_40_CHARACTER_COMMIT_SHA
ghcr.io/GHCR_OWNER/the-way-web:sha-FULL_40_CHARACTER_COMMIT_SHA
```

Copy the full commit SHA from that successful run for use on the VPS. Package
visibility can remain private, or you can make the images public if appropriate
for your project. Public images support anonymous pulls; private images require
the VPS registry login in step 9. See [GHCR access and authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Do not proceed with a failed or incomplete publish run, even if one image's tag
is already visible. If the configuration was already pushed, use its successful
run rather than creating another commit solely to trigger publishing.

## 4. Create the VPS and connect

Provision the Contabo VPS with Ubuntu 24.04 LTS and the planned resources. Keep
the assigned IP address and SSH login details available. The following example
uses `root` for the initial login; use the account supplied by Contabo if it
differs.

**Workstation:**

```bash
ssh root@VPS_IP
```

**VPS — initial administrative session:**

```bash
apt update
apt upgrade -y
apt install -y git curl ca-certificates openssl ufw dnsutils nano
adduser deploy
usermod -aG sudo deploy
```

Keep that session open. In a second workstation terminal, install your existing
SSH public key and verify the deployment account:

```bash
ssh-copy-id deploy@VPS_IP
ssh deploy@VPS_IP
```

If you do not already have an SSH key, create one with `ssh-keygen -t ed25519`
before running `ssh-copy-id`. Continue the remaining VPS steps as `deploy`.

**VPS — deployment account:**

```bash
sudo -v
free -h
df -h /
```

If the system upgrade requires a reboot, reboot and reconnect before proceeding.

## 5. Install Docker Engine and Compose on the VPS

**VPS — deploy account:**

The following configures Docker's Ubuntu repository for **24.04 / amd64** and
installs the Engine, Buildx, and Compose plugin. The installation method is
documented in [Docker's official Ubuntu guide](https://docs.docker.com/engine/install/ubuntu/).

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
sudo docker run --rm hello-world
```

Use `sudo docker ...` consistently in the remaining VPS commands. This avoids
depending on Docker group membership. Node, npm, MongoDB, Caddy, and Traefik run inside
containers; you do not need to install them on the VPS host.

## 6. Configure inbound access and DNS

**VPS:**

Allow the actual SSH port before enabling the firewall. These commands assume
SSH uses the default TCP port 22:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

If a Contabo network firewall is enabled, allow the same ports there. TCP 80/443
serve the site and certificate challenges; UDP 443 is optional for HTTP/3.
MongoDB port 27017 and API port 4000 stay unpublished in the supplied Compose
file. Docker-published ports can bypass UFW rules, so keep those internal ports
unpublished. See [Ubuntu firewall configuration](https://ubuntu.com/server/docs/how-to/security/firewalls/)
and [Docker firewall behavior](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

At your DNS provider, create an **A record** for `way.your-domain.com` pointing
to `VPS_IP`. Add an AAAA record only if the VPS IPv6 address and IPv6 routing
are configured correctly. Check public DNS:

```bash
dig +short A way.your-domain.com @1.1.1.1
dig +short AAAA way.your-domain.com @1.1.1.1
```

Wait until the A record returns your VPS IP. Initially use direct DNS routing
if your DNS provider also offers a proxy service. The Traefik container handles
TLS certificates and HTTP-to-HTTPS redirects once DNS and port access work.
See [Traefik’s HTTP-01 requirements](https://doc.traefik.io/traefik/reference/install-configuration/tls/certificate-resolvers/acme/).

## 7. Clone the matching source revision on the VPS

**VPS — deploy account:**

```bash
mkdir -p ~/apps
cd ~/apps
git clone --branch YOUR_BRANCH https://github.com/YOUR_ACCOUNT/The_Way.git
cd The_Way
WAY_RELEASE_SHA=FULL_40_CHARACTER_COMMIT_SHA
git switch --detach "$WAY_RELEASE_SHA"
git log -1 --oneline
```

For a private repository, first configure a read-only SSH deploy key using
[GitHub's deploy-key instructions](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).
Then use `git@github.com:YOUR_ACCOUNT/The_Way.git` as the clone URL. Add the public
key to GitHub; keep the private key on the VPS.

Use the full SHA from step 3, not an arbitrary branch head. The checkout must
include `compose.override.yaml` and `.github/workflows/publish.yml` from steps
1–2. Matching the source revision keeps Compose and helper scripts aligned
with the published images. Cloning supplies those configuration and support
files; there is no application build step on the VPS.

All remaining application commands run from `~/apps/The_Way`. Keep this
directory and the Compose project name `the-way` consistent so subsequent
releases use the existing database and certificate volumes.

## 8. Create the VPS production environment file

**VPS — repository root:**

Create the file on the first deployment. If `.env` already exists, edit it
instead of overwriting it:

```bash
if [ ! -f .env ]; then
  cp .env.example .env
fi
chmod 600 .env
```

Run this command **three times** to generate independent secrets:

```bash
openssl rand -hex 32
```

Put the three different results into `MONGO_ROOT_PASSWORD`,
`MONGO_APP_PASSWORD`, and `JWT_SECRET`. Then edit the remaining settings:

```bash
nano .env
```

| Setting | Value to enter |
| --- | --- |
| `DOMAIN` | `way.your-domain.com`, without `https://`, a path, or trailing slash |
| `ACME_EMAIL` | Contact email for Let’s Encrypt certificate registration |
| `GHCR_OWNER` | GitHub account or organization in lowercase, matching the published image namespace |
| `APP_VERSION` | `sha-` followed by the full commit SHA from the successful publish run |
| `MONGO_ROOT_PASSWORD` | First generated secret, used only by MongoDB |
| `MONGO_APP_PASSWORD` | Second generated secret, used by the `kerolosafam_db_user` database user |
| `JWT_SECRET` | Third generated secret, used to sign login tokens |
| `SMTP_HOST` | Your mail provider's SMTP hostname |
| `SMTP_PORT` | `465` for implicit TLS or `587` for STARTTLS |
| `SMTP_USER` | Your SMTP login |
| `SMTP_PASS` | Your provider's SMTP password or app password |
| `SENDER_EMAIL` | A sender address permitted by the mail provider |
| `VIDEO_REQUEST_EMAIL` | The recipient of video-request notifications |
| `BACKUP_RETENTION_DAYS` | For example, `7` |

Single-quote values containing `$` or `#`, for example
`SMTP_PASS='your-provider-password'`. Keep the file private and preserve these
secrets across ordinary releases. Compose passes the selected settings into
containers, and `backend/config/secrets.js` reads them from `process.env`.
See [Docker's environment-file syntax](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).

Do not copy the workstation's development database URL into this configuration.
This stack connects to its own MongoDB service. On the first deployment, that
database is empty; it does not import the existing development database. If you
need existing data, arrange and verify a database migration before inviting
users. The recovery instructions below accept archives for the `the_way`
database; other database names require a deliberate namespace migration.

## 9. Authenticate to GHCR and pull the release

**VPS — repository root:**

If the packages are **private**, create a GitHub **personal access token
(classic)** with `read:packages` for a user who can access both packages.
Authorize organization SSO if required. Enter it through standard input rather
than putting it in a command or the production `.env`:

```bash
sudo -v
read -r -p "GitHub username for pulling: " GHCR_USER
read -r -s -p "GHCR read:packages token: " GHCR_READ_TOKEN
printf '\n'
printf '%s' "$GHCR_READ_TOKEN" | sudo docker login ghcr.io \
  --username "$GHCR_USER" --password-stdin
unset GHCR_READ_TOKEN
```

The token user's username can differ from `GHCR_OWNER`, which identifies the
package namespace. Use `sudo docker login` because the remaining Docker commands
also use sudo. Registry authentication is separate from the application's
database, JWT, and SMTP secrets. Public packages can be pulled without this
login. See [GitHub's GHCR authentication instructions](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

Validate the selected release, then pull it:

```bash
sudo docker compose config --quiet
sudo docker compose config --images
sudo docker compose pull
sudo docker image ls --filter 'reference=ghcr.io/*/the-way-*'
```

`config --quiet` should return successfully without output. An error naming a
variable means its `.env` value still needs attention. Avoid the unrestricted
`docker compose config` output when sharing logs because it contains resolved
credentials.

`config --images` must list both `ghcr.io/.../the-way-*` image names with the
same `sha-...` tag, and `mongo:8.0`. If it lists `the-way-api:local` or
`the-way-web:local`, the registry override was not loaded. The `pull` command
downloads the application images and MongoDB without building application
code. All four API-derived services use the same API image.

If any pull fails, fix the release tag or registry access before running
`up`. Already running containers are not replaced by a pull. Keep the published
previous release available in GHCR for rollback.

The release commands are:

| Task | Command |
| --- | --- |
| Optional local build check | `npm run deploy:build` |
| Build, test, and publish a release | GitHub Actions workflow from step 1 |
| Validate production configuration | `sudo docker compose config --quiet` |
| Download a published release | `sudo docker compose pull` |
| Start the downloaded images | Startup command in step 10 |

No Node/npm installation or application image build is needed on the VPS.

## 10. Start the stack

**VPS — repository root:**

```bash
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
sudo docker compose ps -a
```

The startup sequence is:

1. MongoDB initializes its persistent volume and creates the `kerolosafam_db_user` application
   user with access to `the_way`.
2. The `indexes` job creates declared database indexes and exits successfully.
3. Both API processes and the dedicated email worker start.
4. Caddy serves the frontend on internal HTTP port 80.
5. Traefik starts after Caddy and both APIs are healthy, obtains TLS certificates,
   redirects public HTTP to HTTPS, and balances API requests between the APIs.

Expected states:

| Service | Expected state |
| --- | --- |
| `db` | Running and healthy |
| `indexes` | Exited with code `0`; this is expected |
| `api`, `api2` | Running and healthy |
| `worker` | Running; this service has no healthcheck |
| `web` | Running and healthy (internal Caddy) |
| `traefik` | Running and healthy (public HTTPS and API load balancing) |
| `backup` | Not running normally; it is an on-demand tool |

If startup fails, inspect logs before retrying:

```bash
sudo docker compose logs --tail 100 traefik db indexes api api2 worker web
```

A failed `up --wait` can leave some containers running. Caddy and Traefik
healthchecks are internal; validate public HTTPS separately in step 11.

## 11. Verify the public site and email

**Workstation or VPS — replace the hostname:**

```bash
curl --fail --show-error https://way.your-domain.com/health/frontend
curl --fail --show-error https://way.your-domain.com/health/ready
curl -I http://way.your-domain.com
```

Expect `ok` from the frontend, `{"status":"ready"}` from the backend, and an
HTTP redirect to HTTPS. Open `https://way.your-domain.com` in a browser without
a certificate warning. Open `/login` directly and refresh it to check frontend
routing.

**VPS — verify the SMTP connection:**

```bash
sudo docker compose exec -T api node scripts/checkEmail.js
```

That script tests the SMTP connection, TLS, and authentication without sending
a message. Then register a real test account in the browser, request its email
verification code, verify it, and check login/logout. This exercises actual
delivery through the worker as well as browser cookies. Test a protected page
after login.

## 12. Assign the first administrator

Register the intended administrator through the website and verify that
account's email first. Then run:

**VPS — repository root:**

```bash
sudo docker compose exec -T api \
  node scripts/bootstrapAdmin.js admin@your-domain.com
```

Log out and log in again. The script requires a verified, non-banned account,
revokes its old sessions, and refuses to run if an administrator already
exists. Manage later role changes through the admin dashboard.

## 13. Create a backup and copy it off the VPS

The database is stored in the named volume `the-way_mongo_data`. Traefik’s
certificate state is stored in `the-way_traefik_data`. Keep these volumes
through ordinary deployments.

For a consistent backup of the current standalone database, stop application
writes during a maintenance window. The site is unavailable while these
services are stopped:

**VPS — repository root:**

```bash
mkdir -p deployment/backups
chmod 700 deployment/backups
sudo docker compose stop traefik web api api2 worker
sudo docker compose --profile tools run --rm backup
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
sudo ls -lh deployment/backups
```

Run the startup command even if the backup command fails, then investigate the
failure. A successful backup prints an archive path such as
`/backups/the_way-20261028T120000-1.archive.gz`. Retention cleanup applies only
after a successful backup. The command runs once; no backup schedule is
installed automatically.

The tool runs as root, so make the chosen archive readable by the deployment
account before copying it. Substitute its actual filename:

```bash
sudo chown deploy:deploy deployment/backups/ACTUAL_ARCHIVE.archive.gz
```

**Workstation:**

```bash
mkdir -p ~/the-way-backups
scp deploy@VPS_IP:/home/deploy/apps/The_Way/deployment/backups/ACTUAL_ARCHIVE.archive.gz \
  ~/the-way-backups/
```

Keep an encrypted copy of the production `.env` in your private backup system
as well. Schedule regular backups and off-server copies before relying on the
site for live data. This standalone backup procedure requires a maintenance
window; test a restore in an isolated environment before relying on it.

## 14. Check resource use before inviting users

**VPS:**

```bash
sudo docker stats --no-stream
df -h /
free -h
sudo docker system df
```

Check the app logs and perform representative browser tasks before opening
access more widely. The resource limits in Compose are an initial allocation
for the planned VPS. A successful image build or healthy container does not
establish that the server can support 1,000 concurrent active users. Measure
that separately with representative load in an isolated environment; do not
run the synthetic load-test seeder against the live database.

## Deploy a later update

Push and review the new source on GitHub first. Wait for checks and both image
publishes to succeed, then copy that run's full commit SHA. On the VPS, record
the current source SHA with `git rev-parse HEAD` and image tags with
`sudo docker compose config --images`, and take a backup using step 13. Retain
the previous release's tags in GHCR so they can be pulled again for rollback.

**VPS — repository root:**

```bash
git status --short
git fetch origin YOUR_BRANCH
WAY_RELEASE_SHA=FULL_40_CHARACTER_COMMIT_SHA
git switch --detach "$WAY_RELEASE_SHA"
sed -i "s/^APP_VERSION=.*/APP_VERSION=sha-$WAY_RELEASE_SHA/" .env
sudo docker compose config --quiet
sudo docker compose config --images
sudo docker compose pull
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
sudo docker compose ps -a
```

Resolve unexpected tracked source changes before switching revisions. Use the
successful published SHA for `WAY_RELEASE_SHA`; do not invent a version or use
an unverified branch head. If a pull fails, stop and fix registry access or the
tag before running `up`. The existing containers continue using their running
images until startup replaces them. After startup, repeat the health and
browser checks from step 11. Updates can briefly interrupt service; this
procedure does not provide a rolling deployment.

When upgrading from the public-Caddy configuration, add `ACME_EMAIL` to `.env`
and deploy matching new frontend images and Compose files together. Compose
recreates Caddy without host ports before Traefik binds them. Traefik requests
new certificates and stores them in `the-way_traefik_data`; retain the old
Caddy volumes for rollback. See the [routing migration notes](DOCKER.md).

Changing `.env` requires container recreation through `compose up`; a simple
`docker compose restart` keeps the old container environment. In particular,
MongoDB initializes users only on an empty data directory. Editing a password
in `.env` does not rotate the existing database user's password. See the
[official MongoDB image initialization behavior](https://hub.docker.com/_/mongo).

### Roll back to a published release

Select the previously recorded successful release SHA. Restore its matching
Compose/helper-script revision and image tag, then pull the previous images
from GHCR. The example assumes that revision includes the registry override
and is compatible with the current database:

```bash
git status --short
git fetch origin YOUR_BRANCH
WAY_RELEASE_SHA=PREVIOUS_FULL_40_CHARACTER_COMMIT_SHA
git switch --detach "$WAY_RELEASE_SHA"
sed -i "s/^APP_VERSION=.*/APP_VERSION=sha-$WAY_RELEASE_SHA/" .env
sudo docker compose config --quiet
sudo docker compose config --images
sudo docker compose pull
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
```

Previous images do not have to remain cached on the VPS, but their published
tags must remain available and accessible in GHCR. Repeat the health checks
afterward. This procedure restores source configuration and application
images; it does not undo database writes or index changes. Database-affecting
releases may require a separate tested migration rollback or data recovery.

### Recover from a database backup

Recovery replaces collections present in the archive. Collections absent from
it remain in the database. Keep an additional backup of the current database
before recovery when it is readable.

**VPS — repository root, using an actual archive filename:**

```bash
sudo docker compose stop traefik web api api2 worker
sudo docker compose --profile tools run --rm --entrypoint sh backup \
  /scripts/restore-container.sh /backups/ACTUAL_ARCHIVE.archive.gz
sudo docker compose run --rm --no-deps indexes
sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300
```

Start the application only after restore and index creation succeed. Repeat
the checks from step 11. To recover on a replacement VPS, restore the intended
production environment settings, authenticate to GHCR and pull the intended
release, create the database with the current credentials, and use this
procedure before admitting user traffic. Moving application images to GHCR
does not move the database, certificates, `.env`, or backups away from the VPS.

## Add automated VPS deployment later

After manual deployment and rollback work, a subsequent stage can use a
GitHub Actions deployment job to update the VPS after publication. That needs
VPS SSH credentials, a fixed server/project location, deployment serialization,
release selection, health checks, and a failure/rollback policy. Keep those
credentials in a GitHub deployment environment when implementing that stage.
The workflow in step 1 stops at image publication and requires no VPS access.

## Common problems

| Symptom | Check or action |
| --- | --- |
| `required variable ... is missing a value` | Work from the repository root, create its production `.env`, fill the named value, and run `sudo docker compose config --quiet`. `backend/.env` is not the Compose configuration. |
| Docker socket `permission denied` | Use `sudo docker ...` as shown. Confirm `sudo docker version` can contact the daemon. |
| `manifest unknown` or image not found | Set `APP_VERSION` to the exact `sha-<full SHA>` tag published for both images by a successful run, then run `sudo docker compose pull`. |
| GHCR returns `unauthorized` or `denied` | For private images, use `sudo docker login ghcr.io` with a classic PAT granting `read:packages`, and confirm that user has package access and any required SSO authorization. The publisher uses its own built-in token. |
| Compose still references local image names | Confirm `compose.override.yaml` from step 2 exists at the checked-out revision, and use default `sudo docker compose` commands so it is loaded. |
| Publishing fails with package permissions | Check the publish job's `packages: write` permission, organization policy, and the package's Actions access for this repository if the package already exists. |
| Browser certificate error or HTTPS unavailable | Check A/AAAA records, inbound TCP 80/443, and `sudo docker compose logs --tail 100 traefik web`. Check whether another service already owns the ports with `sudo ss -lntup`. |
| `indexes` exited with a nonzero status | Read its logs and resolve the database/index error. The APIs intentionally wait for this job to succeed. Exited `0` is normal. |
| Database is unhealthy after changing credentials | Restore the previous matching `.env` values or rotate the users through MongoDB. Do not erase the volume to fix a password mismatch. |
| Email verification does not arrive | Run the SMTP check from step 11 and inspect worker logs. Check the provider's credentials, allowed sender, outbound port access, and the recipient's spam folder. |
| npm is unavailable on the VPS | Use the pull/start commands in steps 9–10; host Node/npm and application builds are not required. |

`sudo docker compose down` stops and removes containers while keeping named
volumes. **Do not add `-v` to an ordinary deployment command:** it deletes the
database and certificate volumes. Avoid volume pruning as a deployment step.
The configured restart policies and enabled Docker service restart running
long-lived services after a host reboot, unless they were deliberately stopped.

For the Dockerfiles, environment flow, and backup implementation, see the
[Compose reference](DOCKER.md), [backend image guide](backend/DOCKER.md), and
[frontend image guide](frontend/DOCKER.md).
