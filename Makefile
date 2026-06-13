# FundsLink Academy — dev tasks.  Usage: make <target>
COMPOSE = docker compose -f infra/docker-compose.dev.yml

.PHONY: help dev up down test test-api test-web verify integrity partitions restore-drill explain

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

dev: up ## Start the full dev stack in the foreground (postgres, mongo, chroma, redis, api)
	$(COMPOSE) up

up: ## Start the dev stack detached
	$(COMPOSE) up -d

down: ## Stop the dev stack
	$(COMPOSE) down

test: test-api test-web ## Run all unit tests

test-api: ## API unit tests (pytest)
	cd apps/api && pytest -q

test-web: ## Web unit tests (Vitest)
	cd apps/web && npm test

verify: ## Local mirror of the CI lint gates (ruff, layering, contract, web build)
	cd apps/api && ruff check . && lint-imports
	openapi-spec-validator packages/contracts/openapi.yaml
	cd apps/web && npm run build

integrity: ## DB integrity job suite (DB-D39) — needs DATABASE_URL
	cd apps/api && python -m app.db.integrity

partitions: ## Ensure month N+12 partitions exist (DB-D44) — needs DATABASE_URL
	cd apps/api && python -m app.db.partitions

restore-drill: ## Backup -> drop -> restore -> constraint suite (DB-D36)
	bash scripts/restore_drill.sh

explain: ## EXPLAIN baseline for the 5 hottest queries (DB-D28/D40)
	bash scripts/explain_baseline.sh
