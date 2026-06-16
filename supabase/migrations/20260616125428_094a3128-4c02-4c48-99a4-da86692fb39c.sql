
-- Allow family creator to insert members other than themselves
DROP POLICY IF EXISTS "creator self join" ON public.family_members;
CREATE POLICY "creator can add members"
ON public.family_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_members.family_id
      AND f.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

-- RPC: add member by phone (phone is the local-part of the synthesized email)
CREATE OR REPLACE FUNCTION public.add_family_member_by_phone(
  _family_id uuid,
  _phone text,
  _display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _clean_phone text;
  _target_email text;
  _target_uid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _display_name IS NULL OR length(trim(_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required';
  END IF;

  -- Verify caller is the family creator
  IF NOT EXISTS (
    SELECT 1 FROM public.families WHERE id = _family_id AND created_by = _uid
  ) THEN
    RAISE EXCEPTION 'Only the family creator can add members';
  END IF;

  _clean_phone := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  IF length(_clean_phone) < 7 THEN
    RAISE EXCEPTION 'Invalid phone number';
  END IF;

  _target_email := _clean_phone || '@thermominder.app';

  SELECT id INTO _target_uid FROM auth.users WHERE lower(email) = lower(_target_email);
  IF _target_uid IS NULL THEN
    RAISE EXCEPTION 'No account found for this phone number. Ask them to create an account first.';
  END IF;

  INSERT INTO public.family_members (family_id, user_id, display_name)
  VALUES (_family_id, _target_uid, trim(_display_name))
  ON CONFLICT (family_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name;

  RETURN _target_uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_family_member_by_phone(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_family_member_by_phone(uuid, text, text) TO authenticated;
