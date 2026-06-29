import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createEmptyWorkbenchSnapshot,
  loadWorkbenchForApp,
  WorkbenchAppLoadState,
  WorkbenchGraphDetail,
  WorkbenchLibrarySummary,
  WorkbenchResultPreview,
  WorkbenchSnapshot
} from "./workbench-data";
import "./style.css";

type ModuleId = "overview" | "graphs" | "generation" | "libraries";

const moduleLabels: Array<{ id: ModuleId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "graphs", label: "Graphs" },
  { id: "generation", label: "Generation" },
  { id: "libraries", label: "Libraries" }
];

const emptyState: WorkbenchAppLoadState = {
  status: "loading",
  snapshot: createEmptyWorkbenchSnapshot(),
  phenotypes: [],
  generationPlans: [],
  generationTasks: []
};

export function ReadonlyWorkbench(props: { initialState?: WorkbenchAppLoadState }) {
  const [loadState, setLoadState] = useState<WorkbenchAppLoadState>(props.initialState ?? emptyState);
  const [activeModule, setActiveModule] = useState<ModuleId>("overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDetail, setSelectedDetail] = useState<TraceDetail>(() => traceFromSnapshot(props.initialState?.snapshot ?? emptyState.snapshot));
  const snapshot = loadState.snapshot;
  const counts = snapshot.overview.counts;
  const isEmpty = loadState.status === "ready" && (counts.graphs ?? 0) === 0 && (counts.phenotypes ?? 0) === 0 && (counts.libraries ?? 0) === 0;
  const filteredSnapshot = useMemo(() => filterSnapshot(snapshot, query, statusFilter), [query, snapshot, statusFilter]);

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
      setSelectedDetail(traceFromSnapshot(result.snapshot));
    });
    return () => {
      cancelled = true;
    };
  }, [props.initialState]);

  function selectDetail(detail: TraceDetail) {
    setSelectedDetail(detail);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="product-name">DNA: Design Network Atlas</p>
          <h1>DNA Read-only Workbench</h1>
          <p className="read-only-note">Local read-only view. Durable DNA writes stay in CLI/service boundary workflows.</p>
        </div>
        <dl className="metrics" aria-label="Workbench metrics">
          <Metric label="Graphs" value={counts.graphs ?? 0} />
          <Metric label="Phenotypes" value={counts.phenotypes ?? 0} />
          <Metric label="Versions" value={counts.phenotypeVersions ?? 0} />
          <Metric label="Plans/Tasks" value={`${counts.generationPlans ?? 0}/${counts.generationTasks ?? 0}`} />
          <Metric label="Jobs" value={counts.generationJobs ?? 0} />
          <Metric label="Libraries" value={`${counts.libraries ?? 0}/${counts.mounts ?? 0}`} />
        </dl>
      </header>

      <nav className="module-nav mobile-tabbar" aria-label="Workbench modules">
        {moduleLabels.map((module) => (
          <button
            key={module.id}
            className={activeModule === module.id ? "is-active" : ""}
            onClick={() => setActiveModule(module.id)}
            type="button"
          >
            {module.label}
          </button>
        ))}
      </nav>

      {loadState.status === "loading" ? (
        <section className="system-state" aria-live="polite">
          Loading workbench snapshot from the local DNA API...
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
          <span>Use the CLI/service boundary to add local graph or generation records, then refresh this read-only workbench.</span>
        </section>
      ) : null}

      <section className="filter-sheet" aria-label="Read-only filters">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="id, name, graph, task, result" />
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

      <section className="workbench-grid" aria-label="DNA read-only workbench">
        <section className="module-surface" aria-label="Workbench module content">
          <section className="module-view" aria-hidden={activeModule !== "overview"}>
            <OverviewView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "graphs"}>
            <GraphsView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "generation"}>
            <GenerationView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
          <section className="module-view" aria-hidden={activeModule !== "libraries"}>
            <LibrariesView snapshot={filteredSnapshot} onSelect={selectDetail} />
          </section>
        </section>
        <TracePanel detail={selectedDetail} />
      </section>
    </main>
  );
}

