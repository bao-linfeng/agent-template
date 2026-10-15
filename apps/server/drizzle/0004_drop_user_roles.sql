-- Client users and admin console accounts are now separate tables. Accounts that held any role other
-- than the former default `user` role are copied into `admin_users` (with their roles and password, but
-- without the avatar, whose object stays owned by the client account). The client accounts themselves
-- are kept untouched: delete them manually if those people should no longer use the client app.
INSERT INTO "admin_users" ("email", "password_hash", "nickname", "status", "last_login_at", "created_at", "updated_at")
SELECT u."email", u."password_hash", u."nickname", u."status", u."last_login_at", u."created_at", u."updated_at"
FROM "users" u
WHERE EXISTS (
	SELECT 1 FROM "user_roles" ur JOIN "roles" r ON r."id" = ur."role_id"
	WHERE ur."user_id" = u."id" AND r."code" <> 'user'
)
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint
INSERT INTO "admin_user_roles" ("admin_user_id", "role_id")
SELECT au."id", ur."role_id"
FROM "user_roles" ur
JOIN "users" u ON u."id" = ur."user_id"
JOIN "admin_users" au ON au."email" = u."email"
JOIN "roles" r ON r."id" = ur."role_id"
WHERE r."code" <> 'user'
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- RBAC only applies to the admin console: the client default role and its permission are gone.
DELETE FROM "roles" WHERE "code" = 'user';--> statement-breakpoint
UPDATE "roles" SET "permissions" = array_remove("permissions", 'knowledge-base:create');--> statement-breakpoint
DROP TABLE "user_roles" CASCADE;
