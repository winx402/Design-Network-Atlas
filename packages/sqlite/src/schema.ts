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

export const outputReferences = sqliteTable("output_references", {
  outputReferenceId: text("output_reference_id").primaryKey(),
  graphId: text("graph_id").notNull(),
  phenotypeVersionId: text("phenotype_version_id").notNull(),
  libraryId: text("library_id"),
  status: text("status").notNull(),
  tags: text("tags", { mode: "json" }).notNull(),
  normalizedTags: text("normalized_tags", { mode: "json" }).notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const phenotypeLibraries = sqliteTable("phenotype_libraries", {
  libraryId: text("library_id").primaryKey(),
  name: text("name").notNull(),
  profile: text("profile").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const storageMounts = sqliteTable("storage_mounts", {
  mountId: text("mount_id").primaryKey(),
  libraryId: text("library_id").notNull(),
  storageType: text("storage_type").notNull(),
  adapterKind: text("adapter_kind").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const phenotypeLibraryGraphBindings = sqliteTable("phenotype_library_graph_bindings", {
  bindingId: text("binding_id").primaryKey(),
  libraryId: text("library_id").notNull(),
  graphId: text("graph_id").notNull(),
  role: text("role").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const externalLibraryMappings = sqliteTable("external_library_mappings", {
  mappingId: text("mapping_id").primaryKey(),
  libraryId: text("library_id").notNull(),
  mountId: text("mount_id").notNull(),
  adapterId: text("adapter_id").notNull(),
  status: text("status").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const libraryRoutingPolicies = sqliteTable("library_routing_policies", {
  routingPolicyId: text("routing_policy_id").primaryKey(),
  libraryId: text("library_id").notNull(),
  priority: integer("priority").notNull(),
  status: text("status").notNull(),
  targetMountId: text("target_mount_id").notNull(),
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