function OverviewView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: TraceDetail) => void }) {
  const counts = props.snapshot.overview.counts;
  return (
    <div className="module-content">
      <SectionHeader title="Overview" subtitle="Counts, review signals, and read-only entry points." />
      <div className="overview-grid">
        <MetricCard label="Active graphs" value={counts.activeGraphs ?? 0} detail={`${counts.graphs ?? 0} total graphs`} />
        <MetricCard label="Species nodes" value={counts.speciesNodes ?? 0} detail={`${counts.speciesGroups ?? 0} groups`} />
        <MetricCard label="Candidate versions" value={counts.candidateVersions ?? 0} detail={`${counts.acceptedVersions ?? 0} accepted`} />
        <MetricCard label="Plans and tasks" value={`${counts.generationPlans ?? 0}/${counts.generationTasks ?? 0}`} detail={`${counts.generationJobs ?? 0} jobs`} />
        <MetricCard label="Libraries and mounts" value={`${counts.libraries ?? 0}/${counts.mounts ?? 0}`} detail={`${counts.outputReferences ?? 0} output references`} />
        <MetricCard label="Needs attention" value={(counts.failedGenerationJobs ?? 0) + (counts.missingOrStaleOutputReferences ?? 0)} detail="failed jobs + stale references" />
      </div>
      <section className="panel">
        <div className="panel-title">
          <h3>Anomaly entry points</h3>
          <span>{props.snapshot.overview.anomalies.length}</span>
        </div>
        {props.snapshot.overview.anomalies.length ? (
          <div className="card-list">
            {props.snapshot.overview.anomalies.map((anomaly) => (
              <button
                key={anomaly.type}
                className="object-card"
                onClick={() => props.onSelect({ type: "Overview anomaly", id: anomaly.type, status: anomaly.severity, raw: anomaly })}
                type="button"
              >
                <strong>{anomaly.type}</strong>
                <span>{anomaly.message}</span>
                <StatusChip status={anomaly.severity} />
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">No snapshot anomaly is reported for this scope.</p>
        )}
      </section>
    </div>
  );
}

function GraphsView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: TraceDetail) => void }) {
  return (
    <div className="module-content">
      <SectionHeader title="Graphs" subtitle="Graph list, species groups, species nodes, design relationships, phenotype overlay, and compile trace." />
      {props.snapshot.graphs.length ? (
        props.snapshot.graphs.map((graph) => <GraphDetailCard key={graph.graphId} graph={graph} onSelect={props.onSelect} />)
      ) : (
        <EmptyPanel title="No graph records in this scope" />
      )}
    </div>
  );
}

function GraphDetailCard(props: { graph: WorkbenchGraphDetail; onSelect: (detail: TraceDetail) => void }) {
  const graph = props.graph;
  return (
    <article className="panel graph-card">
      <div className="detail-head">
        <div>
          <p className="section-label">{graph.graphId}</p>
          <h2>{graph.name}</h2>
          <p className="muted">{graph.purpose}</p>
        </div>
        <StatusChip status={graph.status} />
      </div>
      <div className="mini-metrics">
        <span>{graph.counts.groups ?? 0} groups</span>
        <span>{graph.counts.nodes ?? 0} nodes</span>
        <span>{graph.counts.relationships ?? 0} relationships</span>
        <span>{graph.counts.phenotypes ?? 0} phenotypes</span>
      </div>
      <div className="split-columns">
        <ObjectList
          title="Species groups"
          items={graph.groups.map((group) => ({
            id: group.groupId,
            title: group.name,
            detail: `${group.memberNodeIds.length} members`,
            status: group.status,
            raw: group
          }))}
          onSelect={props.onSelect}
          type="Species group"
        />
        <ObjectList
          title="Species nodes"
          items={graph.nodes.map((node) => ({
            id: node.nodeId,
            title: node.name,
            detail: `${node.groupIds.length} groups · ${node.phenotypeIds.length} phenotypes`,
            status: node.status,
            raw: node
          }))}
          onSelect={props.onSelect}
          type="Species node"
        />
        <ObjectList
          title="Design relationships"
          items={graph.relationships.map((relationship) => ({
            id: relationship.relationshipId,
            title: relationship.relationshipType,
            detail: relationship.summary,
            status: relationship.status,
            raw: relationship
          }))}
          onSelect={props.onSelect}
          type="Design relationship"
        />
        <ObjectList
          title="Phenotype overlay"
          items={graph.phenotypeOverlay.map((phenotype) => ({
            id: phenotype.phenotypeId,
            title: phenotype.name,
            detail: `${phenotype.phenotypeType} · ${phenotype.versions.length} versions`,
            status: phenotype.status,
            raw: phenotype
          }))}
          onSelect={props.onSelect}
          type="Phenotype"
        />
      </div>
      <section className="trace-strip">
        <h3>Compile</h3>
        <span>{graph.compileTrace?.entityArtifacts ?? 0} entity</span>
        <span>{graph.compileTrace?.speciesArtifacts ?? 0} species</span>
        <span>{graph.compileTrace?.phenotypeArtifacts ?? 0} phenotype</span>
      </section>
    </article>
  );
}

