import React from "react";
import { createRoot } from "react-dom/client";

const samplePhenotypes = [
  { name: "Warning Toolbar Icon", status: "pending-confirmation", version: "pv-local-demo" },
  { name: "Faction Emblem Brief", status: "accepted", version: "pv-art-demo" }
];

function AssetWorkbench() {
  return (
    <main className="shell">
      <header>
        <p>DNA: Design Network Atlas</p>
        <h1>Asset Workbench</h1>
      </header>
      <section className="toolbar" aria-label="Asset filters">
        <input placeholder="Search phenotype, tag, node" />
        <select aria-label="Status">
          <option>All statuses</option>
          <option>pending-confirmation</option>
          <option>accepted</option>
          <option>rejected</option>
        </select>
      </section>
      <section className="list" aria-label="Phenotypes">
        {samplePhenotypes.map((phenotype) => (
          <article key={phenotype.version} className="row">
            <div>
              <strong>{phenotype.name}</strong>
              <span>{phenotype.version}</span>
            </div>
            <mark>{phenotype.status}</mark>
          </article>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<AssetWorkbench />);
