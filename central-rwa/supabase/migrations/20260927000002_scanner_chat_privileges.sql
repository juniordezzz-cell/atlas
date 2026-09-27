-- Supabase pode conceder EXECUTE explicitamente a anon/authenticated por
-- ALTER DEFAULT PRIVILEGES. Revogar PUBLIC sozinho não remove esses grants.
revoke all on function public.scanner_chat_reserve(text, integer) from anon, authenticated;
revoke all on scanner.chat_usage from anon, authenticated;