function GenerationView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: TraceDetail) => void }) {
  return (
    <div className="module-content">
      <SectionHeader title="Generation" subtitle="Plans, tasks, executions, and links to phenotype versions." />
      <div className="split-columns generation-columns">
        <ObjectList
          title="Plans"
          items={props.snapshot.generation.plans.map((plan) => ({
            id: plan.planId,
            title: plan.description,
            detail: `${plan.scopeType}:${plan.scopeId} · ${plan.taskCount} tasks`,
            status: plan.status,
            raw: plan
          }))}
          onSelect={props.onSelect}
          type="Generation plan"
        />
        <ObjectList
          title="Tasks"
          items={props.snapshot.generation.tasks.map((task) => ({
            id: task.taskId,
            title: task.taskBrief,
            detail: `${task.phenotypeType} · ${task.links.phenotypeVersionIds.length} versions`,
            status: task.status,
            raw: task
          }))}
          onSelect={props.onSelect}
          type="Generation task"
        />
        <ObjectList
          title="Executions"
          items={props.snapshot.generation.jobs.map((job) => ({
            id: job.generationJobId,
            title: job.tool ?? "manual",
            detail: `${job.phenotypeType} · ${job.phenotypeVersionId ?? "no version"}`,
            status: job.status,
            raw: job
          }))}
          onSelect={props.onSelect}
          type="Generation job"
        />
        <ObjectList
          title="Results"
          items={props.snapshot.libraries.flatMap((library) =>
            library.results.map((result) => ({
              id: result.versionId,
              title: result.phenotypeName,
              detail: `${result.phenotypeType} · ${result.referenceCount} references`,
              status: result.versionStatus,
              raw: result
            }))
          )}
          onSelect={props.onSelect}
          type="Phenotype version"
        />
      </div>
    </div>
  );
}

function LibrariesView(props: { snapshot: WorkbenchSnapshot; onSelect: (detail: TraceDetail) => void }) {
  return (
    <div className="module-content">
      <SectionHeader title="Libraries" subtitle="Phenotype results, gallery previews, mounts, routing, output references, and asset pointers." />
      {props.snapshot.libraries.length ? (
        props.snapshot.libraries.map((library) => <LibraryCard key={library.libraryId} library={library} onSelect={props.onSelect} />)
      ) : (
        <EmptyPanel title="No phenotype libraries in this scope" />
      )}
    </div>
  );
}

function LibraryCard(props: { library: WorkbenchLibrarySummary; onSelect: (detail: TraceDetail) => void }) {
  const library = props.library;
  return (
    <article className="panel library-card">
      <div className="detail-head">
        <div>
          <p className="section-label">{library.libraryId}</p>
          <h2>{library.name}</h2>
          <p className="muted">{library.purpose}</p>
        </div>
        <StatusChip status={library.status} />
      </div>
      <div className="library-tabs" aria-label="Library detail tabs">
        <span>Results</span>
        <span>Gallery</span>
        <span>Mounts</span>
        <span>Routing</span>
        <span>Output References</span>
        <span>Assets</span>
        <span>Sync</span>
      </div>
      <section className="result-grid">
        {library.results.map((result) => (
          <button
            key={result.versionId}
            className="result-card"
            onClick={() => props.onSelect({ type: "Library result", id: result.versionId, status: result.versionStatus, raw: result })}
            type="button"
          >
            <PreviewFrame preview={result.preview} />
            <strong>{result.phenotypeName}</strong>
            <span>{result.phenotypeType} · {result.outputRoles.join(", ") || "no role"}</span>
            <StatusChip status={result.versionStatus} />
          </button>
        ))}
      </section>
      <section>
        <div className="panel-title">
          <h3>Gallery</h3>
          <span>{library.gallery.length} previews</span>
        </div>
        <div className="gallery-grid">
          {library.gallery.map((preview) => (
            <GalleryCard key={`${preview.objectType}-${preview.objectId}`} preview={preview} onSelect={props.onSelect} />
          ))}
        </div>
      </section>
      <section className="mount-list">
        <h3>Mounts</h3>
        {library.mounts.map((mount) => (
          <button
            key={mount.mountId}
            className="object-card"
            onClick={() => props.onSelect({ type: "Storage mount", id: mount.mountId, status: mount.status, raw: mount })}
            type="button"
          >
            <strong>{mount.displayName}</strong>
            <span>{mount.storageType} · {mount.adapterKind} · credentials {mount.credentialStatus}</span>
            <code>{mount.displayLocation ?? "[redacted]"}</code>
          </button>
        ))}
      </section>
    </article>
  );
}

