# picpocket

A CLI tool to classify images using CLIP. Automatically organizes photos into categories like People, Screenshots, Documents, Real Photos, and Forwards.

## Features

- **CLIP-powered classification** - Uses OpenAI's CLIP model for accurate image categorization
- **Automatic environment setup** - Uses `uv` to manage Python dependencies in an isolated virtual environment
- **Customizable categories** - Define your own categories and prompts via YAML config
- **Batch processing** - Efficiently processes entire directories
- **Dry-run mode** - Preview results before copying files
- **JSON output** - Scriptable output format for automation
- **Hardware acceleration** - Automatically uses MPS (Apple Silicon), CUDA (NVIDIA), or CPU
- **Standards-compliant** - Follows XDG Base Directory Specification (Linux), Apple guidelines (macOS), and AppData conventions (Windows)

## Installation

### Prerequisites

1. **Node.js** (v18 or later)
2. **uv** - Fast Python package manager

Install uv:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/picpocket.git
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

```bash
# Set up with interactive wizard (recommended)
picpocket setup

# Set up with defaults (skip wizard)
picpocket setup --yes
picpocket setup --force         # Reinstall Python environment
picpocket setup --model <id>    # Set model without wizard

# Reconfigure settings anytime
picpocket configure

# List available CLIP models
picpocket models

# Remove data to free disk space
picpocket cleanup          # Preview what will be removed
picpocket cleanup --yes    # Remove virtual environment (~500MB-2GB)
picpocket cleanup --all --yes  # Remove everything (venv, config, cache)

# Check environment status
picpocket check

# Show file locations
picpocket paths

# List current categories
picpocket categories
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

## File Locations

picpocket follows platform-specific standards for storing files:

### Linux (XDG Base Directory Specification)
```
Config: ~/.config/picpocket/config.yaml
Data:   ~/.local/share/picpocket/venv
Cache:  ~/.cache/picpocket
```

Override with `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`.

### macOS
```
Config: ~/.config/picpocket/config.yaml
Data:   ~/Library/Application Support/picpocket/venv
Cache:  ~/Library/Caches/picpocket
```

### Windows
```
Config: %APPDATA%\picpocket\config.yaml
Data:   %LOCALAPPDATA%\picpocket\venv
Cache:  %LOCALAPPDATA%\picpocket\cache
```

Run `picpocket paths` to see exact locations on your system.

## Environment Management

picpocket uses `uv` to manage Python dependencies in an isolated virtual environment. This keeps your system Python clean.

**Automatic setup**: On first run, if uv is installed but the environment isn't set up, picpocket will automatically install dependencies.

**Manual setup**: Run `picpocket setup` to explicitly set up or reinstall the environment.

**Cleanup options**:
```bash
# Preview what will be removed (default: venv only)
picpocket cleanup

# Remove virtual environment (~500MB-2GB)
picpocket cleanup --yes

# Remove everything
picpocket cleanup --all --yes

# Remove specific items
picpocket cleanup --venv --yes     # Just the venv
picpocket cleanup --config --yes   # Just the config
picpocket cleanup --cache --yes    # Just the cache
```

## Configuration

Create a custom config file:

```bash
picpocket init
```

### Config File Format

```yaml
version: 1

categories:
  - name: People
    prompts:
      - "a photograph of people"
      - "a selfie photo"
      - "a family photograph"

  - name: Screenshots
    prompts:
      - "a screenshot of a mobile phone screen"
      - "a screenshot of a computer screen"

  - name: Documents
    prompts:
      - "a photograph of a document"
      - "a photo of a receipt"

  - name: Real_Photos
    prompts:
      - "a landscape photograph"
      - "a photograph of food"

  - name: Forwards
    prompts:
      - "a meme image"
      - "a viral internet meme"

classification:
  model: openai/clip-vit-large-patch14
  threshold: 0.0
  topK: 3

output:
  mode: copy          # copy | move
  duplicateHandling: rename  # rename | skip | overwrite
```

### Custom Categories

Add your own categories by editing the config file:

```yaml
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
```

## Default Categories

1. **People** - Selfies, portraits, group photos, family photos
2. **Screenshots** - Phone/computer screenshots, chat screenshots, app interfaces
3. **Documents** - Receipts, tickets, IDs, bills, certificates
4. **Real_Photos** - Landscapes, food, travel, objects, animals
5. **Forwards** - Memes, viral images, quotes, graphics, infographics

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

## Output Structure

```
output/
├── People/
│   ├── IMG_001.jpg
│   └── IMG_002.jpg
├── Screenshots/
│   └── Screenshot_2024.png
├── Documents/
│   └── receipt.jpg
├── Real_Photos/
│   └── sunset.jpg
├── Forwards/
│   └── meme.jpg
└── Review/          # Only when using --threshold
    └── unclear.jpg
```

## Development

```bash
# Run in development mode
npm run dev -- /path/to/photos

# Run tests
npm test

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
