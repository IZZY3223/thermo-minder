
-- 1) Restrict invite_code visibility to the family creator only via column privileges.
REVOKE SELECT ON public.families FROM authenticated;
GRANT SELECT (id, name, created_by, created_at) ON public.families TO authenticated;
GRANT SELECT (invite_code) ON public.families TO postgres, service_role;

-- Helper RPC: only the creator can retrieve the invite_code.
CREATE OR REPLACE FUNCTION public.get_family_invite_code(_family_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invite_code
  FROM public.families
  WHERE id = _family_id
    AND created_by = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_family_invite_code(uuid) TO authenticated;

-- Helper RPC: join a family using only the invite code (no read access required).
CREATE OR REPLACE FUNCTION public.join_family_by_code(_code text, _display_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id uuid;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name required';
  END IF;

  SELECT id INTO _family_id FROM public.families WHERE invite_code = upper(_code);
  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name)
  VALUES (_family_id, _uid, trim(_display_name))
  ON CONFLICT (family_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN _family_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text, text) TO authenticated;

-- 2) Enforce display_name on family_messages matches the sender's family_members record.
CREATE OR REPLACE FUNCTION public.enforce_family_message_display_name()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  SELECT display_name INTO _name
  FROM public.family_members
  WHERE family_id = NEW.family_id AND user_id = NEW.user_id;

  IF _name IS NULL THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;

  NEW.display_name := _name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_family_message_display_name ON public.family_messages;
CREATE TRIGGER trg_enforce_family_message_display_name
BEFORE INSERT ON public.family_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_family_message_display_name();
