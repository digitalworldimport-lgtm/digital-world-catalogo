#!/usr/bin/env python3
"""Carga masiva idempotente de imágenes al catálogo (solo este repositorio).
Uso: GITHUB_TOKEN=... python tools/subir_imagenes.py /ruta/a/imagenes
No almacena credenciales. Requiere requests: pip install requests
"""
import argparse
import base64
import hashlib
import os
from pathlib import Path
import requests

REPO = "digitalworldimport-lgtm/digital-world-catalogo"
API = f"https://api.github.com/repos/{REPO}"
EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("carpeta", type=Path)
    p.add_argument("--rama", default="main")
    p.add_argument("--lote", type=int, default=20)
    p.add_argument("--aplicar", action="store_true", help="Sin esto solo muestra el plan")
    args = p.parse_args()
    if not args.carpeta.is_dir() or not 1 <= args.lote <= 50:
        p.error("Carpeta inválida o tamaño de lote fuera de 1..50")
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        p.error("Falta GITHUB_TOKEN con permiso Contents: Read and write")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                      "X-GitHub-Api-Version": "2022-11-28"})
    def req(method, endpoint, **kwargs):
        r = s.request(method, API + endpoint, timeout=90, **kwargs)
        r.raise_for_status()
        return r.json()
    files = sorted(x for x in args.carpeta.rglob("*") if x.is_file() and x.suffix.lower() in EXT)
    if not files:
        p.error("No se encontraron imágenes")
    head = req("GET", f"/git/ref/heads/{args.rama}")["object"]["sha"]
    commit = req("GET", f"/git/commits/{head}")
    tree_sha = commit["tree"]["sha"]
    tree = req("GET", f"/git/trees/{tree_sha}?recursive=1")
    if tree.get("truncated"):
        p.error("Árbol truncado: detener para evitar duplicados")
    existing = {e["path"]: e["sha"] for e in tree["tree"] if e["type"] == "blob"}
    pending = []
    for f in files:
        path = "assets/" + f.relative_to(args.carpeta).as_posix()
        data = f.read_bytes()
        # SHA de objeto Git (no confundir con SHA256).
        git_sha = hashlib.sha1(b"blob " + str(len(data)).encode() + bytes([0]) + data).hexdigest()
        if existing.get(path) == git_sha:
            print("YA EXISTE", path)
        elif path in existing:
            print("CONFLICTO: archivo diferente, no se reemplaza:", path)
        else:
            pending.append((path, data, git_sha))
    print(f"Encontrados: {len(files)} | Pendientes: {len(pending)} | Lote: {args.lote}")
    if not args.aplicar:
        print("Simulación. Para cargar, repetir con --aplicar")
        return
    for start in range(0, len(pending), args.lote):
        batch = pending[start:start + args.lote]
        entries = []
        for path, data, sha in batch:
            blob = req("POST", "/git/blobs", json={"content": base64.b64encode(data).decode(), "encoding": "base64"})
            if blob["sha"] != sha:
                raise RuntimeError(f"SHA no coincide: {path}")
            entries.append({"path": path, "mode": "100644", "type": "blob", "sha": sha})
        newtree = req("POST", "/git/trees", json={"base_tree": tree_sha, "tree": entries})["sha"]
        newcommit = req("POST", "/git/commits", json={
            "message": f"Catálogo: cargar {len(batch)} imágenes verificadas",
            "tree": newtree, "parents": [head]})["sha"]
        req("PATCH", f"/git/refs/heads/{args.rama}", json={"sha": newcommit, "force": False})
        head, tree_sha = newcommit, newtree
        remote = req("GET", f"/git/trees/{tree_sha}?recursive=1")
        verified = {e["path"]: e["sha"] for e in remote["tree"] if e["type"] == "blob"}
        for path, _, sha in batch:
            if verified.get(path) != sha:
                raise RuntimeError(f"NO VERIFICADO: {path}")
        print(f"VERIFICADO: {len(batch)} imágenes | commit {head}")
    print("Carga finalizada y verificada en GitHub.")

if __name__ == "__main__":
    main()
