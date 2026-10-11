begin;
-- Class 1 (additive: one new role, no object or row changed). Daily database backup (Lead + Dom 2026-10-11): ops/db-backup.sh dumps public + auth as a role that can only READ.
--  * frankendom_backup: NOLOGIN here and with NO password in the repo. Dom sets LOGIN and the password himself in the dashboard SQL editor and writes the connection string to /etc/frankendom/backup.env (root, 600).
--  * pg_read_all_data is the built-in read-only role: SELECT on every table/view/sequence and USAGE on every schema (auth included), no write, no DDL; it does NOT bypass RLS, so the role also carries BYPASSRLS (live has RLS on ~60 tables; without it pg_dump exits 1). BYPASSRLS grants no write: INSERT/UPDATE/DELETE/DDL stay refused.
create role frankendom_backup nologin bypassrls;
grant pg_read_all_data to frankendom_backup;
commit;
