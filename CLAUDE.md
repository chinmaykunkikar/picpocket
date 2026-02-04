# Picpocket

AI-powered photo organizer. Uses CLIP to classify images by visual content into semantic categories (People, Screenshots, Documents, Real_Photos, Forwards).

## Tech Stack

- **CLI**: Node.js + TypeScript (ES2022, strict mode)
- **ML**: Python subprocess with PyTorch + Transformers (CLIP)
- **IPC**: JSON over stdin/stdout between Node and Python

## Architecture

```
src/
├── index.ts              # CLI entry (Commander.js)
├── commands/
│   ├── classify.ts       # Main classification logic
│   └── wizard.ts         # Interactive setup
├── config/
│   ├── schema.ts         # Zod validation schemas
│   ├── loader.ts         # YAML config loading
│   ├── models.ts         # CLIP model definitions
│   └── defaults.ts       # Default categories
├── classifier/
│   ├── bridge.ts         # Python subprocess IPC
│   └── types.ts          # Classification types
├── files/
│   ├── scanner.ts        # Image file discovery
│   └── copier.ts         # File operations
├── environment/
│   ├── manager.ts        # Venv setup/cleanup
│   └── paths.ts          # Platform-specific paths
└── utils/
    └── errors.ts         # Error formatting

python/
├── classifier.py         # CLIP inference
└── requirements.txt      # torch, transformers, pillow
```

## Commands

```bash
# Development
pnpm dev -- <input> [output]    # Run without building
pnpm build                       # Compile TypeScript
pnpm start -- <input> [output]  # Run compiled

# Testing
pnpm test                        # Run tests
pnpm test:watch                  # Watch mode
pnpm test:coverage               # With coverage

# Quality
pnpm typecheck                   # Type check only
pnpm lint                        # ESLint
```

## Key Patterns

### Immutability

All config/state objects use spread-merge, never mutation:

```typescript
// Correct
const updated = { ...config, threshold: 0.7 }

// Wrong
config.threshold = 0.7
```

### Zod Schemas

All external data validated at boundaries:

```typescript
const result = ConfigSchema.parse(yaml.parse(content))
```

### Python IPC

JSON messages over spawned subprocess:

```typescript
// Request
{ model, categories, images, topK }

// Progress (multiple)
{ type: "progress", current, total }

// Response
{ status: "success", results: [...], device }
```

### Error Handling

Wrap with context-aware suggestions:

```typescript
try {
  await classify(images)
} catch (error) {
  throw formatError(error, { context: 'classification' })
}
```

## File Limits

- Keep modules under 400 lines
- Extract utilities when approaching limit
- One concern per file

## Testing

- Unit tests for pure functions
- Integration tests for file operations
- Mock Python subprocess in tests
- Target 80% coverage

## Config Locations

| Platform | Config |
|----------|--------|
| Linux/macOS | `~/.config/picpocket/config.yaml` |
| Windows | `%APPDATA%\picpocket\config.yaml` |

## Important Notes

- **No console.log** — use ora spinners or chalk output
- **Copy by default** — move only with explicit `--move` flag
- **GPU auto-detect** — MPS (Apple), CUDA (NVIDIA), CPU fallback
- **Ensemble scoring** — average top-K prompts per category
