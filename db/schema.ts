import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
export const properties = sqliteTable("properties", {id:text("id").primaryKey(),name:text("name").notNull(),payload:text("payload").notNull(),version:integer("version").notNull().default(1),updatedAt:text("updated_at").notNull()});

export const corporates = sqliteTable("corporates", {
 id: text("id").primaryKey(), name: text("name").notNull(), payload: text("payload").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(),
 lastWriteId: text("last_write_id").notNull(), contract: text("contract")
});
export const corporateProperties = sqliteTable("corporate_properties", {
 corporateId: text("corporate_id").notNull().references(()=>corporates.id,{onDelete:"cascade"}),
 propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"restrict"})
}, t=>[primaryKey({columns:[t.corporateId,t.propertyId]}),index("idx_corporate_properties_property_id").on(t.propertyId)]);

export const trainingWorkspace = sqliteTable("training_workspace", {
 id:text("id").primaryKey(),payload:text("payload").notNull(),version:integer("version").notNull(),updatedAt:text("updated_at").notNull()
});

export const collaborators = sqliteTable("collaborators", {
 id: text("id").primaryKey(), kind: text("kind").notNull(), name: text("name").notNull(), payload: text("payload").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(),
 promoCode: text("promo_code"), shareToken: text("share_token")
}, t=>[index("idx_collaborators_kind").on(t.kind),uniqueIndex("uq_collaborators_promo_code").on(t.promoCode),uniqueIndex("uq_collaborators_share_token").on(t.shareToken)]);
export const collaboratorResults = sqliteTable("collaborator_results", {
 id: text("id").primaryKey(), ownerId: text("owner_id").notNull().references(()=>collaborators.id,{onDelete:"cascade"}),
 date: text("date").notNull(), bookings: integer("bookings").notNull(), nights: integer("nights").notNull(), revenueCents: integer("revenue_cents").notNull(),
 note: text("note").notNull().default(""), createdAt: text("created_at").notNull()
}, t=>[index("idx_collaborator_results_owner").on(t.ownerId,t.date)]);

export const campaigns = sqliteTable("campaigns", {
 id: text("id").primaryKey(), name: text("name").notNull(), payload: text("payload").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(), lastWriteId: text("last_write_id").notNull()
});
export const campaignProperties = sqliteTable("campaign_properties", {
 campaignId: text("campaign_id").notNull().references(()=>campaigns.id,{onDelete:"cascade"}),
 propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"restrict"})
}, t=>[primaryKey({columns:[t.campaignId,t.propertyId]}),index("idx_campaign_properties_property_id").on(t.propertyId)]);

export const propertyRates = sqliteTable("property_rates", {
 id: text("id").primaryKey(), propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"cascade"}),
 name: text("name").notNull(), code: text("code").notNull()
}, t=>[index("idx_property_rates_property_id").on(t.propertyId)]);
export const campaignRates = sqliteTable("campaign_rates", {
 campaignId: text("campaign_id").notNull().references(()=>campaigns.id,{onDelete:"cascade"}),
 rateId: text("rate_id").notNull().references(()=>propertyRates.id,{onDelete:"restrict"})
}, t=>[primaryKey({columns:[t.campaignId,t.rateId]}),index("idx_campaign_rates_rate_id").on(t.rateId)]);
export const campaignOperators = sqliteTable("campaign_operators", {
 campaignId: text("campaign_id").notNull().references(()=>campaigns.id,{onDelete:"cascade"}),
 operatorId: text("operator_id").notNull().references(()=>operators.id,{onDelete:"restrict"})
}, t=>[primaryKey({columns:[t.campaignId,t.operatorId]}),index("idx_campaign_operators_operator_id").on(t.operatorId)]);

export const teamMembers = sqliteTable("team_members", {
 id: text("id").primaryKey(), email: text("email").notNull(), name: text("name").notNull(), role: text("role").notNull(), status: text("status").notNull(),
 payload: text("payload").notNull(), version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull()
}, t=>[uniqueIndex("uq_team_members_email").on(t.email)]);
export const teamMemberProperties = sqliteTable("team_member_properties", {
 memberId: text("member_id").notNull().references(()=>teamMembers.id,{onDelete:"cascade"}),
 propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"cascade"})
}, t=>[primaryKey({columns:[t.memberId,t.propertyId]}),index("idx_team_member_properties_property_id").on(t.propertyId)]);

export const tools = sqliteTable("tools", {
 id: text("id").primaryKey(), name: text("name").notNull(), payload: text("payload").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull()
});

export const operators = sqliteTable("operators", {
 id: text("id").primaryKey(), name: text("name").notNull(), payload: text("payload").notNull(),
 version: integer("version").notNull().default(1), updatedAt: text("updated_at").notNull(), lastWriteId: text("last_write_id").notNull()
});
export const operatorProperties = sqliteTable("operator_properties", {
 operatorId: text("operator_id").notNull().references(()=>operators.id,{onDelete:"cascade"}),
 propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"cascade"})
}, t=>[primaryKey({columns:[t.operatorId,t.propertyId]}),index("idx_operator_properties_property_id").on(t.propertyId)]);
export const operatorMessages = sqliteTable("operator_messages", {
 id: text("id").primaryKey(), operatorId: text("operator_id").notNull().references(()=>operators.id,{onDelete:"cascade"}),
 propertyId: text("property_id").references(()=>properties.id,{onDelete:"cascade"}), replyToId: text("reply_to_id"),
 authorEmail: text("author_email").notNull(), authorName: text("author_name").notNull(), body: text("body").notNull(), createdAt: text("created_at").notNull()
}, t=>[index("idx_operator_messages_operator").on(t.operatorId,t.createdAt)]);
export const operatorAttachments = sqliteTable("operator_attachments", {
 id: text("id").primaryKey(), messageId: text("message_id").notNull().references(()=>operatorMessages.id,{onDelete:"cascade"}),
 key: text("key").notNull(), name: text("name").notNull(), size: integer("size").notNull(), type: text("type").notNull()
}, t=>[index("idx_operator_attachments_message").on(t.messageId)]);

export const unitKeysafes = sqliteTable("unit_keysafes", {
 unitId: text("unit_id").primaryKey(), propertyId: text("property_id").notNull().references(()=>properties.id,{onDelete:"cascade"}),
 code: text("code").notNull(), updatedAt: text("updated_at").notNull()
}, t=>[index("idx_unit_keysafes_property_id").on(t.propertyId)]);
