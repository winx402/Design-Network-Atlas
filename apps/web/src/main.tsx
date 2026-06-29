import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  allTags,
  filterPhenotypes,
  getSelectedVersion,
  loadWorkbenchPhenotypesForApp,
  WorkbenchGenerationPlan,
  WorkbenchGenerationTask,
  WorkbenchPhenotype,
  WorkbenchVersion,
  WorkbenchVersionStatus,
  WorkbenchAppLoadState
} from "./workbench-data";
import "./style.css";

const statusOptions: Array<WorkbenchVersionStatus | "all"> = [
  "all",
  "candidate",
  "accepted",
  "rejected",
  "replaced",
  "rolled-back",
  "deprecated",
  "archived",
  "deleted"
];

function AssetWorkbench() {
  const [loadState, setLoadState] = useState<WorkbenchAppLoadState>({
    status: "loading",
    phenotypes: [],
    generationPlans: [],
    generationTasks: []
  });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkbenchVersionStatus | "all">("all");
  const [tag, setTag] = useState<string | "all">("all");
  const [outdatedOnly, setOutdatedOnly] = useState(false);
  const [selectedPhenotypeId, setSelectedPhenotypeId] = useState<string | undefined>();
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const phenotypes = loadState.phenotypes;
  const tags = useMemo(() => allTags(phenotypes), [phenotypes]);
  const filtered = useMemo(
    () => filterPhenotypes(phenotypes, { query, status, tag, outdatedOnly }),
    [outdatedOnly, phenotypes, query, status, tag]
  );
  const selectedPhenotype =
    filtered.find((phenotype) => phenotype.id === selectedPhenotypeId) ?? filtered[0] ?? phenotypes[0];
  const selectedVersion = selectedPhenotype ? getSelectedVersion(selectedPhenotype, selectedVersionId) : undefined;
  const candidateCount = phenotypes.filter((phenotype) => getSelectedVersion(phenotype)?.status === "candidate").length;
  const outdatedCount = phenotypes.filter((phenotype) => phenotype.outdated).length;
  const openTaskCount = loadState.generationTasks.filter((task) => task.status !== "completed" && task.status !== "cancelled").length;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    void loadWorkbenchPhenotypesForApp({
      baseUrl: window.location.origin,
      graphId: params.get("graphId") ?? undefined,
      demo: params.has("demo")
    }).then((result) => {
      if (!cancelled) setLoadState(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectPhenotype(phenotype: WorkbenchPhenotype) {
    setSelectedPhenotypeId(phenotype.id);
    setSelectedVersionId(undefined);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="product-name">DNA: Design Network Atlas</p>
          <h1>Asset Workbench</h1>
        </div>
        <dl className="metrics" aria-label="Workbench metrics">
          <Metric label="Phenotypes" value={phenotypes.length} />
          <Metric label="Candidates" value={candidateCount} />
          <Metric label="Outdated" value={outdatedCount} />
          <Metric label="Tasks" value={openTaskCount} />
        </dl>
      </header>

      {loadState.status === "loading" ? (
        <section className="system-state" aria-live="polite">
          Loading phenotype workbench from the local DNA API...
        </section>
      ) : null}

      {loadState.status === "error" ? (
        <section className="system-state error" role="alert">
          <strong>Unable to load workbench data.</strong>
          <span>{loadState.error}</span>
        </section>
      ) : null}

      <section className="filters" aria-label="Asset workbench filters">
        <label>
          <span>Search</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="phenotype, node, tag, asset" />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as WorkbenchVersionStatus | "all")}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tag</span>
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="all">All tags</option>
            {tags.map((tagValue) => (
              <option key={tagValue} value={tagValue}>
                {tagValue}
              </option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input checked={outdatedOnly} onChange={(event) => setOutdatedOnly(event.target.checked)} type="checkbox" />
          <span>Outdated only</span>
        </label>
      </section>

      <PlanningStrip plans={loadState.generationPlans} tasks={loadState.generationTasks} />

      <section className="workspace" aria-label="Asset workbench">
        <aside className="phenotype-list" aria-label="Phenotypes">
          <div className="list-header">
            <strong>{filtered.length} results</strong>
            <span>{tag === "all" ? "all tags" : tag}</span>
          </div>
          {loadState.status === "ready" && phenotypes.length === 0 ? (
            <div className="list-empty">
              <strong>No phenotypes found</strong>
              <span>Create phenotypes through the CLI/service boundary, then refresh this read-only workbench.</span>
            </div>
          ) : null}
          {filtered.map((phenotype) => {
            const version = getSelectedVersion(phenotype);
            return (
              <button
                key={phenotype.id}
                className={`phenotype-row ${phenotype.id === selectedPhenotype?.id ? "is-selected" : ""}`}
                onClick={() => selectPhenotype(phenotype)}
                type="button"
              >
                <span>
                  <strong>{phenotype.name}</strong>
                  <small>{phenotype.nodeName}</small>
                </span>
                <StatusChip status={version?.status ?? "archived"} />
              </button>
            );
          })}
        </aside>

        {selectedPhenotype && selectedVersion ? (
          <PhenotypeDetail
            phenotype={selectedPhenotype}
            selectedVersion={selectedVersion}
            onSelectVersion={setSelectedVersionId}
          />
        ) : (
          <section className="detail empty-state">
            <h2>{loadState.status === "ready" && phenotypes.length === 0 ? "No phenotypes found" : "No phenotype selected"}</h2>
            <p>
              {loadState.status === "error"
                ? "The local API did not return workbench data. Existing DNA records were not changed."
                : "Adjust filters, choose a phenotype, or create one through the CLI/service boundary."}
            </p>
          </section>
        )}
      </section>
    </main>
  );
}

function PlanningStrip(props: { plans: WorkbenchGenerationPlan[]; tasks: WorkbenchGenerationTask[] }) {
  const visibleTasks = props.tasks.slice(0, 3);
  const visiblePlans = props.plans.slice(0, 2);
  return (
    <section className="planning-strip" aria-label="Generation planning">
      <div>
        <h3>Generation Plans</h3>
        {visiblePlans.length ? (
          visiblePlans.map((plan) => (
            <p key={plan.planId}>
              <strong>{plan.planId}</strong>
              <span>{plan.status} · {plan.scopeType}:{plan.scopeId} · {plan.taskCount} tasks</span>
            </p>
          ))
        ) : (
          <p>
            <strong>No plans</strong>
            <span>0 tasks</span>
          </p>
        )}
      </div>
      <div>
        <h3>Generation Tasks</h3>
        {visibleTasks.length ? (
          visibleTasks.map((task) => (
            <p key={task.taskId}>
              <strong>{task.taskId}</strong>
              <span>
                {task.status} · {task.phenotypeType}
                {task.blockingReason ? ` · ${task.blockingReason}` : ""}
              </span>
            </p>
          ))
        ) : (
          <p>
            <strong>No tasks</strong>
            <span>0 linked jobs</span>
          </p>
        )}
      </div>
    </section>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function PhenotypeDetail(props: {
  phenotype: WorkbenchPhenotype;
  selectedVersion: WorkbenchVersion;
  onSelectVersion: (versionId: string) => void;
}) {
  const { phenotype, selectedVersion } = props;
  const review = selectedVersion.reviews[0];
  return (
    <section className="detail" aria-label="Phenotype detail">
      <div className="detail-head">
        <div>
          <p className="section-label">{phenotype.phenotypeType}</p>
          <h2>{phenotype.name}</h2>
          <p className="muted">
            {phenotype.nodeName} · {selectedVersion.speciesVersion}
          </p>
        </div>
        <StatusChip status={selectedVersion.status} />
      </div>

      {phenotype.outdated ? (
        <div className="outdated-banner" role="status">
          Current species snapshot is {phenotype.currentSpeciesVersion}; latest is {phenotype.latestSpeciesVersion}.
        </div>
      ) : null}

      <div className="version-strip" aria-label="Phenotype versions">
        {phenotype.versions.map((version) => (
          <button
            key={version.id}
            className={version.id === selectedVersion.id ? "is-active" : ""}
            onClick={() => props.onSelectVersion(version.id)}
            type="button"
          >
            <strong>{version.id}</strong>
            <span>{version.status}</span>
          </button>
        ))}
      </div>

      <section className="panel">
        <div className="panel-title">
          <h3>Asset Group</h3>
          <span>{selectedVersion.assets.length} assets</span>
        </div>
        <div className="asset-table" role="table" aria-label="Assets for selected phenotype version">
          <div role="row" className="asset-row head">
            <span>Name</span>
            <span>Variant</span>
            <span>Status</span>
            <span>Location</span>
          </div>
          {selectedVersion.assets.map((asset) => (
            <div key={asset.id} role="row" className="asset-row">
              <strong>{asset.label}</strong>
              <span>{asset.variantRole}</span>
              <span>{asset.status}</span>
              <code>{asset.uri}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="panel two-column">
        <div>
          <div className="panel-title">
            <h3>Review</h3>
            <StatusChip status={review?.status ?? "needs-review"} />
          </div>
          <p className="review-summary">{review?.summary ?? "No review record yet."}</p>
          <KeyValueList title="Missing" values={review?.missingDimensions ?? []} />
          <KeyValueList title="Violations" values={review?.constraintViolations ?? []} />
        </div>
        <div>
          <div className="panel-title">
            <h3>Lifecycle Feedback</h3>
            <span>{selectedVersion.feedback?.items.length ?? 0} items</span>
          </div>
          <p className="review-summary">{selectedVersion.feedback?.summary ?? "No lifecycle feedback yet."}</p>
          <KeyValueList
            title="Feedback"
            values={(selectedVersion.feedback?.items ?? []).map((item) => `${item.severity}/${item.source}: ${item.message}`)}
          />
        </div>
        <div>
          <h3>Prompt Snapshot</h3>
          <pre>{selectedVersion.promptSnapshot}</pre>
        </div>
      </section>
    </section>
  );
}

function StatusChip(props: { status: WorkbenchVersionStatus | "pass" | "needs-review" | "fail" }) {
  return <span className={`status-chip status-${props.status}`}>{props.status}</span>;
}

function KeyValueList(props: { title: string; values: string[] }) {
  return (
    <div className="review-list">
      <strong>{props.title}</strong>
      {props.values.length ? (
        <ul>
          {props.values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <span>None</span>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<AssetWorkbench />);
