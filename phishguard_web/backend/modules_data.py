"""
modules_data.py
Parses modules.txt into structured slides for the web frontend.

modules.txt format:
    MODULE / title: / icon: / SLIDE / heading: / body: / highlight: / END_SLIDE / END_MODULE

Each slide body is turned into "blocks" so the browser can render it nicely:
  {"kind": "p",     "text": "..."}          -> normal wrapped paragraph
  {"kind": "lines", "lines": ["...", ...]}  -> aligned / list-like text, kept line by line
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))


def _is_line_block(lines):
    """True if a paragraph is list-like / column-aligned and must keep its line breaks."""
    if len(lines) == 1:
        return "  " in lines[0].strip() or lines[0].lstrip().startswith(("-", "Step "))
    for ln in lines:
        stripped = ln.lstrip()
        if ln != stripped:                       # indented line
            return True
        if stripped.startswith(("-", "Step ")):  # bullets / steps
            return True
        if "  " in stripped:                     # column alignment
            return True
    return False


def body_to_blocks(body: str):
    blocks = []
    for para in body.split("\n\n"):
        lines = [ln.rstrip() for ln in para.split("\n") if ln.strip()]
        if not lines:
            continue
        if _is_line_block(lines):
            blocks.append({"kind": "lines", "lines": lines})
        else:
            blocks.append({"kind": "p", "text": " ".join(ln.strip() for ln in lines)})
    return blocks


def load_modules(path: str = None):
    """Returns [{title, icon, slides:[{heading, blocks, highlight}]}]. [] if file missing."""
    if path is None:
        path = os.path.join(HERE, "modules.txt")

    modules, module, slide = [], None, None
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return []

    for raw in lines:
        line = raw.rstrip("\r")
        if line == "MODULE":
            module = {"title": "", "icon": "", "slides": []}
        elif line == "END_MODULE":
            if module is not None:
                modules.append(module)
            module = None
        elif line == "SLIDE":
            slide = {"heading": "", "body": "", "highlight": ""}
        elif line == "END_SLIDE":
            if module is not None and slide is not None:
                slide["blocks"] = body_to_blocks(slide.pop("body"))
                module["slides"].append(slide)
            slide = None
        elif slide is not None and line.startswith("heading:"):
            slide["heading"] = line[len("heading:"):]
        elif slide is not None and line.startswith("body:"):
            slide["body"] = line[len("body:"):].replace("\\n", "\n")
        elif slide is not None and line.startswith("highlight:"):
            slide["highlight"] = line[len("highlight:"):]
        elif module is not None and slide is None and line.startswith("title:"):
            module["title"] = line[len("title:"):]
        elif module is not None and slide is None and line.startswith("icon:"):
            module["icon"] = line[len("icon:"):]

    return [m for m in modules if m["slides"]]
