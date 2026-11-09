# Rename the leader role to servant

The application now stores `servant` as the role and gives it the same permissions
as the former `leader` role. This includes class-specific attendance and profile
editing, while prayer management and account administration keep their existing
role restrictions. The admin API and UI use `servantCount`.

Existing data needs these changes:

| Collection | Existing field/value | Replacement |
| --- | --- | --- |
| Users | `role: "leader"` in role arrays | `"servant"` |
| Notifications | `targetRoles: "leader"` in role arrays | `"servant"` |
| Camps/trips | `applicants[].applicationType: "leader"` | `"servant"` |
| Camps/trips | `applicants[].leaderName` | `applicants[].servantName` |
| Camps/trips | `applicants[].leaderRole` | `applicants[].servantRole` |

The migration also handles case variants of the old role and legacy scalar role
fields. It preserves other roles, assigned classes, verification and ban status,
session versions, applicant IDs, contact details, dates, and payment references.
Duplicate roles produced by the rename are removed. Free text and people's names
are preserved. Conflicting old/new applicant details abort preflight before any
writes. The script prints counts and the database name, never user details.

## Deployment plan

Use one coordinated maintenance window: the old and new releases use different
role names and trip request fields. Do not let automatic updates deliver this
release before the database migration is ready.

1. **Before publishing this release, pause Watchtower if enabled.** Run
   `sudo docker compose stop watchtower`, as described in the
   [Watchtower maintenance guide](WATCHTOWER.md#pause-maintenance-and-rollback).
   Record the current immutable API and web image tags/digests for rollback.
   Publish the tested release, update the VPS checkout to it, and pin `APP_VERSION`
   to its `sha-<full-commit-sha>` tag in the deployment environment. Pull the images
   with `sudo docker compose pull`. Keep Watchtower stopped throughout migration.

2. **Stop writes and back up.** From the VPS repository root, keep MongoDB running
   and stop public traffic, both frontend replicas, both APIs, and the email worker:

   ```bash
   sudo docker compose stop traefik web web2 api api2 worker
   sudo docker compose --profile tools run --rm backup
   ```

   Record the completed database archive and companion uploads archive. Follow
   [backup and recovery](../DOCKER.md#backup-and-recovery) for backup verification
   and restoration. Test this procedure against a restored staging copy first.

3. **Preview with the new API image.** The one-off command loads production
   database credentials from Compose and uses raw collections so the old trip
   fields remain visible even though the schema has been renamed:

   ```bash
   sudo docker compose run --rm --no-deps api npm run migrate:servant-role
   ```

   Verify the printed database name and affected user, notification, and camp
   counts. This command performs no writes. Resolve any reported conflict before
   proceeding. Keep all application writers stopped.

4. **Apply and verify.**

   ```bash
   sudo docker compose run --rm --no-deps api npm run migrate:servant-role -- --apply
   sudo docker compose run --rm --no-deps api npm run migrate:servant-role
   ```

   The apply output must have zero `remaining` counts; the second preview must
   show zero `planned` counts. Each document update compares the original field
   before replacing it. If interrupted or a record changes, keep services stopped,
   fix the cause, and rerun preview/apply. Completed updates are retained; reruns
   safely finish the remaining records. This standalone MongoDB deployment does
   not make the entire migration a single transaction.

5. **Start the new release and check permissions.**

   ```bash
   sudo docker compose up -d --no-build --pull never --wait --wait-timeout 300 traefik web web2 api api2 worker
   ```

   Check that an existing servant can sign in, appears as `servant` in the admin
   panel, sees the same content actions, and can take attendance only for the
   assigned class. Verify a mixed-role account keeps its other roles; check
   notification visibility and an existing trip applicant's name/service details.
   Check that servant-only users still cannot manage prayers, administer accounts,
   or delete child profiles. Ask users with old tabs to refresh to load the new
   frontend and role data. Session tokens contain ID/version, not role claims, so
   this rename does not require resetting passwords or revoking sessions.

6. **Resume normal delivery after checks pass.** If Watchtower is used, ensure both
   `production` image tags contain this migration-compatible release and follow
   the [Watchtower guide](WATCHTOWER.md) to return from pinned images to its normal
   configuration. Resume it only after the data and both application replicas are
   running the matching release.

## Local or staging preview

Configure the target database in `backend/.env` or `MONGODB_URL`, then run:

```bash
npm --prefix backend run migrate:servant-role
npm --prefix backend run migrate:servant-role -- --apply
```

The first command is the default read-only preview; use the second only after
backup and with application writes stopped. `--help` does not connect to MongoDB.

## Rollback

Keep Watchtower stopped. If migration has started, keep all app services stopped,
restore the pre-migration database archive using the
[documented restore procedure](../DOCKER.md#backup-and-recovery), select the
recorded previous API/web image tags and matching source/configuration, and then
restart both replicas and the worker. Restoring a backup also removes writes
made after that backup; take the rollback decision during the maintenance window
before reopening traffic. Do not globally replace `servant` back to `leader`:
that could change accounts or applications that already used the new value.

If no migration writes occurred, roll back the images/configuration without a
database restore. A migration that completed only some records can instead be
finished by rerunning the new script while services remain stopped.

## Manual user role changes

For a small number of accounts, the updated admin panel can replace their roles
individually: open **Admin → Edit roles**, keep **Servant** and the account's other
roles selected, and choose **Save roles**. Opening an old account's role editor
preselects Servant in place of the retired role; only saving changes the account.
This requires the updated frontend and API to be deployed. Protected Pascal and
Pamela accounts still require a Pascal or Pamela operator to edit their roles.

Admin role changes only update users. Existing notification audiences and trip
applicant fields still need the migration; it safely skips users already updated
through the admin panel.
