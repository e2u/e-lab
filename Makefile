# E-LAB Project Makefile
# This Makefile helps with local development, building, and deploying to GitHub Pages

SHELL := /bin/bash
NODE_VERSION := $(shell node --version 2>/dev/null || echo "not installed")
NPM_VERSION := $(shell npm --version 2>/dev/null || echo "not installed")

.PHONY: help install dev build preview deploy clean

help:
	@echo "E-LAB Project - Available commands:"
	@echo ""
	@echo "  make install   Install dependencies"
	@echo "  make dev       Start development server (http://localhost:5173)"
	@echo "  make build     Build production version"
	@echo "  make preview   Preview production build locally"
	@echo "  make test      Run tests"
	@echo "  make deploy    Deploy to GitHub Pages"
	@echo "  make clean     Clean build artifacts"

install:
	@if [ ! -d "node_modules" ]; then \
		echo "Installing dependencies..."; \
		npm install; \
	else \
		echo "Dependencies already installed."; \
	fi

dev:
	@echo "Starting development server..."
	@npm run dev

build:
	@echo "Building production version..."
	@GITHUB_REPOSITORY=$(GITHUB_REPOSITORY) NODE_ENV=production npm run build
	@echo "Build completed! Output is in dist/ directory."

preview:
	@echo "Previewing production build..."
	@npm run preview

test:
	@echo "Running tests..."
	@npm test

deploy: build
	@echo "Deploying to GitHub Pages..."
	@if [ -z "$(GITHUB_REPOSITORY)" ]; then \
		echo "Error: GITHUB_REPOSITORY must be set"; \
		echo "Example: make deploy GITHUB_REPOSITORY=e2u/e-lab"; \
		exit 1; \
	fi
	@REPO_NAME=$$(echo $(GITHUB_REPOSITORY) | cut -d'/' -f2); \
	BASE_PATH="/$${REPO_NAME}/"; \
	echo "Building with base path: $$BASE_PATH..."; \
	GITHUB_REPOSITORY=$$(echo $(GITHUB_REPOSITORY)) NODE_ENV=production npm run build; \
	echo "Deployment configuration:"; \
	echo "  Repository: $(GITHUB_REPOSITORY)"; \
	echo "  Base Path: $$BASE_PATH"; \
	echo ""; \
	echo "Next steps:"; \
	echo "1. Go to https://github.com/$(GITHUB_REPOSITORY)/settings/pages"; \
	echo "2. Under 'Source', select 'Deploy from a branch'"; \
	echo "3. Select branch: gh-pages, folder: / (root)"; \
	echo "4. Click Save"; \
	echo ""; \
	echo "After saving, your site will be available at:"; \
	echo "  https://$(GITHUB_USER).github.io/$${REPO_NAME}/"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@echo "Cleaned!"
