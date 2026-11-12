# HRMS Module cutover (fjdvm/hrms#316)

Deploy in this order so current HRMS callers retain hiring access:

1. Apply `20261112000000_module_retirement` (nullable schema expansion only).
2. Deploy the Portal with the all-four hiring compatibility bridge.
3. Apply `20261113000000_hrms_modules` using the direct database connection.
4. Verify the matrix, Add new user and Edit access offer exactly nine HRMS Modules;
   an existing hiring holder can still open HRMS hiring pages; a partial new holder
   cannot validate the old Recruitment and Hiring name; Onboarding has no grants.
5. Remove `hrms-legacy-hiring.ts` and its callers after HRMS #317 is deployed.

On a database with no unrelated pending migrations, use `npx prisma migrate deploy`.
The configured database also has the older, unrelated `remove_system_log` migration
pending. Do not combine that table deletion with this cutover. To apply just each
stage with Prisma, run (substitute the stage's directory name):

```sh
npx prisma db execute --file prisma/migrations/<stage>/migration.sql
npx prisma migrate resolve --applied <stage>
```

Run `resolve` only after `db execute` succeeds. If execution succeeds but recording
it fails, inspect the database and record it; do not rerun the schema expansion.
Never run the full bootstrap seed for this cutover: it explicitly gives the bootstrap
Super Admin all Modules and refreshes Super Admin/General Manager defaults, whereas
this migration maps existing grants and templates and grants nobody Onboarding.

The data migration is transactional. It preserves Employee Information grants,
expands only active Recruitment and Hiring grants to the four hiring Modules,
leaves revoked history revoked, stamps dropped grants with `revokedAt`, removes
obsolete template entries, and retains retired Module rows for historical references.
Other Systems are unaffected. Rolling back code does not restore old grants; retain
the bridge until HRMS uses its new Module names.
