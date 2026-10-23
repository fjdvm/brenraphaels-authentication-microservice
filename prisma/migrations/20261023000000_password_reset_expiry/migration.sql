-- Managed Neon Auth currently issues one-hour tokens and ignores the upstream
-- resetPasswordTokenExpiresIn option. Cap only password-reset verification rows;
-- Neon Auth still creates, emails, validates and consumes the tokens itself.
CREATE FUNCTION public.limit_password_reset_expiry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.identifier LIKE 'reset-password:%' THEN
    NEW."expiresAt" := LEAST(NEW."expiresAt", NEW."createdAt" + interval '15 minutes');
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  -- Plain Postgres test databases may not have managed Neon Auth installed.
  IF to_regclass('neon_auth.verification') IS NOT NULL THEN
    CREATE TRIGGER limit_password_reset_expiry
      BEFORE INSERT OR UPDATE OF "expiresAt" ON neon_auth.verification
      FOR EACH ROW EXECUTE FUNCTION public.limit_password_reset_expiry();

    UPDATE neon_auth.verification
      SET "expiresAt" = LEAST("expiresAt", "createdAt" + interval '15 minutes')
      WHERE identifier LIKE 'reset-password:%';
  END IF;
END $$;
