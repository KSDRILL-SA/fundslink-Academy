"""Matching module — AI funding matching (Stage 03, module 4).

First lights up the polyglot stores behind repository interfaces: MongoDB (reasoning, S5.33) +
ChromaDB (embeddings, S5.45) + Redis (spend/quota). Funding amounts NEVER leave PostgreSQL
(S5.3) — enforced by the store-isolation guard (app.db.store_isolation), not merely documented.
"""