function GalleryCard(props: { preview: WorkbenchResultPreview; onSelect: (detail: TraceDetail) => void }) {
  return (
    <button
      className="gallery-card"
      onClick={() =>
        props.onSelect({ type: props.preview.objectType === "asset" ? "Asset preview" : "Output reference preview", id: props.preview.objectId, status: props.preview.status, raw: props.preview })
      }
      type="button"
    >
      <PreviewFrame preview={props.preview.preview} />
      <strong>{props.preview.phenotypeName ?? props.preview.label}</strong>
      <span>{props.preview.label}</span>
      <StatusChip status={props.preview.status} />
    </button>
  );
}

function PreviewFrame(props: { preview: { kind: "image" | "placeholder"; url?: string; reason?: string } }) {
  const [failed, setFailed] = useState(false);
  if (props.preview.kind === "image" && props.preview.url && !failed) {
    return <img alt="" className="preview-image" loading="lazy" onError={() => setFailed(true)} src={props.preview.url} />;
  }
  return (
    <div className="preview-placeholder" aria-label="Preview unavailable">
      <span>{failed ? "preview unavailable" : props.preview.reason ?? "preview unavailable"}</span>
    </div>
  );
}

function TracePanel(props: { detail: TraceDetail }) {
  const detail = props.detail;
  return (
    <aside className="trace-panel detail-drawer" aria-label="Trace Panel">
      <div className="panel-title">
        <h2>Trace Panel</h2>
        <StatusChip status={detail.status ?? "read-only"} />
      </div>
      <TraceSection title="Identity" values={[detail.type, detail.id]} />
      <TraceSection title="Relationships" values={detail.relationships ?? ["Linked objects are shown in module cards."]} />
      <TraceSection title="Provenance" values={detail.provenance ?? ["Compile artifacts, jobs, plans, and tasks appear when present."]} />
      <TraceSection title="Governance" values={detail.governance ?? ["Feedback, reviews, impact hints, stale and missing states are read-only."]} />
      <TraceSection title="External pointers" values={detail.externalPointers ?? ["Assets, output references, libraries, mounts, and sync placeholders are shown without credentials."]} />
      <details>
        <summary>Raw JSON summary</summary>
        <pre>{JSON.stringify(detail.raw ?? {}, null, 2)}</pre>
      </details>
    </aside>
  );
}

function TraceSection(props: { title: string; values: string[] }) {
  return (
    <section className="trace-section">
      <h3>{props.title}</h3>
      {props.values.map((value) => (
        <p key={value}>{value}</p>
      ))}
    </section>
  );
}

function ObjectList(props: {
  title: string;
  type: string;
  items: Array<{ id: string; title: string; detail: string; status?: string; raw: unknown }>;
  onSelect: (detail: TraceDetail) => void;
}) {
  return (
    <section className="panel object-list">
      <div className="panel-title">
        <h3>{props.title}</h3>
        <span>{props.items.length}</span>
      </div>
      {props.items.length ? (
        props.items.map((item) => (
          <button
            key={item.id}
            className="object-card"
            onClick={() => props.onSelect({ type: props.type, id: item.id, status: item.status, raw: item.raw })}
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

function Metric(props: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function MetricCard(props: { label: string; value: number | string; detail: string }) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  );
}

function StatusChip(props: { status: string }) {
  return <span className={`status-chip status-${props.status}`}>{props.status}</span>;
}

interface TraceDetail {
  type: string;
  id: string;
  status?: string;
  relationships?: string[];
  provenance?: string[];
  governance?: string[];
  externalPointers?: string[];
  raw?: unknown;
}

function traceFromSnapshot(snapshot: WorkbenchSnapshot): TraceDetail {
  const graph = snapshot.graphs[0];
  if (graph) {
    return {
      type: "Graph",
      id: graph.graphId,
      status: graph.status,
      relationships: [`${graph.relationships.length} design relationships`, `${graph.groups.length} species groups`],
      provenance: [`${graph.compileTrace?.speciesArtifacts ?? 0} species compile artifacts`, `${graph.compileTrace?.phenotypeArtifacts ?? 0} phenotype compile artifacts`],
      governance: [`${graph.counts.candidateVersions ?? 0} candidate versions`, `${graph.counts.acceptedVersions ?? 0} accepted versions`],
      externalPointers: [`${snapshot.libraries.length} libraries in scope`],
      raw: graph.rawJsonSummary ?? graph
    };
  }
  return {
    type: "Workbench",
    id: "current-snapshot",
    status: "read-only",
    raw: snapshot.overview
  };
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
      }))
  };
}

if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<ReadonlyWorkbench />);
}
