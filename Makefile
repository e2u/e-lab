# E-LAB Project Makefile
# This Makefile helps with local development, building, and deploying to GitHub Pages

SHELL := /bin/bash
NODE_VERSION := $(shell node --version 2>/dev/null || echo "not installed")
YARN_VERSION := $(shell yarn --version 2>/dev/null || echo "not installed")

.PHONY: help install dev build preview test deploy clean

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
		yarn install; \
	else \
		echo "Dependencies already installed."; \
	fi

dev:
	@echo "Starting development server..."
	@yarn dev

build:
	@echo "Building production version..."
	@GITHUB_REPOSITORY=$(GITHUB_REPOSITORY) NODE_ENV=production yarn build
	@echo "Build completed! Output is in dist/ directory."

preview:
	@echo "Previewing production build..."
	@yarn preview

test:
	@echo "Running tests..."
	@yarn test

deploy: build
	@echo "Deployment to GitHub Pages is automated via GitHub Actions."
	@echo "Simply push or merge your changes to the 'main' branch:"
	@echo "  git checkout main && git merge dev && git push origin main"

clean:
	@echo "Cleaning build artifacts..."
	@rm -rf dist/
	@echo "Cleaned!"
