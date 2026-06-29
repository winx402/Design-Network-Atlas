import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createEmptyWorkbenchSnapshot,
  loadWorkbenchForApp,
  WorkbenchAppLoadState,
  WorkbenchGenerationJob,
  WorkbenchGenerationPlan,
  WorkbenchGenerationTask,
  WorkbenchGraphDetail,
  WorkbenchLibrarySummary,
  WorkbenchPreview,
  WorkbenchResultPreview,
  WorkbenchSnapshot
} from "./workbench-data";
import "./style.css";

type ModuleId = "map" | "graph" | "generation" | "library";

const moduleLabels: Array<{ id: ModuleId; label: string; shortLabel: string }> = [
  { id: "map", label: "Atlas Map", shortLabel: "Map" },
  { id: "graph", label: "Graph Explorer", shortLabel: "Graph" },
  { id: "generation", label: "Generation Board", shortLabel: "Generation" },
  { id: "library", label: "Phenotype Library", shortLabel: "Library" }
];

const traceLegend = "Plan -> Task -> Compile Artifact -> Generation Job -> Phenotype Version -> Output Reference / Asset";

const emptyState: WorkbenchAppLoadState = {
  status: "loading",
  snapshot: createEmptyWorkbenchSnapshot(),
  phenotypes: [],
  generationPlans: [],
  generationTasks: []
};

export function ReadonlyWorkbench(props: { initialState?: WorkbenchAppLoadState }) {
  const [loadState, setLoadState] = useState<WorkbenchAppLoadState>(props.initialState ?? emptyState);
  const [activeModule, setActiveModule] = useState<ModuleId>("map");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedGraphId, setSelectedGraphId] = useState(() => firstGraphId(props.initialState?.snapshot ?? emptyState.snapshot));
  const [inspectorDetail, setInspectorDetail] = useState<InspectorDetail>(() =>
    inspectorFromSnapshot(props.initialState?.snapshot ?? emptyState.snapshot)
  );
  const snapshot = loadState.snapshot;
  const counts = snapshot.overview.counts;
  const isEmpty = loadState.status === "ready" && (counts.graphs ?? 0) === 0 && (counts.phenotypes ?? 0) === 0 && (counts.libraries ?? 0) === 0;
  const filteredSnapshot = useMemo(() => filterSnapshot(snapshot, query, statusFilter), [query, snapshot, statusFilter]);
  const selectedGraph = filteredSnapshot.graphs.find((graph) => graph.graphId === selectedGraphId) ?? filteredSnapshot.graphs[0];

  useEffect(() => {
    if (props.initialState) return;
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    void loadWorkbenchForApp({
      baseUrl: window.location.origin,
      graphId: params.get("graphId") ?? undefined,
      demo: params.has("demo")
    }).then((result) => {
      if (cancelled) return;
      setLoadState(result);
      setSelectedGraphId(firstGraphId(result.snapshot));
      setInspectorDetail(inspectorFromSnapshot(result.snapshot));
    });
    return () => {
      cancelled = true;
    };
  }, [props.initialState]);

  function selectGraph(graph: WorkbenchGraphDetail) {
    setSelectedGraphId(graph.graphId);
    setInspectorDetail(inspectGraph(graph, snapshot));
    setActiveModule("graph");
  }

  function selectDetail(detail: InspectorDetail) {
    setInspectorDetail(detail);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="product-name">DNA: Design Network Atlas</p>
          <h1>DNA Read-only Explorer</h1>
          <p className="read-only-note">Local map-first view of design graphs, generation traces, and phenotype results. Web remains read-only.</p>
        </div>
        <div className="snapshot-status" aria-label="Snapshot status">
          <StatusPill label="Graphs" value={counts.graphs ?? 0} />
          <StatusPill label="Species" value={counts.speciesNodes ?? 0} />
          <StatusPill label="Plans/Tasks" value={`${counts.generationPlans ?? 0}/${counts.generationTasks ?? 0}`} />
          <StatusPill label="Results" value={counts.outputReferences ?? 0} />
        </div>
      </header>

      <nav className="module-nav mobile-tabbar" aria-label="Explorer modules">
        {moduleLabels.map((module) => (
          <button
            key={module.id}
            className={activeModule === module.id ? "is-active" : ""}
            onClick={() => setActiveModule(module.id)}
            type="button"
          >
            <span className="desktop-label">{module.label}</span>
            <span className="mobile-label">{module.shortLabel}</span>
          </button>
        ))}
      </nav>

      {loadState.status === "loading" ? (
        <section className="system-state" aria-live="polite">
          Loading read-only explorer snapshot from the local DNA API...
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="system-state error" role="alert">
          <strong>Unable to load workbench snapshot.</strong>
          <span>{loadState.error}</span>
          <span>No durable DNA records were changed by this read-only page.</span>
        </section>
      ) : null}

      {isEmpty ? (
        <section className="system-state">
          <strong>No DNA records found.</strong>
          <span>Use the CLI/service boundary to add local graph or generation records, then refresh this read-only explorer.</span>
        </section>
      ) : null}

      <section className="filter-sheet" aria-label="Read-only filters">
        <label>
          <span>Search objects</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="graph, group, species, task, result, asset" />
        </label>
        <label>
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="active">active</option>
            <option value="candidate">candidate</option>
            <option value="accepted">accepted</option>
            <option value="blocked">blocked</option>
            <option value="missing">missing</option>
            <option value="stale">stale</option>
          </select>
        </label>
      </section>

      <section className="explorer-grid" aria-label="DNA read-only explorer">
        <section className="module-surface" aria-label="Explorer module content">
          <section className="module-view" aria-hidden={activeModule !== "map"}>
            <AtlasMapView snapshot={filteredSnapshot} onSelect={selectDetail} onOpenGraph={selectGraph} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "graph"}>
            <GraphExplorerView graph={selectedGraph} snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "generation"}>
            <GenerationBoardView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "library"}>
            <PhenotypeLibraryView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
        </section>
        <Inspector detail={inspectorDetail} />
      </section>
    </main>
  );
}

