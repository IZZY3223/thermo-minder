
-- families
CREATE TABLE public.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.families TO authenticated;
GRANT ALL ON public.families TO service_role;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;

-- members
CREATE TABLE public.family_members (
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- helper: am I a member?
CREATE OR REPLACE FUNCTION public.is_family_member(_family uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.family_members WHERE family_id = _family AND user_id = _user);
$$;

-- messages
CREATE TABLE public.family_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_messages TO authenticated;
GRANT ALL ON public.family_messages TO service_role;
ALTER TABLE public.family_messages ENABLE ROW LEVEL SECURITY;

-- policies: families
CREATE POLICY "members view family" ON public.families FOR SELECT TO authenticated
  USING (public.is_family_member(id, auth.uid()));
CREATE POLICY "anyone create family" ON public.families FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator update family" ON public.families FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "creator delete family" ON public.families FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- policies: members
CREATE POLICY "members view roster" ON public.family_members FOR SELECT TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "self join" ON public.family_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "self update membership" ON public.family_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "self leave" ON public.family_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- policies: messages
CREATE POLICY "members read messages" ON public.family_messages FOR SELECT TO authenticated
  USING (public.is_family_member(family_id, auth.uid()));
CREATE POLICY "members post messages" ON public.family_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_family_member(family_id, auth.uid()));
CREATE POLICY "author delete message" ON public.family_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- realtime
ALTER TABLE public.family_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.family_messages;
