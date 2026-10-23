-- Managed Neon Auth currently issues one-hour tokens and ignores the upstream
-- resetPasswordTokenExpiresIn option. Cap only password-reset verification rows;
-- Neon Auth still creates, emails, validates and consumes the tokens itself.
-- SECURITY DEFINER lets the restricted Auth role read the Portal Deleted flag.
-- A fixed search_path and qualified tables scope that privilege.
CREATE FUNCTION public.limit_password_reset_expiry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.identifier LIKE 'reset-password:%' THEN
    NEW."expiresAt" := LEAST(NEW."expiresAt", NEW."createdAt" + interval '15 minutes');
    -- The provider URL is public too: a Deleted User must not bypass the Portal
    -- by requesting another link directly from Neon Auth.
    IF EXISTS (SELECT 1 FROM public."User" WHERE "neonAuthUserId" = NEW.value AND "isDeleted") THEN
      NEW."expiresAt" := LEAST(NEW."expiresAt", now());
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.expire_deleted_user_password_resets()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  UPDATE neon_auth.verification SET "expiresAt" = LEAST("expiresAt", now())
    WHERE identifier LIKE 'reset-password:%' AND value = NEW."neonAuthUserId";
  RETURN NEW;
END $$;

DO $$
BEGIN
  -- Plain Postgres test databases may not have managed Neon Auth installed.
  IF to_regclass('neon_auth.verification') IS NOT NULL THEN
    CREATE TRIGGER limit_password_reset_expiry
      BEFORE INSERT OR UPDATE OF "expiresAt" ON neon_auth.verification
      FOR EACH ROW EXECUTE FUNCTION public.limit_password_reset_expiry();

    CREATE TRIGGER expire_deleted_user_password_resets
      AFTER UPDATE OF "isDeleted" ON public."User"
      FOR EACH ROW WHEN (NEW."isDeleted")
      EXECUTE FUNCTION public.expire_deleted_user_password_resets();

    UPDATE neon_auth.verification
      SET "expiresAt" = LEAST("expiresAt", "createdAt" + interval '15 minutes')
      WHERE identifier LIKE 'reset-password:%';
  END IF;
END $$;
