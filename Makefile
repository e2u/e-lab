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
	@if [ -z "$(GITHUB_USER)" ] || [ -z "$(GITHUB_REPO)" ]; then \
		echo "Error: GITHUB_USER and GITHUB_REPO must be set"; \
		echo "Example: make deploy GITHUB_USER=username GITHUB_REPO=reponame"; \
		exit 1; \
	fi
	@echo "Pushing to gh-pages branch for user/$(GITHUB_USER)/repo/$(GITHUB_REPO)..."
	@git add -f dist/
	@git commit -m "Auto-deploy to GitHub Pages at $$(date '+%Y-%m-%d %H:%M:%S')"
	@git subtree push --prefix dist origin gh-pages
	@echo "Deployment complete!"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@echo "Cleaned!"
