-- Documentation of built-in functions
/*
 * Auth Functions (automatically provided by Supabase Auth)
 * These functions are available in the auth schema
 *
 * auth.email() 
 *   Returns the email of the authenticated user
 *   Example: select auth.email();
 *
 * auth.uid() 
 *   Returns the UUID of the authenticated user
 *   Example: select auth.uid();
 *
 * auth.role() 
 *   Returns the role of the authenticated user
 *   Example: select auth.role();
 *
 * auth.jwt() 
 *   Returns the full JWT claims
 *   Example: select auth.jwt();
 */

/*
 * Extensions Functions (provided by PostgreSQL extensions)
 * 
 * Cryptographic:
 * - algorithm_sign(signables text, secret text, algorithm text)
 * - armor(bytea) / dearmor(text)
 * - crypt(text, text)
 * - decrypt(bytea, bytea, text) / encrypt(bytea, bytea, text)
 * - digest(bytea, text)
 * - hmac(text, text, text)
 * 
 * PGP:
 * - pgp_sym_encrypt() / pgp_sym_decrypt()
 * - pgp_pub_encrypt() / pgp_pub_decrypt()
 * 
 * UUID:
 * - uuid_generate_v1()
 * - uuid_generate_v4()
 * 
 * URL:
 * - url_encode(data bytea)
 * - url_decode(data text)
 */

/*
 * Storage Functions (provided by Supabase Storage)
 * 
 * - can_insert_object(bucketid text, name text, owner uuid, metadata jsonb)
 * - extension(name text)
 * - filename(name text)
 * - foldername(name text)
 * - get_size_by_bucket()
 * - search(prefix text, bucketname text, limits integer, levels integer, offsets integer)
 * - update_updated_at_column()
 */

/*
 * Realtime Functions (provided by Supabase Realtime)
 * 
 * - apply_rls(wal jsonb, max_record_bytes integer)
 * - broadcast_changes(topic text, event text, operation text)
 * - list_changes(publication name, slot_name name, max_changes integer)
 * - send(payload jsonb, event text, topic text)
 * - subscription_check_filters()
 */

/*
 * Vault Functions (provided by Supabase Vault)
 * 
 * - create_secret(new_secret text, new_name text, new_description text)
 * - update_secret(secret_id uuid, new_secret text, new_name text)
 */

/*
 * GraphQL Functions (provided by Supabase GraphQL)
 * 
 * - resolve(query text, variables jsonb, operationName text)
 * - comment_directive(comment_ text)
 * - exception(message text)
 */

-- Enable necessary extensions
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists moddatetime schema extensions;