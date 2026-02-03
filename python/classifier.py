#!/usr/bin/env python3
"""
CLIP-based image classifier for picpocket CLI.
Communicates via JSON over stdin/stdout.
"""

import sys
import json
from pathlib import Path
from collections import defaultdict

import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel


def get_device():
    """Get the best available device (MPS for M1 Mac, CUDA, or CPU)."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    return "cpu"


def send_response(data):
    """Send JSON response to stdout."""
    print(json.dumps(data), flush=True)


def send_progress(current, total):
    """Send progress update."""
    send_response({"type": "progress", "current": current, "total": total})


def load_model(model_name, device):
    """Load CLIP model and processor."""
    model = CLIPModel.from_pretrained(model_name)
    processor = CLIPProcessor.from_pretrained(model_name)
    model = model.to(device)
    model.eval()
    return model, processor


def precompute_text_features(model, processor, device, categories):
    """Precompute text features for all category prompts."""
    all_prompts = []
    prompt_to_category = []

    for category, prompts in categories.items():
        for prompt in prompts:
            all_prompts.append(prompt)
            prompt_to_category.append(category)

    inputs = processor(text=all_prompts, return_tensors="pt", padding=True)
    inputs = {k: v.to(device) for k, v in inputs.items()}

    with torch.no_grad():
        text_outputs = model.get_text_features(**inputs)
        if hasattr(text_outputs, 'pooler_output'):
            text_features = text_outputs.pooler_output
        elif hasattr(text_outputs, 'last_hidden_state'):
            text_features = text_outputs.last_hidden_state[:, 0, :]
        else:
            text_features = text_outputs
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    category_indices = defaultdict(list)
    for idx, cat in enumerate(prompt_to_category):
        category_indices[cat].append(idx)

    return text_features, prompt_to_category, category_indices


def classify_image(image_path, model, processor, device, text_features, category_indices, top_k):
    """Classify a single image using ensemble scoring."""
    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        return None, None, None, str(e)

    try:
        inputs = processor(images=image, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            image_outputs = model.get_image_features(**inputs)
            if hasattr(image_outputs, 'pooler_output'):
                image_features = image_outputs.pooler_output
            elif hasattr(image_outputs, 'last_hidden_state'):
                image_features = image_outputs.last_hidden_state[:, 0, :]
            else:
                image_features = image_outputs
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

            all_similarities = (image_features @ text_features.T).squeeze(0)

            category_scores = {}
            for category, indices in category_indices.items():
                cat_similarities = all_similarities[indices]
                k = min(top_k, len(indices))
                top_scores, _ = cat_similarities.topk(k)
                category_scores[category] = top_scores.mean().item()

            best_category = max(category_scores, key=category_scores.get)
            confidence = category_scores[best_category]

        return best_category, confidence, category_scores, None
    except Exception as e:
        return None, None, None, str(e)


def handle_classify(request):
    """Handle classify command."""
    config = request.get("config", {})
    images = request.get("images", [])

    model_name = config.get("model", "openai/clip-vit-large-patch14")
    categories = config.get("categories", {})
    top_k = config.get("topK", 3)

    device = get_device()

    send_response({"type": "status", "message": f"Loading model on {device}..."})

    try:
        model, processor = load_model(model_name, device)
    except Exception as e:
        send_response({
            "status": "error",
            "error": f"Failed to load model: {str(e)}"
        })
        return

    send_response({"type": "status", "message": "Precomputing text features..."})

    text_features, _, category_indices = precompute_text_features(
        model, processor, device, categories
    )

    results = []
    errors = []
    total = len(images)

    for idx, image_path in enumerate(images):
        send_progress(idx + 1, total)

        category, confidence, scores, error = classify_image(
            image_path, model, processor, device, text_features, category_indices, top_k
        )

        if error:
            errors.append({"path": image_path, "error": error})
        else:
            results.append({
                "path": image_path,
                "category": category,
                "confidence": confidence,
                "scores": scores
            })

    send_response({
        "status": "success",
        "device": device,
        "results": results,
        "errors": errors
    })


def handle_check():
    """Handle check command - verify installation."""
    device = get_device()

    checks = {
        "torch": True,
        "transformers": True,
        "pillow": True,
        "device": device,
        "torch_version": torch.__version__,
    }

    try:
        import transformers
        checks["transformers_version"] = transformers.__version__
    except Exception:
        checks["transformers"] = False

    try:
        import PIL
        checks["pillow_version"] = PIL.__version__
    except Exception:
        checks["pillow"] = False

    send_response({
        "status": "success",
        "checks": checks
    })


def main():
    """Main entry point - read JSON from stdin."""
    try:
        input_data = sys.stdin.read()
        request = json.loads(input_data)
    except json.JSONDecodeError as e:
        send_response({
            "status": "error",
            "error": f"Invalid JSON input: {str(e)}"
        })
        sys.exit(1)

    command = request.get("command", "classify")

    if command == "classify":
        handle_classify(request)
    elif command == "check":
        handle_check()
    else:
        send_response({
            "status": "error",
            "error": f"Unknown command: {command}"
        })
        sys.exit(1)


if __name__ == "__main__":
    main()
