<div align="center">

# picpocket

**Sort photos by content, not filename**

[![Tests](https://github.com/chinmaykunkikar/picpocket/actions/workflows/test.yml/badge.svg)](https://github.com/chinmaykunkikar/picpocket/actions/workflows/test.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

</div>

A CLI that uses CLIP to classify images into categories like People, Screenshots, Documents, Real Photos, and Forwards. Works offline on Apple Silicon, NVIDIA, or CPU.

```bash
picpocket ~/Downloads/camera-roll ~/Pictures/Sorted
```

```
Sorted/
├── People/        # selfies, group photos, portraits
├── Screenshots/   # phone & computer screenshots
├── Documents/     # receipts, tickets, IDs
├── Real_Photos/   # landscapes, food, travel
├── Forwards/      # memes, viral images
└── Review/        # low confidence (when using --threshold)
```

<div align="center">

[![asciicast](https://asciinema.org/a/JL018lKOkBYymRaQ.svg)](https://asciinema.org/a/JL018lKOkBYymRaQ)

</div>

## Features

- **CLIP-powered** — Understands what's *in* the image, not just metadata
- **Hardware accelerated** — Runs on Apple Silicon (MPS), NVIDIA (CUDA), or CPU
- **Zero config** — Works out of the box with sensible defaults
- **Customizable** — Define your own categories via YAML
- **Non-destructive** — Copies by default, preview with `--dry-run`
- **Scriptable** — JSON output for automation

## Installation

### Prerequisites

1. **Node.js** (v22 or later)
2. **uv** - Fast Python package manager

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Setup

```bash
# Clone the repository
git clone https://github.com/chinmaykunkikar/picpocket.git
cd picpocket

# Install Node.js dependencies
npm install

# Build the CLI
npm run build

# Link globally (optional)
npm link

# Set up Python environment (automatic on first run, or manual)
picpocket setup
```

### Verify Installation

```bash
picpocket check
```

This shows the status of uv, the virtual environment, file paths, and Python dependencies.

## Usage

### Basic Usage

```bash
# Classify images - auto-installs Python deps on first run
picpocket /path/to/photos

# Specify output directory
picpocket /path/to/photos /path/to/output

# Move files instead of copying
picpocket /path/to/photos --move

# Preview without copying (dry run)
picpocket /path/to/photos --dry-run
```

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--config <path>` | `-c` | Path to custom config file |
| `--move` | `-m` | Move files instead of copying |
| `--threshold <0-1>` | `-t` | Confidence threshold (low scores go to Review/) |
| `--dry-run` | `-n` | Preview without copying files |
| `--json` | `-j` | Output results as JSON |
| `--limit <n>` | `-l` | Process only first N images |
| `--verbose` | `-v` | Show per-image classification scores |
| `--quiet` | `-q` | Suppress progress output |
| `--no-auto-setup` | | Disable automatic environment setup |

### Subcommands

picpocket uses `uv` to manage Python dependencies in an isolated virtual environment. Dependencies are installed automatically on first run.

```bash
# Set up Python environment and configure settings
picpocket setup             # Interactive wizard (recommended)
picpocket setup --yes       # Use defaults, skip wizard
picpocket setup --force     # Reinstall Python environment
picpocket setup --model <id>  # Set model directly

# Reconfigure settings
picpocket configure

# List available CLIP models
picpocket models

# Free up disk space (~500MB-2GB)
picpocket cleanup           # Preview what will be removed
picpocket cleanup --yes     # Remove virtual environment
picpocket cleanup --all --yes  # Remove everything (venv, config, cache)

# Diagnostics
picpocket check             # Environment status
picpocket paths             # File locations
picpocket categories        # Current categories
```

## Setup Wizard

Running `picpocket setup` launches an interactive wizard to configure:

- **CLIP model** - Choose from recommended models or use any Hugging Face model
- **Output mode** - Copy (keep originals) or move (delete originals)
- **Confidence threshold** - Route low-confidence images to Review/ folder
- **Duplicate handling** - Rename, skip, or overwrite existing files
- **Top-K scoring** - Number of prompts to ensemble per category

```
┌─────────────────────────────────────────────┐
│         picpocket Setup Wizard            │
└─────────────────────────────────────────────┘

? CLIP model › ViT-L/14 (recommended)
? Default file operation › Copy files (keep originals)
? Confidence threshold › None (classify all images)
? Handle duplicate filenames › Rename (add _1, _2, etc.)
? Ensemble scoring › Top 3 (recommended)
```

To reconfigure later: `picpocket configure`

## Model Selection

Any CLIP model from Hugging Face can be used. Here are some recommended options:

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| `openai/clip-vit-base-patch32` | ~350MB | Fastest | Quick sorting, low memory |
| `openai/clip-vit-base-patch16` | ~350MB | Fast | Balanced base model |
| `openai/clip-vit-large-patch14` | ~900MB | Medium | **Recommended** - best balance |
| `openai/clip-vit-large-patch14-336` | ~900MB | Slower | Highest accuracy |

```bash
# List recommended models and see which is currently selected
picpocket models

# Use a recommended model
picpocket setup --model openai/clip-vit-base-patch32

# Use any Hugging Face CLIP model
picpocket setup --model laion/CLIP-ViT-H-14-laion2B-s32B-b79K
```

The selected model is saved to your config file. Models are downloaded from Hugging Face on first use.

## Configuration

picpocket works out of the box with sensible defaults. To customize, create a config file:

```bash
picpocket init
```

### Default Categories

picpocket ships with 5 built-in categories:

| Category | What it matches |
|----------|-----------------|
| **People** | Selfies, portraits, group photos, family photos |
| **Screenshots** | Phone/computer screenshots, chat screenshots, app interfaces |
| **Documents** | Receipts, tickets, IDs, bills, certificates |
| **Real_Photos** | Landscapes, food, travel, objects, animals |
| **Forwards** | Memes, viral images, quotes, graphics, infographics |

### Custom Categories

Override or extend the defaults by editing the config file:

```yaml
version: 1

categories:
  - name: Artwork
    prompts:
      - "a painting"
      - "digital artwork"
      - "an illustration"

  - name: Receipts
    prompts:
      - "a photo of a receipt"
      - "a shopping receipt"
      - "a restaurant bill"

classification:
  model: openai/clip-vit-large-patch14
  threshold: 0.0   # 0 = classify all, 0.7 = send low-confidence to Review/
  topK: 3          # prompts to ensemble per category

output:
  mode: copy                  # copy | move
  duplicateHandling: rename   # rename | skip | overwrite
```

Each category needs a `name` and a list of `prompts` that describe what images belong there. The more specific your prompts, the better the classification

## Examples

### Process a photo backup

```bash
picpocket ~/Downloads/Photos ~/Pictures/Sorted --verbose
```

### Dry run with JSON output

```bash
picpocket ./photos --dry-run --json > results.json
```

### Use confidence threshold

Images with confidence below the threshold go to a `Review/` folder:

```bash
picpocket ./photos --threshold 0.7
```

### Process only first 100 images

```bash
picpocket ./photos --limit 100 --verbose
```

## Development

```bash
# Run in development mode
npm run dev -- /path/to/photos

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Type check
npm run typecheck

# Build
npm run build
```

## How It Works

1. **Environment check** - Verifies uv and Python dependencies (auto-installs if needed)
2. **Scanning** - Finds all images (jpg, png, gif, webp, heic, bmp) in the input directory
3. **Classification** - Sends images to Python subprocess running CLIP model
4. **Ensemble scoring** - For each category, averages the top-k prompt similarities
5. **Copying** - Copies/moves files to category folders in the output directory

## Troubleshooting

### "uv is not installed"
Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`

### Setup is slow
First-time setup downloads PyTorch (~500MB-2GB depending on platform). Subsequent runs are fast.

### Wrong device detected
picpocket auto-detects MPS (Apple Silicon) > CUDA (NVIDIA) > CPU. Check with `picpocket check`.

### Out of memory
Use `--limit` to process images in smaller batches.

### Clean up disk space
Run `picpocket cleanup --yes` to remove the virtual environment and free ~500MB-2GB.

## License

MIT
