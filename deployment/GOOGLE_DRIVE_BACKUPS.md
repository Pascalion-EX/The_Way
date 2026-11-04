# Google Drive backups

`deployment/backup-to-gdrive.sh` uses the existing Compose backup service to
dump `the_way` and save uploaded images, packages both archives into one ZIP,
and uploads it with rclone. It checks the ZIP and verifies the uploaded copy.
ZIPs stay in the ignored `deployment/backups/` directory. Local retention is
seven days by default; the script does not delete Drive backups.

The standalone MongoDB deployment needs a pause in writes for a consistent
dump. The script stops only running `api`, `api2`, and `worker` services, pauses
a running Watchtower, and starts those same services again after the dump.
API requests are unavailable during this interval. Restart is also attempted
if the dump fails or the script receives a termination signal. Upload starts
after the services restart. Do not overlap this command with deployments,
restores, or other maintenance.

## One-time VPS setup

Use the deployed repository with its populated root `.env` and running `db`
service. On Debian/Ubuntu, install the host tools:

```bash
sudo apt-get update
sudo apt-get install rclone zip unzip util-linux
sudo install -d -m 700 deployment/secrets/rclone deployment/backups
sudo docker compose --profile tools pull backup
sudo rclone --config "$PWD/deployment/secrets/rclone/rclone.conf" config
```

Create a remote named `gdrive`, select **Google Drive** (`drive`), and sign in
with the account that should store backups. Create your own Google OAuth
Desktop client ID/secret using
[rclone's Google Drive setup](https://rclone.org/drive/#making-your-own-client-id).
Choose the `drive.file` scope for access to files created by this client. Keep
external OAuth apps in Production for unattended use; Testing grants expire
after a week. On a VPS without a browser, answer **No** to browser setup and
follow the displayed authorization command on your workstation, as described
in [rclone's headless setup](https://rclone.org/remote_setup/).

```bash
sudo chmod 600 deployment/secrets/rclone/rclone.conf
sudo rclone --config "$PWD/deployment/secrets/rclone/rclone.conf" lsd gdrive:
```

Run configuration and backups as the same OS user. These examples use root
through `sudo`, including root's cron. The config directory must remain
writable for OAuth token refresh. Its tokens and the backup archives are
excluded from Git and Docker builds. The ZIP itself is not encrypted; use a
private Drive account/folder.

## Run a backup

From the repository root:

```bash
sudo bash deployment/backup-to-gdrive.sh
```

The default destination is `gdrive:the-way-backups`. A different folder can be
passed as the only argument:

```bash
sudo bash deployment/backup-to-gdrive.sh 'gdrive:the-way-backups/production'
```

Environment settings are optional. They are read by the host script, rather
than from Compose's `.env`:

| Setting | Default |
| --- | --- |
| `GDRIVE_BACKUP_REMOTE` | `gdrive:the-way-backups` |
| `GDRIVE_BACKUP_RETENTION_DAYS` | `7`, for completed local ZIPs |
| `RCLONE_CONFIG` | `<repository>/deployment/secrets/rclone/rclone.conf` |

For example, to keep local ZIPs longer:

```bash
sudo env GDRIVE_BACKUP_RETENTION_DAYS=14 bash deployment/backup-to-gdrive.sh
```

A lock prevents two instances from overlapping. The script exits nonzero on failure. Failed
uploads or verification keep the completed local ZIP; local cleanup happens
only after a new upload verifies successfully. Only ZIPs named
`the_way-gdrive-*.zip` are eligible for cleanup. Drive copies accumulate until
you remove them separately.

## Schedule daily backups

After a successful manual run, open root's crontab with `sudo crontab -e` and
add the following, replacing the repository path with the path on your VPS:

```cron
0 3 * * * /usr/bin/bash /home/deploy/apps/The_Way/deployment/backup-to-gdrive.sh >> /home/deploy/apps/The_Way/deployment/backups/gdrive-backup.log 2>&1
```

This runs at 03:00 in the VPS cron timezone. Set that timezone to
`Africa/Cairo` if you want 03:00 Cairo time. The script locates the repository
itself, so cron does not need a `cd`. Ensure cron's `PATH` includes Docker,
rclone, zip, unzip, and flock; review the log and rotate it with the host's
log management. No schedule is installed by the script.

## Retry an upload or restore

If an upload fails, the error prints the retained ZIP path. Retry that file
without another maintenance window, substituting its actual filename:

```bash
sudo rclone --config "$PWD/deployment/secrets/rclone/rclone.conf" copyto \
  deployment/backups/ACTUAL_BACKUP.zip gdrive:the-way-backups/ACTUAL_BACKUP.zip \
  --checksum --immutable
sudo rclone --config "$PWD/deployment/secrets/rclone/rclone.conf" check \
  deployment/backups gdrive:the-way-backups --one-way --include /ACTUAL_BACKUP.zip
```

To recover, download the chosen ZIP and extract it into `deployment/backups/`:

```bash
sudo rclone --config "$PWD/deployment/secrets/rclone/rclone.conf" copyto \
  gdrive:the-way-backups/ACTUAL_BACKUP.zip deployment/backups/ACTUAL_BACKUP.zip
sudo unzip -n deployment/backups/ACTUAL_BACKUP.zip -d deployment/backups
```

The ZIP contains a matching `.archive.gz` and `.uploads.tar.gz`. Use the
extracted database archive with the existing
[recovery procedure](../DEPLOYMENT.md#recover-from-a-database-backup).
Test recovery in an isolated environment before relying on the schedule.

## Troubleshooting MongoDB tools configuration

If the config helper reports `TypeError: String.prototype.trim called on null
or undefined`, update `deployment/mongo-tools-config.js`. Some mongosh versions
mis-handle optional-chained method calls such as `password?.trim()`; see
[MongoDB issue MONGOSH-2136](https://jira.mongodb.org/browse/MONGOSH-2136).
The helper validates the password without that expression and writes the
original value unchanged. Do not trim or replace the database password to
work around this shell error.

Check the helper on the VPS without connecting to MongoDB or printing its
generated credentials:

```bash
sudo docker compose --profile tools run --rm --no-deps -T \
  -e MONGO_TOOLS_CONFIG=/tmp/backup-test.json \
  --entrypoint mongosh backup \
  --nodb --quiet --norc --file /scripts/mongo-tools-config.js
```

A successful run exits without an error; the temporary container and its
config disappear when it exits. JavaScript belongs in the `.js` file, rather
than directly at a Bash prompt. Bash can interpret `!` as history expansion
and report `event not found` when a JavaScript statement is pasted there.
