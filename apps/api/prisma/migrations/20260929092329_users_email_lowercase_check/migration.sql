-- Emails are normalized (trimmed, lowercased) by the application; enforce it in the database too.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
