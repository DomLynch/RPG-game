-- Down for 202610130031: revoke only what 0031 newly granted, frankendom_verifier on origins_skill_focus.
-- frankendom_origins keeps its grant from 202610130029, and the revoke from public/anon/authenticated only repeated what 0029 already did.
revoke execute on function public.origins_skill_focus(uuid, text, text, boolean) from frankendom_verifier;
