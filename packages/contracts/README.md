# packages/contracts

`FUNDSLINK-API-v1.yaml` is the **single source of truth** for the API (`S2.7`). Both sides build
from it: FastAPI implements it (CI diffs the generated OpenAPI against this file), and the Angular
`data-access` lib consumes generated TypeScript types.

```bash
npm install          # in this folder
npm run generate     # -> apps/web/projects/data-access/src/lib/generated/api-types.ts
```

Never hand-edit the generated types, and never add an endpoint to code that is not in this file.
