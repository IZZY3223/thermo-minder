
-- Tighten family_members INSERT: only the family creator can self-insert directly.
-- All other joins must go through join_family_by_code (SECURITY DEFINER).
DROP POLICY IF EXISTS "self join" ON public.family_members;

CREATE POLICY "creator self join"
ON public.family_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.families f
    WHERE f.id = family_id AND f.created_by = auth.uid()
  )
);

-- Revoke EXECUTE from anon on SECURITY DEFINER functions; keep authenticated.
REVOKE EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_family_invite_code(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.join_family_by_code(text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_family_message_display_name() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_family_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_family_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_family_by_code(text, text) TO authenticated;
