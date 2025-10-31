# Build Troubleshooting

## Windows Build Crash (Error 3221226505)

If you encounter a crash during `npm run build` with error code `3221226505`, try these solutions:

### Solution 1: Increase Node Memory Limit (Recommended)

```bash
# Windows PowerShell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Or use the provided script
npm run build:legacy
```

### Solution 2: Disable Turbopack for Builds

Temporarily disable Turbopack if it's causing crashes. Edit `next.config.mjs`:

```js
const nextConfig = {
  // ... other config
  // Use webpack instead of Turbopack for builds
  webpack: (config) => config,
}
```

Then run: `NEXT_PRIVATE_SKIP_TURBOPACK=true npm run build`

### Solution 3: Clean Build

```bash
# Remove build artifacts
rm -rf .next
rm -rf node_modules/.cache

# Rebuild
npm run build
```

### Solution 4: Build in Development Mode First

```bash
npm run dev
# Let it compile, then Ctrl+C
npm run build
```

### Solution 5: Check for Large Files

The crash might be caused by processing large files. Check:
- Large images in `public/` folder
- Large JSON/data files being imported
- Memory-intensive components

### Known Issues

1. **Multiple Lockfiles**: If you have both `pnpm-lock.yaml` and `package-lock.json`, remove one
2. **Windows Path Length**: Windows has a 260 character path limit - check for deeply nested directories
3. **Antivirus**: Sometimes antivirus software interferes with builds - temporarily disable it

### Getting More Information

To see more detailed error output:

```bash
# Enable verbose logging
NODE_ENV=development npm run build

# Or check Windows Event Viewer for crash details
```

