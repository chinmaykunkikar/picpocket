# Picpocket: AI-Powered Photo Organization

## The Essence

**Picpocket sees your photos the way you do.**

Your camera roll is chaos. Thousands of images with cryptic names like `IMG_4523.HEIC` sitting next to `Screenshot 2024-01-15 at 3.42.12 PM.png`. You know what's in them, but your file system doesn't.

Picpocket uses CLIP (OpenAI's vision-language model) to understand the *content* of your images—not just metadata—and organizes them into semantic categories: People, Screenshots, Documents, Real Photos, Forwards. It's the difference between sorting by filename and sorting by meaning.

One command. Thousands of photos. Organized by what they actually are.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Commands Reference](#commands-reference)
5. [Configuration](#configuration)
6. [Architecture Deep Dive](#architecture-deep-dive)
7. [CLIP Models](#clip-models)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

---

## How It Works

### The Classification Pipeline

```
┌─────────────────┐
│  Input Folder   │  ~/Downloads/Photos (1,247 images)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Scan Images   │  Fast-glob finds all supported formats
└────────┬────────┘  (.jpg, .png, .heic, .webp, .gif, .bmp, .tiff)
         │
         ▼
┌─────────────────┐
│   Load Config   │  Categories, model, threshold, output mode
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CLIP Classifier│  Python subprocess with GPU acceleration
│                 │  (Apple Silicon MPS / NVIDIA CUDA / CPU)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Organize Files │  Copy or move to category folders
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Output Folder  │
├─────────────────┤
│  People/        │  Selfies, portraits, group photos
│  Screenshots/   │  Phone & computer screenshots
│  Documents/     │  Receipts, tickets, IDs, bills
│  Real_Photos/   │  Landscapes, food, travel, animals
│  Forwards/      │  Memes, viral images, graphics
│  Review/        │  Low-confidence (optional threshold)
└─────────────────┘
```

### CLIP: The Brain

CLIP (Contrastive Language-Image Pre-training) is a neural network trained on 400 million image-text pairs. It learns to associate images with natural language descriptions.

Picpocket uses this capability in reverse: instead of describing an image, it asks "which of these descriptions best matches this image?" Each category has multiple prompts (ensemble scoring), and the top-K prompts are averaged for robust classification.

```
Image: photo.jpg
  ├── "a photograph of people"          → 0.82
  ├── "a selfie photo"                  → 0.79
  ├── "a screenshot of a phone"         → 0.12
  ├── "a document or receipt"           → 0.08
  └── ...

Result: People (confidence: 0.81)
```

---

## Installation

### Prerequisites

- **Node.js 22+** (LTS recommended)
- **uv** (Python package manager) - install via `curl -LsSf https://astral.sh/uv/install.sh | sh`

### Install Picpocket

```bash
npm install -g picpocket
```

### First-Time Setup

```bash
picpocket setup
```

This interactive wizard:
1. Creates an isolated Python virtual environment
2. Downloads CLIP model (~900MB for default)
3. Configures classification settings
4. Detects your GPU for acceleration

---

## Quick Start

### Basic Usage

```bash
# Classify photos (copies to output folder)
picpocket ~/Downloads/Photos ~/Pictures/Sorted

# Preview without copying (dry run)
picpocket ~/Downloads/Photos ~/Pictures/Sorted --dry-run

# Move instead of copy
picpocket ~/Downloads/Photos ~/Pictures/Sorted --move

# See detailed scores per image
picpocket ~/Downloads/Photos ~/Pictures/Sorted --verbose
```

### Output Structure

```
~/Pictures/Sorted/
├── People/           # 423 files
├── Screenshots/      # 312 files
├── Documents/        # 89 files
├── Real_Photos/      # 387 files
├── Forwards/         # 36 files
└── Review/           # 0 files (threshold was 0)
```

---

## Commands Reference

### Main Command: `picpocket <input> [output]`

Classify images from input directory into output directory.

| Option | Short | Description |
|--------|-------|-------------|
| `--config <path>` | `-c` | Use custom config file |
| `--move` | `-m` | Move files instead of copying |
| `--threshold <0-1>` | `-t` | Confidence threshold for Review folder |
| `--dry-run` | `-n` | Preview classification without file operations |
| `--json` | `-j` | Output results as JSON (for automation) |
| `--limit <n>` | `-l` | Process only first N images |
| `--verbose` | `-v` | Show per-image classification scores |
| `--quiet` | `-q` | Suppress all output except errors |
| `--no-auto-setup` | | Skip environment validation |

### Subcommands

| Command | Description |
|---------|-------------|
| `setup` | Interactive setup wizard |
| `setup --yes` | Non-interactive setup with defaults |
| `setup --force` | Reinstall Python environment |
| `setup --model <id>` | Set CLIP model directly |
| `configure` | Reconfigure settings interactively |
| `models` | List available CLIP models |
| `categories` | Show current classification categories |
| `check` | Verify environment status |
| `paths` | Show config/data/cache locations |
| `cleanup` | Remove venv/config/cache |
| `cleanup --all` | Remove everything |
| `cleanup --venv` | Remove only virtual environment |
| `init` | Create default config file |
| `init --force` | Overwrite existing config |
| `config` | Print default config YAML |

---

## Configuration

### Config File Location

| Platform | Path |
|----------|------|
| Linux | `~/.config/picpocket/config.yaml` |
| macOS | `~/.config/picpocket/config.yaml` |
| Windows | `%APPDATA%\picpocket\config.yaml` |

### Config Structure

```yaml
version: 1

# Classification categories with prompts for ensemble scoring
categories:
  - name: People
    prompts:
      - "a photograph of people"
      - "a selfie photo"
      - "a group photo of friends or family"
      - "a portrait photograph"
      - "a photo with human faces"

  - name: Screenshots
    prompts:
      - "a screenshot of a phone screen"
      - "a screenshot of a computer screen"
      - "a screenshot of a mobile app"
      - "a screenshot of a website"
      - "a screen capture"

  - name: Documents
    prompts:
      - "a photo of a document"
      - "a photo of a receipt or bill"
      - "a scanned document"
      - "a photo of an ID card or passport"
      - "a photo of a ticket or boarding pass"

  - name: Real_Photos
    prompts:
      - "a photograph of nature or landscape"
      - "a photo of food or a meal"
      - "a travel photograph"
      - "a photo of an animal or pet"
      - "an artistic or aesthetic photograph"

  - name: Forwards
    prompts:
      - "a meme or viral image"
      - "a forwarded message image"
      - "a graphic or infographic"
      - "a motivational quote image"
      - "a shared social media post"

# Model and classification settings
classification:
  model: openai/clip-vit-large-patch14   # Hugging Face model ID
  threshold: 0.0                          # 0 = classify all, >0 = low → Review/
  topK: 3                                 # Prompts to average per category

# Output file handling
output:
  mode: copy                              # copy | move
  duplicateHandling: rename               # rename | skip | overwrite
```

### Key Settings Explained

**`threshold`**: Confidence cutoff for the Review folder
- `0.0` — Classify everything, no Review folder
- `0.5` — Images below 50% confidence go to Review
- `0.7` — Conservative; only high-confidence classifications

**`topK`**: Ensemble scoring strength
- `1` — Fastest, uses only best prompt per category
- `3` — Balanced (default), averages top 3 prompts
- `5` — Most robust, averages top 5 prompts

**`duplicateHandling`**: What to do when filename already exists
- `rename` — Add `_1`, `_2` suffix automatically
- `skip` — Keep existing, don't copy new
- `overwrite` — Replace with new file

---

## Architecture Deep Dive

### System Components

```
┌────────────────────────────────────────────────────────────┐
│                     Node.js CLI Layer                      │
├────────────────────────────────────────────────────────────┤
│  src/index.ts          │  CLI entry, Commander.js routing  │
│  src/commands/         │  classify, wizard logic           │
│  src/config/           │  YAML loading, Zod validation     │
│  src/files/            │  scanning, copying                │
│  src/classifier/       │  Python subprocess bridge         │
│  src/environment/      │  venv management, paths           │
│  src/utils/            │  error handling, suggestions      │
└────────────────────────────────────────────────────────────┘
                              │
                    JSON over stdin/stdout
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                   Python Classifier                        │
├────────────────────────────────────────────────────────────┤
│  python/classifier.py  │  CLIP model, inference, scoring  │
│  PyTorch + Transformers │  GPU acceleration (MPS/CUDA)    │
└────────────────────────────────────────────────────────────┘
```

### IPC Protocol

Node.js spawns Python as a subprocess. Communication is JSON over stdin/stdout.

**Request (Node → Python):**
```json
{
  "model": "openai/clip-vit-large-patch14",
  "categories": {
    "People": ["a photograph of people", "a selfie photo", ...],
    "Screenshots": ["a screenshot of a phone screen", ...]
  },
  "images": ["/path/to/image1.jpg", "/path/to/image2.png"],
  "topK": 3
}
```

**Progress Updates (Python → Node):**
```json
{"type": "progress", "current": 42, "total": 1247}
{"type": "status", "message": "Loading model..."}
```

**Response (Python → Node):**
```json
{
  "status": "success",
  "device": "mps",
  "results": [
    {"path": "/path/to/image1.jpg", "category": "People", "confidence": 0.847},
    {"path": "/path/to/image2.png", "category": "Screenshots", "confidence": 0.923}
  ]
}
```

### Device Detection

```python
def get_device():
    if torch.backends.mps.is_available():    # Apple Silicon GPU
        return "mps"
    elif torch.cuda.is_available():           # NVIDIA GPU
        return "cuda"
    return "cpu"                              # Fallback
```

Performance varies significantly:
- **Apple M1/M2/M3**: 10-20 images/second (MPS)
- **NVIDIA RTX 3080**: 30-50 images/second (CUDA)
- **CPU only**: 1-3 images/second

---

## CLIP Models

### Available Models

| Model ID | Size | Speed | Accuracy | Use Case |
|----------|------|-------|----------|----------|
| `openai/clip-vit-base-patch32` | 350MB | Fast | Good | Low memory, quick tests |
| `openai/clip-vit-base-patch16` | 350MB | Medium | Better | Balanced base model |
| `openai/clip-vit-large-patch14` | 900MB | Medium | Best | **Default, recommended** |
| `openai/clip-vit-large-patch14-336` | 900MB | Slow | Highest | Maximum accuracy |

### Custom Models

Any Hugging Face CLIP model works:

```bash
picpocket setup --model laion/CLIP-ViT-H-14-laion2B-s32B-b79K
```

Or edit `~/.config/picpocket/config.yaml`:

```yaml
classification:
  model: laion/CLIP-ViT-H-14-laion2B-s32B-b79K
```

---

## Advanced Usage

### JSON Output for Automation

```bash
picpocket ~/Photos ~/Sorted --json > results.json
```

```json
{
  "results": [
    {"path": "/Users/me/Photos/IMG_001.jpg", "category": "People", "confidence": 0.89},
    {"path": "/Users/me/Photos/IMG_002.png", "category": "Screenshots", "confidence": 0.94}
  ],
  "summary": {
    "total": 1247,
    "People": 423,
    "Screenshots": 312,
    "Documents": 89,
    "Real_Photos": 387,
    "Forwards": 36
  }
}
```

### Custom Categories

Edit your config to add custom categories:

```yaml
categories:
  - name: Work
    prompts:
      - "a screenshot of code or IDE"
      - "a diagram or flowchart"
      - "a presentation slide"
      - "a whiteboard photo"

  - name: Receipts
    prompts:
      - "a photo of a receipt"
      - "a photo of a bill or invoice"
      - "a payment confirmation screenshot"
```

### Batch Processing Scripts

```bash
#!/bin/bash
# Process multiple folders

for folder in ~/Photos/2023-*; do
    picpocket "$folder" ~/Organized/$(basename "$folder") --quiet
done
```

### Integration with Other Tools

```bash
# After classification, remove duplicates with fdupes
fdupes -rdN ~/Organized/

# Sync to cloud storage
rclone sync ~/Organized/ gdrive:Photos/Organized

# Generate thumbnails
for img in ~/Organized/**/*.jpg; do
    convert "$img" -thumbnail 200x200 "${img%.jpg}_thumb.jpg"
done
```

---

## Troubleshooting

### Common Issues

**"uv not found"**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.zshrc  # or ~/.bashrc
```

**"Model download failed"**
- Check internet connection
- Try a smaller model: `picpocket setup --model openai/clip-vit-base-patch32`
- Check disk space (~1GB needed for default model)

**"Out of memory"**
- Use a smaller model
- Process in batches: `picpocket ~/Photos ~/Sorted --limit 500`
- Close other GPU-intensive apps

**"Slow classification"**
- Verify GPU is detected: `picpocket check`
- Use a faster model: `openai/clip-vit-base-patch32`
- Reduce `topK` to 1 for speed

### Diagnostic Commands

```bash
# Check environment status
picpocket check

# Output:
# ✓ uv installed (0.1.24)
# ✓ Virtual environment exists
# ✓ Dependencies installed
# ✓ Device: mps (Apple Silicon GPU)

# Show all paths
picpocket paths

# Output:
# Config: ~/.config/picpocket/config.yaml
# Data:   ~/.local/share/picpocket
# Cache:  ~/.cache/picpocket
# Venv:   ~/.local/share/picpocket/venv
```

### Reset Everything

```bash
picpocket cleanup --all
picpocket setup --force
```

---

## Performance Tips

1. **Use GPU acceleration**: Apple Silicon and NVIDIA GPUs are 10-30x faster than CPU
2. **Choose the right model**: `clip-vit-base-patch32` is 2x faster than `clip-vit-large-patch14`
3. **Lower topK for speed**: `topK: 1` is fastest, `topK: 3` is balanced
4. **Batch large collections**: Use `--limit` to process in chunks if memory is tight
5. **Use move mode**: `--move` is faster than copy for same-filesystem operations

---

## File Locations Summary

| Type | Linux | macOS | Windows |
|------|-------|-------|---------|
| Config | `~/.config/picpocket/` | `~/.config/picpocket/` | `%APPDATA%\picpocket\` |
| Data | `~/.local/share/picpocket/` | `~/Library/Application Support/picpocket/` | `%LOCALAPPDATA%\picpocket\` |
| Cache | `~/.cache/picpocket/` | `~/Library/Caches/picpocket/` | `%LOCALAPPDATA%\picpocket\cache\` |
| Venv | `~/.local/share/picpocket/venv/` | `~/Library/Application Support/picpocket/venv/` | `%LOCALAPPDATA%\picpocket\venv\` |

---

## Summary

Picpocket bridges the gap between how you think about your photos and how your filesystem stores them. Instead of manual sorting or brittle filename-based rules, it uses state-of-the-art vision AI to understand image content and organize accordingly.

**Key strengths:**
- Zero configuration needed (sensible defaults)
- Works offline after initial model download
- GPU-accelerated for speed
- Non-destructive by default (copies, doesn't move)
- Customizable categories and thresholds
- Cross-platform (Linux, macOS, Windows)

**One command to organize your photo chaos:**

```bash
picpocket ~/Downloads ~/Pictures/Organized
```
