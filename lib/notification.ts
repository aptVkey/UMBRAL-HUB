import {z} from "zod";
/** Tipos de aviso por email. Cada membro liga ou desliga cada um nas Definições. */
export const NOTIFY_EVENTS=[
 {key:"approvalRequested",label:"Pedidos para aprovar",hint:"Quando um contribuidor propõe uma alteração numa área que podes aprovar."},
 {key:"approvalDecided",label:"Decisões sobre os meus pedidos",hint:"Quando uma proposta tua é aprovada ou rejeitada."},
 {key:"recordChanged",label:"Alterações nas minhas áreas",hint:"Quando alguém cria, altera ou elimina um registo numa área a que tens acesso. No máximo um aviso por registo a cada 30 minutos."},
] as const;
export type NotifyEvent=typeof NOTIFY_EVENTS[number]["key"];
export type NotifyPrefs=Record<NotifyEvent,boolean>;
export const DEFAULT_PREFS:NotifyPrefs={approvalRequested:true,approvalDecided:true,recordChanged:true};
export const prefsSchema=z.object({approvalRequested:z.boolean(),approvalDecided:z.boolean(),recordChanged:z.boolean()});
export const withDefaults=(p:Partial<NotifyPrefs>|null|undefined):NotifyPrefs=>({...DEFAULT_PREFS,...(p||{})});
