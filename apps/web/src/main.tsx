import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  allTags,
  filterPhenotypes,
  getSelectedVersion,
  samplePhenotypes,
  updateVersionStatus,
  WorkbenchPhenotype,
  WorkbenchVersion,
  WorkbenchVersionStatus
} from "./workbench-data";
import "./style.css";

const statusOptions: Array<WorkbenchVersionStatus | "all"> = [
  "all",
  "pending-confirmation",
  "accepted",
  "rejected",
  "superseded",
  "archived"
];

function AssetWorkbench() {
  const [phenotypes, setPhenotypes] = useState(samplePhenotypes);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<WorkbenchVersionStatus | "all">("all");
  const [tag, setTag] = useState<string | "all">("all");
  const [outdatedOnly, setOutdatedOnly] = useState(false);
  const [selectedPhenotypeId, setSelectedPhenotypeId] = useState(samplePhenotypes[0]?.id);
  const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>();
  const tags = useMemo(() => allTags(phenotypes), [phenotypes]);
  const filtered = useMemo(
    () => filterPhenotypes(phenotypes, { query, status, tag, outdatedOnly }),
    [outdatedOnly, phenotypes, query, status, tag]
  );
  const selectedPhenotype =
    filtered.find((phenotype) => phenotype.id === selectedPhenotypeId) ?? filtered[0] ?? phenotypes[0];
  const selectedVersion = selectedPhenotype ? getSelectedVersion(selectedPhenotype, selectedVersionId) : undefined;
  const pendingCount = phenotypes.filter((phenotype) => getSelectedVersion(phenotype)?.status === "pending-confirmation").length;
  const outdatedCount = phenotypes.filter((phenotype) => phenotype.outdated).length;

  function selectPhenotype(phenotype: WorkbenchPhenotype) {
    setSelectedPhenotypeId(phenotype.id);
    setSelectedVersionId(undefined);
  }

  function updateStatus(nextStatus: WorkbenchVersionStatus) {
    if (!selectedPhenotype || !selectedVersion) return;
    setPhenotypes((current) => updateVersionStatus(current, selectedPhenotype.id, selectedVersion.id, nextStatus));
    setSelectedVersionId(selectedVersion.id);
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
          <Metric label="Pending" value={pendingCount} />
          <Metric label="Outdated" value={outdatedCount} />
        </dl>
      </header>

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

      <section className="workspace" aria-label="Asset workbench">
        <aside className="phenotype-list" aria-label="Phenotypes">
          <div className="list-header">
            <strong>{filtered.length} results</strong>
            <span>{tag === "all" ? "all tags" : tag}</span>
          </div>
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
            onUpdateStatus={updateStatus}
          />
        ) : (
          <section className="detail empty-state">
            <h2>No phenotype selected</h2>
            <p>Adjust the filters or create a phenotype from the CLI.</p>
          </section>
        )}
      </section>
    </main>
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
  onUpdateStatus: (status: WorkbenchVersionStatus) => void;
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

      <div className="actions" aria-label="Status actions">
        <button onClick={() => props.onUpdateStatus("accepted")} type="button">
          Accept
        </button>
        <button onClick={() => props.onUpdateStatus("rejected")} type="button">
          Reject
        </button>
        <button onClick={() => props.onUpdateStatus("archived")} type="button">
          Archive
        </button>
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
