# FundsLink Academy — dev tasks.  Usage: make <target>
COMPOSE = docker compose -f infra/docker-compose.dev.yml

.PHONY: help dev up down test test-api test-web integrity

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  %-12s %s\n", $$1, $$2}'

dev: up ## Start the full dev stack in the foreground (postgres+pgvector, redis, api)
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

integrity: ## Local mirror of the CI gates (ruff, layering, contract, web build)
	cd apps/api && ruff check . && lint-imports
	openapi-spec-validator packages/contracts/FUNDSLINK-API-v1.yaml
	cd apps/web && npm run build
