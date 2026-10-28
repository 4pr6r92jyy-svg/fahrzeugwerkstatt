#!/usr/bin/env python3
"""Erstellt die öffentliche Galerie-Dateiliste aus familie/assets/bilderwelt."""
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
folder = root / "familie" / "assets" / "bilderwelt"
images = sorted((p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.webp','.gif'} and not p.name.startswith('.')), key=lambda p:p.name.casefold())
paths = ["assets/bilderwelt/" + p.name for p in images]
(root / "familie" / "bilderwelt.json").write_text(json.dumps({"bilder":paths}, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
print(f"Bilderwelt: {len(paths)} Bild(er)")
