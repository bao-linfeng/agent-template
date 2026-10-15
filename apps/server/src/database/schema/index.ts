import { relations } from 'drizzle-orm';
import { embeddingModels } from './ai.js';
import { authSessions } from './auth.js';
import { chunks, documents, knowledgeBases } from './rag.js';
import { roles, userRoles } from './rbac.js';
import { users } from './users.js';

export * from './ai.js';
export * from './auth.js';
export * from './rag.js';
export * from './rbac.js';
export * from './users.js';

export const usersRelations = relations(users, ({ many }) => ({
  userRoles: many(userRoles),
  sessions: many(authSessions),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [knowledgeBases.ownerId],
      references: [users.id],
    }),
    embeddingModel: one(embeddingModels, {
      fields: [knowledgeBases.embeddingModelId],
      references: [embeddingModels.id],
    }),
    documents: many(documents),
  }),
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [documents.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, {
    fields: [chunks.documentId],
    references: [documents.id],
  }),
}));
