# Warsaw / How agents build — public audit report

Session audit: 5 October 2026. Graph source follow-up: 6 October 2026. A targeted case study of the development workflow, not a current-game certification.

## Graph engineering finding

The inspected project used explicit graphs for navigation, build references and scene hierarchy. Review branching and joining and fingerprint-based asset checks are additional graph-like engineering patterns. These are several representations serving specific jobs; the selected records do not establish one unified project-wide knowledge graph.

## Main finding
The useful pattern is a human goal, bounded agent actions, observable results, independent challenges and corrections. The selected records contain defects, ownership mistakes and invalid measurements alongside successful checks. This supports a story about controlled engineering iteration, rather than uninterrupted autonomous success.

## Graph principles: meaning, application and when to use them
### 1. Give every connection a meaning

**Meaning:** A graph represents things as nodes and relationships as edges. Here, graph engineering means choosing those things, defining exactly what connects them, and using that structure to make decisions or check results.

**Application:** Kiran’s Warsaw project used several relationship models: walkable places linked for routefinding, projects linked by build references, parent objects containing child objects, and review results flowing into a decision. These were different graphs serving different jobs.

**When to apply:** Use this when relationships affect the answer: what can reach what, what depends on what, or which results must arrive before a decision. Name the node type and edge meaning first.

**Representation:** FOUNDATION

**Limit:** “Graph engineering” is used here as a descriptive engineering approach. The inspected material does not establish one unified knowledge graph covering the entire development process.

**Source note:** graph-model in the companion evidence.json.

### 2. Put prerequisites before consumers

**Meaning:** A dependency graph says which part needs another part. An arrow from a prerequisite to its consumer means “this must be available first.” An acyclic graph has no chain that circles back to itself.

**Application:** The inspected TypeScript configuration gives the client a reference to shared code. The server references both shared and client projects. The root typecheck uses TypeScript build mode, which understands these project references.

**When to apply:** Use this for multi-part builds, data pipelines or tasks with prerequisites. Check for circular dependencies, and identify the consumers affected by a change.

**Representation:** EXPLICIT CONFIGURATION

**Limit:** These references document a build structure. They do not establish a measured speedup, a custom graph scheduler, or that the live server imports the entire client.

**Source note:** graph-build in the companion evidence.json.

### 3. Branch out, then join the results

**Meaning:** Fan-out sends one task into several independent checks. Fan-in brings their results together before a shared decision. A join is a point that waits for the required branches.

**Application:** The fresh-review workflow runs separate review lenses in parallel, waits for them, combines overlapping findings, then sends candidates to skeptic checks. It keeps evidence of failed reviewers instead of treating silence as “no bugs.”

**When to apply:** Use this when checks can run independently but their outputs must feed one decision. Define required branches, failure handling, and how duplicates are recognized.

**Representation:** CONTROL-FLOW PATTERN

**Limit:** This is implemented branching and joining in workflow code. It is not evidence of a generic graph-orchestration framework. Duplicate detection is a heuristic, and reviewers can still miss or invent problems.

**Source note:** fresh in the companion evidence.json.

### 4. Make the final node enforce a rule

**Meaning:** A gate is a decision point with explicit conditions. It asks whether the evidence arriving from earlier steps is sufficient to allow the work to proceed.

**Application:** A sampled review found that the Warsaw review system itself needed stricter handling of incomplete output. The corrected gate blocks confirmed serious findings and reports an error for incomplete required checks. A complete review can still contain uncertainty.

**When to apply:** Use this before merging, releasing, importing assets or making other decisions that depend on multiple checks. State what passes, what blocks, and what counts as incomplete.

**Representation:** CODE + RECORDED CORRECTION

**Limit:** The interaction below models two conditions. The actual gate also examines verifier results and serious unverified findings. PASS is a workflow outcome, not proof that the code is bug-free.

**Source note:** gate in the companion evidence.json.

### 5. Find routes through valid connections

**Meaning:** A path is a sequence of connected nodes. Routefinding searches for a useful path, considering which connections are allowed and what they cost. Connectivity asks whether a route exists at all.

**Application:** Warsaw’s navigation code stores nodes with neighbor links and checks potential connections against the physics world. Bots use A* (“A-star”): search prioritizes cost so far plus an estimate of cost ahead. It can expand at most 4,000 nodes—inspect their outgoing connections—per search. Results distinguish complete and partial routes to selected graph nodes.

