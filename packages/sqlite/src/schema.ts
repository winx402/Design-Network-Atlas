import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const graphs = sqliteTable("graphs", {
  graphId: text("graph_id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  currentVersion: text("current_version").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const templatePacks = sqliteTable("template_packs", {
  templatePackId: text("template_pack_id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const geneTemplates = sqliteTable("gene_templates", {
  templateId: text("template_id").primaryKey(),
  templatePackId: text("template_pack_id"),
  domain: text("domain").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const nodes = sqliteTable("nodes", {
  nodeId: text("node_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  currentVersion: text("current_version").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const nodeVersions = sqliteTable("node_versions", {
  nodeVersionId: text("node_version_id").primaryKey(),
  nodeId: text("node_id").notNull(),
  graphId: text("graph_id").notNull(),
  version: text("version").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const edges = sqliteTable("edges", {
  edgeId: text("edge_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  fromNodeId: text("from_node_id").notNull(),
  toNodeId: text("to_node_id").notNull(),
  edgeType: text("edge_type").notNull(),
  status: text("status").notNull(),
  currentVersion: text("current_version").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const phenotypes = sqliteTable("phenotypes", {
  phenotypeId: text("phenotype_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  nodeId: text("node_id").notNull(),
  phenotypeType: text("phenotype_type").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const phenotypeVersions = sqliteTable("phenotype_versions", {
  phenotypeVersionId: text("phenotype_version_id").primaryKey(),
  phenotypeId: text("phenotype_id").notNull(),
  graphId: text("graph_id").notNull(),
  nodeId: text("node_id").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const assets = sqliteTable("assets", {
  assetId: text("asset_id").primaryKey(),
  linkedObjectType: text("linked_object_type").notNull(),
  linkedObjectId: text("linked_object_id").notNull(),
  status: text("status").notNull(),
  tags: text("tags", { mode: "json" }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const reviewRecords = sqliteTable("review_records", {
  reviewRecordId: text("review_record_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const impactRecords = sqliteTable("impact_records", {
  impactRecordId: text("impact_record_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  changedObjectType: text("changed_object_type").notNull(),
  changedObjectId: text("changed_object_id").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull()
});

export const objectTags = sqliteTable("object_tags", {
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  tag: text("tag").notNull(),
  createdAt: text("created_at").notNull()
});

export const tags = sqliteTable("tags", {
  tag: text("tag").primaryKey(),
  usageCount: integer("usage_count").notNull().default(0)
});
