# FundsLink Academy — Engineering Architecture & Practices v1.0

How the system is layered, where shared code lives, the rules that are **enforced** (not just
hoped for), and how every layer is **designed for extension** so v1.5/v2 slot in without rework.
Diagram-first; companion to the [TAD](technical-architecture.md), derived from ADR-002/003, the
constitutions (C1–C6), and the CLAUDE.md hard rules.

---

## 1. The layered request flow

One direction, one job per layer. Business logic lives in the service layer; only repositories
touch a database; the UI never holds business logic.

```mermaid
sequenceDiagram
  participant U as User
  participant C as Angular component<br/>(presentational)
  participant DS as Angular data service<br/>(libs/data-access)
  participant I as HTTP interceptor<br/>(libs/auth)
  participant R as FastAPI router<br/>(authz + validation)
  participant S as Service<br/>(business logic)
  participant Repo as Repository<br/>(only layer with DB)
  participant DB as PostgreSQL · MongoDB · ChromaDB
  U->>C: interaction
  C->>DS: call (no business logic in UI — S4.12)
  DS->>I: HTTP request
  I->>R: request + access token
  R->>S: validated DTO (authz at entry — S3.23)
  S->>Repo: domain operation (logic lives here — S2.1)
  Repo->>DB: parameterised query (only repo imports drivers)
  DB-->>Repo: rows
  Repo-->>S: typed models
  S-->>R: result
  R-->>DS: { success, data, error } (S2.19)
  DS-->>C: validated model (S4.26)
```

### Dependency direction (what may import what)

```mermaid
graph LR
  UI["UI component"] --> FES["Angular data service"]
  FES -->|HTTP| ROUTER[router]
  ROUTER --> SVC[service]
  SVC --> REPO[repository]
  REPO --> DRV["DB drivers<br/>SQLAlchemy · asyncpg · Beanie · Chroma client"]
  classDef ok fill:#0e7490,color:#fff,stroke:#155e75;
  classDef bad fill:#b91c1c,color:#fff,stroke:#7f1d1d;
  class UI,FES,ROUTER,SVC,REPO,DRV ok;
```

> **The line import-linter enforces (CI):** `app.modules.*.router` and `app.modules.*.service`
> may **not** import `sqlalchemy` / `asyncpg` — only `repository` may. Proven biting in CI (Stage 00).

---

## 2. Where shared code lives (the common home)

Nothing shared is copy-pasted; it has one home. Cross-cutting concerns live in `core`/`common`
(backend) and the `libs/*` (frontend); the OpenAPI contract is the single source both sides build from.

```mermaid
graph TB
  subgraph PKG["packages/contracts"]
    yaml["openapi.yaml — source of truth (S2.7)"]
  end
  subgraph API["apps/api · FastAPI"]
    core["app/core — config · security · DB session · logging · middleware"]
    common["app/common — response envelope · pagination · errors · cuid"]
    mods["app/modules/* — router → service → repository per feature"]
  end
  subgraph WEB["apps/web · Angular"]
    util["libs/util — pure helpers (no framework deps)"]
    data["libs/data-access — generated client · data services · validators"]
    uilib["libs/ui — presentational components (spartan/ui)"]
    authlib["libs/auth — guards · token store · HTTP interceptor"]
    appsrc["src/app — lazy, role-guarded feature areas"]
  end
  yaml --> data
  yaml --> mods
  mods --> core
  mods --> common
  appsrc --> data
  appsrc --> uilib
  appsrc --> authlib
  data --> util
```

| Need a home for… | Backend | Frontend |
|------------------|---------|----------|
| Config / settings | `app/core/config.py` (env-driven, S3.20) | `environment` + `libs/util` |
| Cross-cutting (auth, logging, sessions) | `app/core` | `libs/auth` |
| Reusable, domain-agnostic helpers | `app/common` | `libs/util` (pure) |
| API access | repository (`app/modules/*/repository.py`) | `libs/data-access` services only (S4.55) |
| Presentational UI | — | `libs/ui` (spartan/ui) |
| Feature logic | `app/modules/<feature>/service.py` | feature-area container components |

---

## 3. The hard rules (documented + enforced)