function AtlasMapView(props: {
  snapshot: WorkbenchSnapshot;
  onSelect: (detail: InspectorDetail) => void;
  onOpenGraph: (graph: WorkbenchGraphDetail) => void;
}) {
  const relationships = getGraphLevelRelationships(props.snapshot);
  return (
    <div className="module-content atlas-view">
      <SectionHeader
        title="Atlas Map"
        subtitle="Graph relationship map for design-language translation, influence, and review navigation."
      />
      <div className="map-tools" aria-label="Map controls">
        <button type="button">Fit</button>
        <button type="button">Neighborhood</button>
        <button type="button">Relationship labels</button>
      </div>
      <section className="graph-relationship-map" aria-label="Graph relationship map">
        {relationships.length ? (
          <svg className="map-lines" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
            {relationships.map((relationship, index) => (
              <g key={relationship.relationshipId}>
                <line
                  className="map-line"
                  x1={index % 2 === 0 ? 14 : 20}
                  y1={24 + index * 14}
                  x2={index % 2 === 0 ? 82 : 72}
                  y2={62 - index * 10}
                />
                <text x="48" y={42 + index * 4}>
                  {relationship.relationshipType}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div className="map-empty-line">No graph-level relationships yet</div>
        )}
        <div className="map-node-grid">
          {props.snapshot.graphs.map((graph, index) => (
            <button
              key={graph.graphId}
              className={`graph-map-node node-${index % 6}`}
              onClick={() => props.onOpenGraph(graph)}
              onFocus={() => props.onSelect(inspectGraph(graph, props.snapshot))}
              type="button"
            >
              <span className="node-type">Graph</span>
              <strong>{graph.name}</strong>
              <span>{graph.purpose || "No purpose recorded"}</span>
              <div className="node-meta">
                <StatusChip status={graph.status} />
                <span>{graph.currentVersion ? `v${graph.currentVersion}` : "version n/a"}</span>
              </div>
              <div className="node-counts">
                <span>{graph.counts.groups ?? 0} groups</span>
                <span>{graph.counts.nodes ?? 0} species</span>
                <span>{graph.counts.phenotypes ?? 0} phenotypes</span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="map-lower-grid">
        <article className="panel legend-panel">
          <div className="panel-title">
            <h3>Legend</h3>
            <span>{relationships.length} graph-level relationships</span>
          </div>
          <p>
            Solid lines represent active DesignRelationship contracts. Labels show relationship type; Inspector shows endpoints,
            must-preserve, must-avoid, and review questions.
          </p>
        </article>
        <article className="panel relationship-route-list">
          <div className="panel-title">
            <h3>Graph relationship routes</h3>
            <span>{relationships.length}</span>
          </div>
          {relationships.length ? (
            relationships.map((relationship) => (
              <button
                key={relationship.relationshipId}
                className="relationship-route"
                onClick={() => props.onSelect(inspectRelationship(relationship))}
                type="button"
              >
                <strong>
                  {relationship.source?.graphId ?? "source"} {" -> "} {relationship.target?.graphId ?? "target"}
                </strong>
                <span>{relationship.relationshipType}</span>
                <small>{relationship.summary}</small>
              </button>
            ))
          ) : (
            <p className="muted">Graph boards remain clickable; internal graph structure is still available.</p>
          )}
        </article>
      </section>
    </div>
  );
}

function GraphExplorerView(props: {
  graph: WorkbenchGraphDetail | undefined;
  snapshot: WorkbenchSnapshot;
  onSelect: (detail: InspectorDetail) => void;
}) {
  if (!props.graph) return <EmptyPanel title="No graph selected" />;
  const graph = props.graph;
  const groupedNodes = groupNodesByGroup(graph);
  const ungrouped = graph.nodes.filter((node) => node.groupIds.length === 0);
  return (
    <div className="module-content graph-explorer">
      <SectionHeader title="Graph Explorer" subtitle="Graph interior map with group lanes, species cards, relationships, semantics, and phenotype overlays." />
      <article className="graph-intro">
        <div>
          <p className="section-label">{graph.graphId}</p>
          <h2>{graph.name}</h2>
          <p>{graph.purpose || "No graph purpose recorded."}</p>
        </div>
        <div className="intro-tags" aria-label="Graph summary tags">
          <StatusChip status={graph.status} />
          <span>{graph.currentVersion ? `version ${graph.currentVersion}` : "version n/a"}</span>
          <span>{graph.counts.relationships ?? 0} relationships</span>
          <span>{graph.counts.acceptedVersions ?? 0} accepted</span>
          <span>{graph.counts.candidateVersions ?? 0} candidate</span>
        </div>
      </article>
      <div className="quick-anchors" aria-label="Graph Explorer sections">
        <span>Groups</span>
        <span>Species</span>
        <span>Relationships</span>
        <span>Semantics</span>
        <span>Phenotypes</span>
        <span>Compile Trace</span>
      </div>
      <section className="graph-interior-map" aria-label="Graph interior map">
        {graph.groups.map((group) => (
          <article key={group.groupId} className="group-lane">
            <button className="lane-head" onClick={() => props.onSelect(inspectGroup(group, graph))} type="button">
              <span className="node-type">SpeciesGroup</span>
              <strong>{group.name}</strong>
              <span>{group.memberNodeIds.length} members · {(group.phenotypeIds ?? []).length} phenotypes</span>
            </button>
            <div className="lane-semantics">
              {(group.sharedFacts ?? []).slice(0, 2).map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
              {(group.phenotypeTypeSuggestions ?? []).slice(0, 2).map((suggestion) => (
                <span key={suggestion}>{suggestion}</span>
              ))}
            </div>
            <div className="species-card-row">
              {(groupedNodes[group.groupId] ?? []).map((node) => (
                <SpeciesCard key={node.nodeId} graph={graph} node={node} onSelect={props.onSelect} />
              ))}
            </div>
          </article>
        ))}
        {ungrouped.length ? (
          <article className="group-lane">
            <div className="lane-head static">
              <span className="node-type">Ungrouped nodes</span>
              <strong>Ungrouped species</strong>
              <span>{ungrouped.length} nodes need review grouping</span>
            </div>
            <div className="species-card-row">
              {ungrouped.map((node) => (
                <SpeciesCard key={node.nodeId} graph={graph} node={node} onSelect={props.onSelect} />
              ))}
            </div>
          </article>
        ) : null}
      </section>
      <section className="graph-support-grid">
        <ObjectPanel
          title="Design relationships"
          type="DesignRelationship"
          items={graph.relationships.map((relationship) => ({
            id: relationship.relationshipId,
            title: relationship.relationshipType,
            detail: relationship.summary,
            status: relationship.status,
            raw: relationship,
            inspect: inspectRelationship(relationship)
          }))}
          onSelect={props.onSelect}
        />
        <ObjectPanel
          title="Bound semantics"
          type="BoundSemantics"
          items={semanticItems(graph).map((item) => ({
            id: item.id,
            title: item.title,
            detail: item.detail,
            status: item.status,
            raw: item
          }))}
          onSelect={props.onSelect}
        />
        <ObjectPanel
          title="Phenotype overlay"
          type="Phenotype"
          items={graph.phenotypeOverlay.map((phenotype) => ({
            id: phenotype.phenotypeId,
            title: phenotype.name,
            detail: `${phenotype.phenotypeType} · ${phenotype.versions.length} versions`,
            status: phenotype.currentAcceptedVersionId ? "accepted" : phenotype.status,
            raw: phenotype,
            inspect: inspectPhenotypeOverlay(phenotype, props.snapshot)
          }))}
          onSelect={props.onSelect}
        />
        <ObjectPanel
          title="Compile trace"
          type="CompileArtifact"
          items={(graph.compileTrace?.artifacts ?? []).map((artifact) => ({
            id: String(artifact.artifactId ?? "artifact"),
            title: String(artifact.targetLevel ?? "compile artifact"),
            detail: `${artifact.dependencyCount ?? 0} dependencies · ${artifact.feedbackCount ?? 0} feedback`,
            status: String(artifact.validity ?? "current"),
            raw: artifact
          }))}
          onSelect={props.onSelect}
        />
      </section>
    </div>
  );
}

function SpeciesCard(props: {
  graph: WorkbenchGraphDetail;
  node: WorkbenchGraphDetail["nodes"][number];
  onSelect: (detail: InspectorDetail) => void;
}) {
  const phenotypes = props.graph.phenotypeOverlay.filter((phenotype) => phenotype.nodeId === props.node.nodeId);
  const candidateCount = phenotypes.reduce((count, phenotype) => count + phenotype.versions.filter((version) => version.status === "candidate").length, 0);
  const acceptedCount = phenotypes.filter((phenotype) => Boolean(phenotype.currentAcceptedVersionId)).length;
  return (
    <button className="species-card" onClick={() => props.onSelect(inspectSpecies(props.node, props.graph))} type="button">
      <span className="node-type">SpeciesNode</span>
      <strong>{props.node.name}</strong>
      <span>{props.node.category ?? props.node.level ?? "type n/a"}</span>
      <div className="semantic-meter">
        <span>{props.node.motifs?.length ?? 0} motifs</span>
        <span>{props.node.relationshipIds?.length ?? 0} relations</span>
        <span>{props.node.latestCompileArtifactId ? "compiled" : "compile missing"}</span>
      </div>
      <div className="phenotype-badges">
        <span>{phenotypes.length ? `${phenotypes.length} planned` : "missing phenotype"}</span>
        <span>{acceptedCount} accepted</span>
        <span>{candidateCount} candidate</span>
      </div>
    </button>
  );
}

function GenerationBoardView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: InspectorDetail) => void }) {
  const results = props.snapshot.libraries.flatMap((library) => library.results);
  return (
    <div className="module-content generation-board">
      <SectionHeader title="Generation Board" subtitle="Read-only production board for plans, tasks, jobs, compile artifacts, versions, and results." />
      <div className="board-filters" aria-label="Generation filters">
        <span>Graph</span>
        <span>Scope type</span>
        <span>Priority</span>
        <span>Status</span>
        <span>Tool preference</span>
      </div>
      <section className="trace-path-banner">{traceLegend}</section>
      <div className="board-columns">
        <GenerationColumn
          title="Plans"
          items={props.snapshot.generation.plans.map((plan) => ({
            key: plan.planId,
            node: <PlanCard plan={plan} onSelect={props.onSelect} />
          }))}
        />
        <GenerationColumn
          title="Tasks"
          items={props.snapshot.generation.tasks.map((task) => ({
            key: task.taskId,
            node: <TaskCard task={task} onSelect={props.onSelect} />
          }))}
        />
        <GenerationColumn
          title="Generation jobs"
          items={props.snapshot.generation.jobs.map((job) => ({
            key: job.generationJobId,
            node: <JobCard job={job} onSelect={props.onSelect} />
          }))}
        />
        <GenerationColumn
          title="Versions / Results"
          items={results.map((result) => ({
            key: result.versionId,
            node: (
              <button
                className="board-card"
                onClick={() => props.onSelect(inspectLibraryResult(result))}
                type="button"
              >
                <strong>{result.phenotypeName}</strong>
                <span>{result.phenotypeType}</span>
                <StatusChip status={result.versionStatus} />
                <small>{result.referenceCount} output references · {result.assetCount} assets</small>
              </button>
            )
          }))}
        />
      </div>
    </div>
  );
}

function GenerationColumn(props: { title: string; items: Array<{ key: string; node: React.ReactNode }> }) {
  return (
    <section className="board-column">
      <div className="panel-title">
        <h3>{props.title}</h3>
        <span>{props.items.length}</span>
      </div>
      {props.items.length ? props.items.map((item) => <React.Fragment key={item.key}>{item.node}</React.Fragment>) : <p className="muted">No records in this lane.</p>}
    </section>
  );
}

function PlanCard(props: { plan: WorkbenchGenerationPlan; onSelect: (detail: InspectorDetail) => void }) {
  return (
    <button className="board-card plan-card" onClick={() => props.onSelect(inspectPlan(props.plan))} type="button">
      <strong>{props.plan.description || props.plan.planId}</strong>
      <span>{props.plan.scopeType}:{props.plan.scopeId}</span>
      <StatusChip status={props.plan.status} />
      <small>priority {props.plan.priority} · {props.plan.taskCount} tasks · {props.plan.toolPreference ?? "tool n/a"}</small>
    </button>
  );
}

function TaskCard(props: { task: WorkbenchGenerationTask; onSelect: (detail: InspectorDetail) => void }) {
  return (
    <button className="board-card task-card" onClick={() => props.onSelect(inspectTask(props.task))} type="button">
      <strong>{props.task.taskBrief || props.task.taskId}</strong>
      <span>{props.task.phenotypeType} · {props.task.planId ? `from ${props.task.planId}` : "standalone task"}</span>
      <StatusChip status={props.task.status} />
      <small>{taskTraceLabels(props.task).join(" -> ")}</small>
    </button>
  );
}

function JobCard(props: { job: WorkbenchGenerationJob; onSelect: (detail: InspectorDetail) => void }) {
  return (
    <button className="board-card job-card" onClick={() => props.onSelect(inspectJob(props.job))} type="button">
      <strong>{props.job.generationJobId}</strong>
      <span>{props.job.tool ?? "manual"} · {props.job.phenotypeType}</span>
      <StatusChip status={props.job.status} />
      <small>{props.job.phenotypeVersionId ? `version ${props.job.phenotypeVersionId}` : "no linked version"}</small>
    </button>
  );
}

function PhenotypeLibraryView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: InspectorDetail) => void }) {
  const gallery = props.snapshot.libraries.flatMap((library) => library.gallery);
  const previews = gallery.length ? gallery : props.snapshot.resultPreviews;
  return (
    <div className="module-content library-view">
      <SectionHeader title="Phenotype Library" subtitle="Gallery-first read-only view of phenotype results, output references, asset pointers, and trace links." />
      <div className="library-filters" aria-label="Library filters">
        <span>Gallery</span>
        <span>Versions</span>
        <span>Output References</span>
        <span>Assets</span>
        <span>Libraries / Mounts</span>
      </div>
      {previews.length ? (
        <section className="gallery-grid" aria-label="Phenotype result gallery">
          {previews.map((preview) => (
            <GalleryCard key={`${preview.objectType}-${preview.objectId}`} preview={preview} onSelect={props.onSelect} />
          ))}
        </section>
      ) : (
        <EmptyPanel title="No phenotype result previews in this scope" />
      )}
      <section className="library-detail-grid">
        {props.snapshot.libraries.map((library) => (
          <LibrarySummaryCard key={library.libraryId} library={library} onSelect={props.onSelect} />
        ))}
      </section>
    </div>
  );
}

function GalleryCard(props: { preview: WorkbenchResultPreview; onSelect: (detail: InspectorDetail) => void }) {
  return (
    <button className="gallery-card" onClick={() => props.onSelect(inspectGalleryPreview(props.preview))} type="button">
      <PreviewFrame preview={props.preview.preview} title={props.preview.phenotypeName ?? props.preview.label} />
      <strong>{props.preview.phenotypeName ?? props.preview.label}</strong>
      <span>{props.preview.label}</span>
      <div className="gallery-meta">
        <StatusChip status={props.preview.status} />
        <span>{props.preview.objectType}</span>
      </div>
    </button>
  );
}

function LibrarySummaryCard(props: { library: WorkbenchLibrarySummary; onSelect: (detail: InspectorDetail) => void }) {
  return (
    <article className="panel library-summary">
      <div className="panel-title">
        <div>
          <p className="section-label">{props.library.libraryId}</p>
          <h3>{props.library.name}</h3>
        </div>
        <StatusChip status={props.library.status} />
      </div>
      <p>{props.library.purpose}</p>
      <div className="node-counts">
        <span>{props.library.results.length} results</span>
        <span>{props.library.gallery.length} previews</span>
        <span>{props.library.mountCount} mounts</span>
      </div>
      <div className="mount-list">
        {props.library.mounts.map((mount) => (
          <button
            key={mount.mountId}
            className="mount-row"
            onClick={() => props.onSelect(inspectMount(mount))}
            type="button"
          >
            <strong>{mount.displayName}</strong>
            <span>{mount.storageType} · {mount.adapterKind} · credentials {mount.credentialStatus}</span>
            <code>{mount.displayLocation ?? "[redacted]"}</code>
          </button>
        ))}
      </div>
    </article>
  );
}

function PreviewFrame(props: { preview: WorkbenchPreview; title?: string }) {
  const [failed, setFailed] = useState(false);
  if (props.preview.kind === "image" && props.preview.url && !failed) {
    return <img alt={props.title ?? ""} className="preview-image" loading="lazy" onError={() => setFailed(true)} src={props.preview.url} />;
  }
  return (
    <div className="preview-placeholder" aria-label="Preview unavailable">
      <span>Preview unavailable</span>
      <small>{failed ? "image failed to load" : props.preview.reason ?? "unsupported or redacted"}</small>
    </div>
  );
}

function Inspector(props: { detail: InspectorDetail }) {
  const detail = props.detail;
  return (
    <aside className="inspector detail-drawer" aria-label="Inspector">
      <div className="panel-title">
        <h2>Inspector</h2>
        <StatusChip status={detail.status ?? "read-only"} />
      </div>
      <TraceSection title="Identity" values={[detail.type, detail.id]} />
      <TraceSection title="Summary" values={detail.summary ?? ["Select a graph, relationship, group, species, task, job, version, or asset."]} />
      <TraceSection title="Bound Semantics" values={detail.boundSemantics ?? ["Context, facts, principles, motifs, facets, and rubrics appear when present."]} />
      <TraceSection title="Relationships" values={detail.relationships ?? ["Incoming and outgoing endpoints appear when present."]} />
      <TraceSection title="Generation Links" values={detail.generationLinks ?? ["Plans, tasks, jobs, and compile artifacts appear when present."]} />
      <TraceSection title="Phenotype / Assets" values={detail.phenotypeAssets ?? ["Phenotype versions, output references, and asset previews appear when present."]} />
      <TraceSection title="Provenance" values={detail.provenance ?? ["Created/updated timestamps, dependency vectors, and compile traces appear when present."]} />
      <TraceSection title="Governance" values={detail.governance ?? ["Status, feedback, review readiness, stale, and missing signals appear when present."]} />
      <TraceSection title="External pointers" values={detail.externalPointers ?? ["External pointers are redacted and never expose credentials."]} />
      <details>
        <summary>Raw JSON</summary>
        <pre>{JSON.stringify(detail.raw ?? {}, null, 2)}</pre>
      </details>
    </aside>
  );
}

function TraceSection(props: { title: string; values: string[] }) {
  return (
    <section className="trace-section">
      <h3>{props.title}</h3>
      {props.values.length ? props.values.map((value) => <p key={value}>{value}</p>) : <p>none</p>}
    </section>
  );
}

function ObjectPanel(props: {
  title: string;
  type: string;
  items: Array<{ id: string; title: string; detail: string; status?: string; raw: unknown; inspect?: InspectorDetail }>;
  onSelect: (detail: InspectorDetail) => void;
}) {
  return (
    <section className="panel object-panel">
      <div className="panel-title">
        <h3>{props.title}</h3>
        <span>{props.items.length}</span>
      </div>
      {props.items.length ? (
        props.items.map((item) => (
          <button
            key={item.id}
            className="object-card"
            onClick={() => props.onSelect(item.inspect ?? { type: props.type, id: item.id, status: item.status, raw: item.raw })}
            type="button"
          >
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
            <code>{item.id}</code>
          </button>
        ))
      ) : (
        <p className="muted">No records in this read-only scope.</p>
      )}
    </section>
  );
}

function SectionHeader(props: { title: string; subtitle: string }) {
  return (
    <header className="section-head">
      <h2>{props.title}</h2>
      <p>{props.subtitle}</p>
    </header>
  );
}

function EmptyPanel(props: { title: string }) {
  return (
    <section className="panel empty-state">
      <h2>{props.title}</h2>
      <p className="muted">This read-only page did not change the DNA store.</p>
    </section>
  );
}

function StatusPill(props: { label: string; value: number | string }) {
  return (
    <span className="status-pill">
      <small>{props.label}</small>
      <strong>{props.value}</strong>
    </span>
  );
}

function StatusChip(props: { status: string }) {
  return <span className={`status-chip status-${props.status}`}>{props.status}</span>;
}

interface InspectorDetail {
  type: string;
  id: string;
  status?: string;
  summary?: string[];
  boundSemantics?: string[];
  relationships?: string[];
  generationLinks?: string[];
  phenotypeAssets?: string[];
  provenance?: string[];
  governance?: string[];
  externalPointers?: string[];
  raw?: unknown;
}

function firstGraphId(snapshot: WorkbenchSnapshot) {
  return snapshot.graphs.find((graph) => graph.groups.length > 0 || graph.nodes.length > 0)?.graphId ?? snapshot.graphs[0]?.graphId;
}

function inspectorFromSnapshot(snapshot: WorkbenchSnapshot): InspectorDetail {
  const graph = snapshot.graphs[0];
  if (graph) return inspectGraph(graph, snapshot);
  return {
    type: "Workbench",
    id: "current-snapshot",
    status: "read-only",
    summary: ["No graph selected."],
    raw: snapshot.overview
  };
}

function inspectGraph(graph: WorkbenchGraphDetail, snapshot: WorkbenchSnapshot): InspectorDetail {
  const graphRelationships = getGraphLevelRelationships(snapshot).filter(
    (relationship) => relationship.source?.graphId === graph.graphId || relationship.target?.graphId === graph.graphId
  );
  return {
    type: "Graph",
    id: graph.graphId,
    status: graph.status,
    summary: [graph.name, graph.purpose || "No graph purpose recorded."],
    boundSemantics: semanticItems(graph).map((item) => `${item.title}: ${item.detail}`),
    relationships: [
      `${graph.relationships.length} internal or adjacent design relationships`,
      ...graphRelationships.map((relationship) => `${relationship.source?.graphId ?? "source"} -> ${relationship.target?.graphId ?? "target"} (${relationship.relationshipType})`)
    ],
    generationLinks: [
      `${snapshot.generation.plans.filter((plan) => plan.graphId === graph.graphId).length} plans`,
      `${snapshot.generation.tasks.filter((task) => task.graphId === graph.graphId).length} tasks`,
      `${snapshot.generation.jobs.filter((job) => job.graphId === graph.graphId).length} jobs`
    ],
    phenotypeAssets: [`${graph.phenotypeOverlay.length} phenotypes`, `${snapshot.resultPreviews.filter((preview) => preview.graphId === graph.graphId).length} result previews`],
    provenance: [
      `${graph.compileTrace?.entityArtifacts ?? 0} entity compile artifacts`,
      `${graph.compileTrace?.speciesArtifacts ?? 0} species compile artifacts`,
      `${graph.compileTrace?.phenotypeArtifacts ?? 0} phenotype compile artifacts`
    ],
    governance: [`${graph.counts.candidateVersions ?? 0} candidate versions`, `${graph.counts.acceptedVersions ?? 0} accepted versions`],
    externalPointers: [`${snapshot.libraries.filter((library) => library.graphIds.includes(graph.graphId)).length} libraries in scope`],
    raw: graph.rawJsonSummary ?? graph
  };
}

function inspectGroup(group: WorkbenchGraphDetail["groups"][number], graph: WorkbenchGraphDetail): InspectorDetail {
  return {
    type: "SpeciesGroup",
    id: group.groupId,
    status: group.status,
    summary: [group.name, `${group.memberNodeIds.length} member species`],
    boundSemantics: [...(group.sharedFacts ?? []), ...(group.phenotypeTypeSuggestions ?? []).map((value) => `phenotype suggestion: ${value}`)],
    relationships: (group.relationshipIds ?? []).map((id) => `relationship ${id}`),
    phenotypeAssets: (group.phenotypeIds ?? []).map((id) => `phenotype ${id}`),
    raw: { graphId: graph.graphId, ...group }
  };
}

function inspectSpecies(node: WorkbenchGraphDetail["nodes"][number], graph: WorkbenchGraphDetail): InspectorDetail {
  const phenotypes = graph.phenotypeOverlay.filter((phenotype) => phenotype.nodeId === node.nodeId);
  return {
    type: "SpeciesNode",
    id: node.nodeId,
    status: node.status,
    summary: [node.name, node.category ?? node.level ?? "No category recorded."],
    boundSemantics: [...(node.motifs ?? []).map((motif) => `motif: ${motif}`), `constraints: ${JSON.stringify(node.constraintSummary ?? {})}`],
    relationships: (node.relationshipIds ?? []).map((id) => `relationship ${id}`),
    generationLinks: [node.latestCompileArtifactId ? `species compile artifact ${node.latestCompileArtifactId}` : "species compile artifact missing"],
    phenotypeAssets: phenotypes.map((phenotype) => `${phenotype.name}: ${phenotype.versions.length} versions`),
    raw: { graphId: graph.graphId, ...node }
  };
}

function inspectRelationship(relationship: RelationshipLike): InspectorDetail {
  return {
    type: "DesignRelationship",
    id: relationship.relationshipId,
    status: relationship.status,
    summary: [relationship.relationshipType, relationship.summary || "No relationship summary recorded."],
    relationships: [
      `source: ${endpointLabel(relationship.source)}`,
      `target: ${endpointLabel(relationship.target)}`,
      `direction: ${relationship.direction ?? "source-to-target"}`
    ],
    boundSemantics: [
      `transfer: ${relationship.designContract?.transferRule || "not recorded"}`,
      ...(relationship.designContract?.mustPreserve ?? []).map((value) => `must preserve: ${value}`),
      ...(relationship.designContract?.mustAvoid ?? []).map((value) => `must avoid: ${value}`),
      ...(relationship.designContract?.reviewQuestions ?? []).map((value) => `review: ${value}`)
    ],
    raw: relationship
  };
}

function inspectPhenotypeOverlay(phenotype: WorkbenchGraphDetail["phenotypeOverlay"][number], snapshot: WorkbenchSnapshot): InspectorDetail {
  return {
    type: "Phenotype",
    id: phenotype.phenotypeId,
    status: phenotype.currentAcceptedVersionId ? "accepted" : phenotype.status,
    summary: [phenotype.name, phenotype.phenotypeType],
    generationLinks: phenotype.versions.flatMap((version) =>
      [version.speciesCompileArtifactId, version.phenotypeCompileArtifactId].filter((value): value is string => Boolean(value))
    ),
    phenotypeAssets: [
      ...phenotype.versions.map((version) => `${version.phenotypeVersionId}: ${version.status}`),
      ...snapshot.resultPreviews.filter((preview) => preview.phenotypeId === phenotype.phenotypeId).map((preview) => `${preview.objectType}: ${preview.objectId}`)
    ],
    raw: phenotype
  };
}

function inspectPlan(plan: WorkbenchGenerationPlan): InspectorDetail {
  return {
    type: "GenerationPlan",
    id: plan.planId,
    status: plan.status,
    summary: [plan.description || "No description.", `${plan.scopeType}:${plan.scopeId}`, `priority ${plan.priority}`],
    generationLinks: [`${plan.taskCount} linked tasks`, `version binding: ${JSON.stringify(plan.versionBinding ?? "latest-at-execution")}`],
    provenance: [`created ${plan.createdAt ?? "unknown"}`, `updated ${plan.updatedAt ?? "unknown"}`],
    raw: plan
  };
}

function inspectTask(task: WorkbenchGenerationTask): InspectorDetail {
  return {
    type: "GenerationTask",
    id: task.taskId,
    status: task.status,
    summary: [task.taskBrief || "No task brief.", task.planId ? `from plan ${task.planId}` : "Standalone Task"],
    generationLinks: taskTraceLabels(task),
    governance: [task.blockingReason ? `blocked: ${task.blockingReason}` : "not blocked", `priority ${task.priority}`],
    raw: task
  };
}

function inspectJob(job: WorkbenchGenerationJob): InspectorDetail {
  return {
    type: "GenerationJob",
    id: job.generationJobId,
    status: job.status,
    summary: [job.tool ?? "manual", job.taskBrief ?? "No task brief."],
    generationLinks: [job.phenotypeVersionId ? `Phenotype Version: ${job.phenotypeVersionId}` : "No linked phenotype version"],
    governance: [job.errorSummary ? `error: ${job.errorSummary}` : "no error summary"],
    provenance: [`created ${job.createdAt ?? "unknown"}`, `updated ${job.updatedAt ?? "unknown"}`],
    raw: job
  };
}

function inspectLibraryResult(result: WorkbenchLibrarySummary["results"][number]): InspectorDetail {
  return {
    type: "PhenotypeVersion",
    id: result.versionId,
    status: result.versionStatus,
    summary: [result.phenotypeName, result.phenotypeType],
    phenotypeAssets: [`${result.referenceCount} output references`, `${result.assetCount} assets`, `latest status: ${result.latestStatus}`],
    externalPointers: [`graph ${result.graphId}`, `species ${result.nodeId}`],
    raw: result
  };
}

function inspectGalleryPreview(preview: WorkbenchResultPreview): InspectorDetail {
  return {
    type: preview.objectType === "asset" ? "Asset" : "OutputReference",
    id: preview.objectId,
    status: preview.status,
    summary: [preview.phenotypeName ?? preview.label, preview.label],
    phenotypeAssets: [preview.phenotypeVersionId ? `version ${preview.phenotypeVersionId}` : "no linked version"],
    externalPointers: [preview.libraryId ? `library ${preview.libraryId}` : "library n/a", preview.storageMountId ? `mount ${preview.storageMountId}` : "mount n/a"],
    raw: preview
  };
}

function inspectMount(mount: WorkbenchLibrarySummary["mounts"][number]): InspectorDetail {
  return {
    type: "StorageMount",
    id: mount.mountId,
    status: mount.status,
    summary: [mount.displayName, `${mount.storageType} · ${mount.adapterKind}`],
    externalPointers: [mount.displayLocation ?? "[redacted]", `credentials ${mount.credentialStatus}`],
    raw: mount
  };
}

function taskTraceLabels(task: WorkbenchGenerationTask) {
  return [
    task.planId ? `Plan: ${task.planId}` : "Standalone Task",
    `Task: ${task.taskId}`,
    task.links.speciesCompileArtifactId ? `Compile Artifact: ${task.links.speciesCompileArtifactId}` : undefined,
    task.links.phenotypeCompileArtifactId ? `Compile Artifact: ${task.links.phenotypeCompileArtifactId}` : undefined,
    ...task.links.generationJobIds.map((id) => `Generation Job: ${id}`),
    ...task.links.phenotypeVersionIds.map((id) => `Phenotype Version: ${id}`)
  ].filter((value): value is string => Boolean(value));
}

type RelationshipLike = WorkbenchGraphDetail["relationships"][number];

function getGraphLevelRelationships(snapshot: WorkbenchSnapshot): RelationshipLike[] {
  const seen = new Set<string>();
  return snapshot.graphs
    .flatMap((graph) => graph.relationships)
    .filter((relationship) => relationship.source?.type === "graph" && relationship.target?.type === "graph")
    .filter((relationship) => {
      if (seen.has(relationship.relationshipId)) return false;
      seen.add(relationship.relationshipId);
      return true;
    });
}

function endpointLabel(endpoint: RelationshipLike["source"] | undefined) {
  if (!endpoint || typeof endpoint !== "object") return "unknown";
  const record = endpoint as Record<string, unknown>;
  if (record.type === "graph") return `graph:${String(record.graphId)}`;
  if (record.type === "species-group") return `group:${String(record.groupId)}`;
  if (record.type === "species-node") return `species:${String(record.nodeId)}`;
  return JSON.stringify(endpoint);
}

function groupNodesByGroup(graph: WorkbenchGraphDetail) {
  const groups: Record<string, WorkbenchGraphDetail["nodes"]> = {};
  for (const node of graph.nodes) {
    for (const groupId of node.groupIds) {
      groups[groupId] = groups[groupId] ?? [];
      groups[groupId].push(node);
    }
  }
  return groups;
}

function semanticItems(graph: WorkbenchGraphDetail) {
  const semantics = graph.semantics as
    | {
        contextAttachments?: Array<{ attachmentId?: string; contextId?: string; targetType?: string; targetId?: string; status?: string }>;
        facetAssignments?: Array<{ assignmentId?: string; targetType?: string; targetId?: string; status?: string; values?: unknown }>;
      }
    | undefined;
  return [
    ...(semantics?.contextAttachments ?? []).map((attachment) => ({
      id: attachment.attachmentId ?? `${attachment.targetType}:${attachment.targetId}`,
      title: "Context attachment",
      detail: `${attachment.contextId ?? "context"} -> ${attachment.targetType ?? "target"}:${attachment.targetId ?? "unknown"}`,
      status: attachment.status
    })),
    ...(semantics?.facetAssignments ?? []).map((assignment) => ({
      id: assignment.assignmentId ?? `${assignment.targetType}:${assignment.targetId}`,
      title: "Facet assignment",
      detail: `${assignment.targetType ?? "target"}:${assignment.targetId ?? "unknown"} ${JSON.stringify(assignment.values ?? {})}`,
      status: assignment.status
    }))
  ];
}

function filterSnapshot(snapshot: WorkbenchSnapshot, query: string, statusFilter: string): WorkbenchSnapshot {
  const normalizedQuery = query.trim().toLowerCase();
  const matchesText = (value: unknown) => !normalizedQuery || JSON.stringify(value).toLowerCase().includes(normalizedQuery);
  const matchesStatus = (value: { status?: string; versionStatus?: string }) =>
    statusFilter === "all" || value.status === statusFilter || value.versionStatus === statusFilter;
  return {
    ...snapshot,
    graphs: snapshot.graphs.filter((graph) => matchesText(graph) && matchesStatus(graph)),
    generation: {
      plans: snapshot.generation.plans.filter((plan) => matchesText(plan) && matchesStatus(plan)),
      tasks: snapshot.generation.tasks.filter((task) => matchesText(task) && matchesStatus(task)),
      jobs: snapshot.generation.jobs.filter((job) => matchesText(job) && matchesStatus(job))
    },
    libraries: snapshot.libraries
      .filter((library) => matchesText(library) && matchesStatus(library))
      .map((library) => ({
        ...library,
        results: library.results.filter((result) => matchesText(result) && matchesStatus(result)),
        gallery: library.gallery.filter((preview) => matchesText(preview) && matchesStatus(preview))
      })),
    resultPreviews: snapshot.resultPreviews.filter((preview) => matchesText(preview) && matchesStatus(preview))
  };
}

if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<ReadonlyWorkbench />);
}
