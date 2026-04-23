# Contributing to Depo

Thank you for your interest in contributing to Depo! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to learn and build something great together.

## Getting Started

### Prerequisites

- Node.js >= 18
- Yarn 1.22.x
- Git

### Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/depo.git
   cd depo
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/Bobr-Soft/depo.git
   ```

4. **Install dependencies**:
   ```bash
   yarn install
   ```

5. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Apps

```bash
# Run all apps in development mode
yarn dev

# Run specific app
yarn workspace frontend dev     # Web app at localhost:5173
yarn workspace backend dev      # API at localhost:3000
yarn workspace mobile start # Mobile app with Expo
```

### Building

```bash
# Build all apps
yarn build

# Build specific app
yarn workspace frontend build
```

### Linting & Formatting

```bash
# Lint all apps
yarn lint

# Format code
yarn format

# Type check
yarn check-types
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper typing
- Export types and interfaces

### React/React Native

- Use functional components with hooks
- Follow the component structure in existing files
- Use the shared UI components from `packages/ui`

### File Naming

- Components: `PascalCase.tsx` (e.g., `ItemCard.tsx`)
- Utilities: `kebab-case.ts` (e.g., `format-date.ts`)
- Hooks: `use-hook-name.ts` (e.g., `use-theme-color.ts`)
- Types: `types.ts` or `ComponentName.types.ts`

### Folder Structure

```
src/
├── components/     # Reusable components
│   └── ui/        # Base UI components
├── constants/     # Constants and theme
├── hooks/         # Custom hooks
├── pages/         # Page components (web)
├── services/      # API services
└── utils/         # Utility functions
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Scopes

- `web` - Web app changes
- `mobile` - Mobile app changes
- `api` - API changes
- `ui` - Shared UI package
- `config` - Configuration changes
- `deps` - Dependency updates

### Examples

```bash
feat(mobile): add item search functionality
fix(web): resolve login redirect issue
docs(api): update API endpoint documentation
refactor(ui): simplify Button component props
```

## Pull Request Process

1. **Update your branch** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your branch**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub

4. **Fill out the PR template** completely

5. **Wait for review** - address any feedback

6. **Squash and merge** once approved

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated (if needed)
- [ ] No console errors or warnings
- [ ] Self-reviewed the changes

## Issue Guidelines

### Before Creating an Issue

1. Search existing issues to avoid duplicates
2. Check the documentation
3. Try to reproduce the issue

### Creating a Good Issue

- Use the appropriate issue template
- Provide a clear, descriptive title
- Include steps to reproduce (for bugs)
- Add screenshots if applicable
- Specify which app is affected

### Issue Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `documentation` | Documentation updates |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `triage` | Needs review |

## Questions?

If you have questions, feel free to:

1. Open a [Discussion](https://github.com/Bobr-Soft/depo/discussions)
2. Check existing issues and discussions

---

Thank you for contributing! 🚀
