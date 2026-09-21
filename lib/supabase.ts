import {env} from "cloudflare:workers";
import {resolveEnv} from "@supabase/server/core";
/** Configuração do Supabase lida do ambiente do Worker (nunca é enviada ao browser). */
export function supabaseEnv(){
 return resolveEnv({
  url:env.SUPABASE_URL,
  publishableKeys:env.SUPABASE_PUBLISHABLE_KEY?{default:env.SUPABASE_PUBLISHABLE_KEY}:{},
  secretKeys:env.SUPABASE_SECRET_KEY?{default:env.SUPABASE_SECRET_KEY}:{},
  jwks:env.SUPABASE_JWKS_URL?new URL(env.SUPABASE_JWKS_URL):null
 });
}
