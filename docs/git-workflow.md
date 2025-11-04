# Git Workflow Guide

## Branch Strategy

- **`main`**: Production-ready code, stable releases
- **`dev`**: Development branch for testing features before merging to main

## Daily Workflow

### 1. Starting Work on a New Feature

```bash
# Make sure you're on dev branch
git checkout dev

# Pull latest changes
git pull origin dev

# Create a feature branch (e.g., for chat-history feature)
git checkout -b feature/chat-history

# Work on your feature...
# Make commits as you go
git add .
git commit -m "Add chat history sidebar"
```

### 2. Testing Your Feature

```bash
# Test locally
npm run dev

# Build to check for errors
npm run build
```

### 3. Merging Feature into Dev

```bash
# When feature is ready, merge back to dev
git checkout dev
git merge feature/chat-history

# Test again on dev branch
npm run dev
npm run build

# Delete the feature branch (optional)
git branch -d feature/chat-history
```

### 4. Merging Dev into Main

When dev is stable and ready for production:

```bash
# Switch to main
git checkout main

# Pull latest changes
git pull origin main

# Merge dev into main
git merge dev

# Push to remote
git push origin main
```

## Quick Reference Commands

### Branch Management
```bash
# List all branches
git branch -a

# Switch to dev
git checkout dev

# Create and switch to new branch
git checkout -b feature/your-feature-name

# Delete a branch (local)
git branch -d branch-name

# Delete a branch (force)
git branch -D branch-name
```

### Committing Changes
```bash
# Stage all changes
git add .

# Stage specific files
git add path/to/file.ts

# Commit with message
git commit -m "Description of changes"

# Commit with detailed message
git commit -m "Short title" -m "Longer description"
```

### Syncing with Remote
```bash
# Push dev branch to remote (first time)
git push -u origin dev

# Push changes to remote
git push origin dev

# Pull latest changes
git pull origin dev

# Fetch latest changes without merging
git fetch origin
```

## Workflow Diagram

```
main (production)
  ↑
  | merge when stable
dev (testing/integration)
  ↑
  | merge when ready
feature/your-feature (work in progress)
```

## Best Practices

1. **Always start from dev**: When creating new features, branch from `dev`, not `main`
2. **Small, frequent commits**: Commit often with clear messages
3. **Test before merging**: Always test locally before merging to dev
4. **Keep dev stable**: Only merge tested features into dev
5. **Protect main**: Only merge stable, tested dev into main

## Handling Conflicts

If you get merge conflicts:

```bash
# When merging, if conflicts occur:
git merge feature/your-feature

# Resolve conflicts in your editor
# Then:
git add .
git commit -m "Merge feature/your-feature"
```

## Undoing Changes

```bash
# Discard local changes (be careful!)
git checkout -- file-name

# Undo last commit (keeps changes)
git reset --soft HEAD~1

# Undo last commit (discards changes)
git reset --hard HEAD~1

# Revert a commit (creates new commit)
git revert commit-hash
```