| Rule | Standard | Enforced by |
|------|----------|-------------|
| **Only repositories call the database** (no DB from router/service/UI) | S2.1, S5.7 | import-linter (CI), review |
| **No business logic in UI components** | S4.12 | review, container/presentational split (S4.4) |
| **No hardcoded business values** (allowance, SLAs, budgets) — use the `config` table with history | DB-D24 | review, config-as-data |
| **No invented endpoints** — every endpoint comes from the OpenAPI contract | S2.7 | contract-diff (CI) |
| **Every endpoint declares a permission** (deny-by-default) | S3.21 | permission-lint (CI) |
| **Secrets never in code/logs/history** — env / secret store only | S3.20, CF-04 | gitleaks (CI + pre-commit) |
| **Money: NUMERIC + parameterised raw SQL + append-only** | S5.21, S5.28 | review, DB triggers |
| **Status change = transition-validated + event + outbox, one transaction** | TAD §7 | service + DB transition tables |
| **SYSTEM principal can never approve/reject** | §5.8 / BR-E03 | DB trigger (`fn_human_final`) |
| **Counselling data never in main schema / matching** | §6.4 / BR-S09 | schema segregation |

---

## 4. Design for extension (S2.8–S2.10) — the seams

v1 is built so v1.5/v2 attach at defined seams, not by surgery. Each layer exposes an extension point.

```mermaid
graph TB
  subgraph DB["Database"]
    d1["Repository interface seam → swap/adds store impl"]
    d2["Lookups & transitions as data (DB-D9)"]
    d3["config as data + history (DB-D24)"]
    d4["Append-only events → new projections without migration"]
    d5["[FWD] financial/institution tables logically locked"]
  end
  subgraph AUTH["Auth"]
    a1["RBAC as data → add role/permission, no code change"]
    a2["Route guards + Depends() — add protected route declaratively"]
  end
  subgraph BE["Backend"]
    b1["Contract-first → add endpoint via OpenAPI, codegen flows"]
    b2["Feature flags → fin/institution ship dark (S9.10)"]
    b3["Outbox → add channels/consumers without touching producers"]
    b4["/api/v1 versioning seam"]
  end
  subgraph FE["Frontend"]
    f1["Lazy, role-guarded feature areas → add area in isolation"]
    f2["Generated client regenerates on contract change"]
    f3["libs separation (ui/auth/data/util) → reuse, not duplication"]
  end
  classDef s fill:#1e293b,color:#fff,stroke:#475569;
  class d1,d2,d3,d4,d5,a1,a2,b1,b2,b3,b4,f1,f2,f3 s;
```

| Layer | Extension-first mechanism | Pays off at |
|-------|---------------------------|-------------|
| **Database** | Repository interfaces hide PG/Mongo/Chroma; lookups, transitions & config are data; events are append-only | v2.5 store moves; new statuses/rules without DDL |
| **Auth** | Roles & permissions are rows; guards/`Depends()` are declarative | new roles (DONOR, INSTITUTION_OFFICER) added as data |
| **Backend** | Contract-first endpoints; service interfaces; feature flags; outbox; API versioning | fin (v1.5) + institution (v2) ship dark, then flip a flag |
| **Frontend** | Lazy role-guarded areas; regenerated client; libs separation | donor/institution portals added without touching student flow |

---

## 5. "Where does X go?" — the decision guide

```mermaid
flowchart TD
  Q{What are you adding?} --> EP[New API behaviour]
  Q --> BV[New business value/number]
  Q --> SH[Reusable helper]
  Q --> DBQ[New data access]
  Q --> UIX[New screen/widget]
  EP --> EP1["1) add to OpenAPI contract (S2.7)<br/>2) router → service → repository<br/>3) declare permission (S3.21) + tests (S7.11)"]
  BV --> BV1["config table + history (DB-D24) — never hardcode"]
  SH --> SH1["backend app/common · frontend libs/util (pure)"]
  DBQ --> DBQ1["a repository function only (S5.7); parameterised (S5.21)"]
  UIX --> UIX1["presentational in libs/ui; logic in a service; no logic in the component (S4.12)"]
```

---

*v1.0 — derived from TAD v1.2, ADR-002/003, C1–C6, CLAUDE.md hard rules. Layering, shared homes,
enforced rules, and extension seams for DB · auth · backend · frontend.*