**When to apply:** Use this for movement, network routing or reachability questions. Validate edges against the real rules, handle disconnected destinations, and state the search budget.

**Representation:** EXPLICIT GRAPH IN CODE

**Limit:** A complete result reaches the selected graph destination; it does not prove access to every possible world position. A budget or disconnected graph can produce a partial route. These source reads do not certify current gameplay.

**Source note:** graph-nav in the companion evidence.json.

### 6. Let related objects move together

**Meaning:** A tree is a connected graph without cycles. In a rooted scene hierarchy, each child has one parent, and its position and rotation are interpreted relative to that parent.

**Application:** The inspected Three.js partner view creates group, figure, body and shoulder objects. The upper arm, hand and blade are attached to the shoulder; the shoulder is attached to the body, which belongs to the figure and outer group.

**When to apply:** Use this for articulated characters, vehicles or cameras whose parts should inherit movement. Choose parents that match the intended movement.

**Representation:** EXPLICIT SCENE HIERARCHY

**Limit:** A scene hierarchy organizes transforms. It does not by itself define collision, network ownership or intelligent decisions, and it is a different graph from navigation.

**Source note:** graph-scene in the companion evidence.json.

### 7. Trace an output back to its inputs

**Meaning:** Provenance records where an output came from. Invalidation means marking that output as needing replacement when the inputs it depends on have changed.

**Application:** The market lighting installer checks the source-file fingerprints, scene metadata and texture bytes. A changed source is rejected with instructions to re-export and rebake. Runtime code separately checks that the lighting asset matches the layout and scene.

**When to apply:** Use this for generated lighting, cached calculations, compiled assets or data reports. Record the relevant inputs, detect changes, and define how stale outputs are rebuilt.

**Representation:** DEPENDENCY CHECKS

**Limit:** These are graph-like dependency contracts implemented with fingerprints and checks. They do not establish a knowledge-graph database, prove a cloud bake succeeded, or prove that the lighting looks good.

**Source note:** graph-assets in the companion evidence.json.

### 8. Use a cycle to learn from results

**Meaning:** A cycle returns to an earlier step. A feedback cycle uses the result of an action to decide what to change next. It needs a checkable goal and a way to stop.

**Application:** The Palace column episode went from a visual problem to geometry inspection, a bounded correction and further checks: the grooves had been hidden behind flat panels. The handoff protocol also documents another repair round when checks fail or serious findings remain.

**When to apply:** Use this when quality must be discovered through testing or observation. Define the expected result, retain the evidence, bound retries, and escalate when progress stalls.

**Representation:** RECORDED ITERATION

**Limit:** The column correction is supported by sampled records. The broader repair-loop policy is documented separately. Iteration is not proof of model retraining or a guarantee of convergence.

**Source note:** graph-feedback in the companion evidence.json.

## Four examples that test the story

- **Hidden column grooves:** Detail was present in code but hidden behind flat panels. Geometry inspection and correction mattered. Later refinement images are separately dated; a version fingerprint is not proof of visual quality.
- **The review gate itself needed correction:** A project report identified missing review output being treated as a pass. Current code and scenario tests corroborate stricter handling. Confirmed serious findings block; incomplete required checks error; a complete review can still contain uncertainty.
- **A performance sample was rejected:** Fourteen roughly one-second browser intervals did not establish smooth gameplay. Browser intervals and graphics-processor work time answer different questions.
- **Bounded delegation still required repair:** Shared-file ownership was crossed and integration was corrected. Separate jobs do not eliminate coordination cost.

## What is next
Kiran plans to try agentic bots next. The inspected game bots currently use programmed behaviour trees and scripted chatter. Model-directed decisions, the proposed input boundary and evaluation questions are future exploration, not shipped features or measured results.

## Coverage and unknowns
Selected Claude Code and Codex records were sampled and compared with project code, protocols, review reports and historical outputs. Full private logs are excluded from the served website. Main Claude history is stored under the broader workspace archive. The active code may differ from recorded test snapshots. Complete cost, comparative speedup and a complete first-pass acceptance denominator remain unknown.

See methodology.md for evidence definitions and evidence.json for paths, lines, dates and short supporting excerpts. Fuller local research and the independent content review are retained outside the served directory.
