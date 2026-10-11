begin;
-- Undoes 202610110022_backup_role.sql: the role goes away (it owns nothing and has no data).
drop role if exists frankendom_backup;
commit;
