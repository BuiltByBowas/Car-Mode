"""Build the downloadable ZIP for a GitHub release.

    dist/car-mode.zip        the extension (manifest.json at the zip root)

Usage, from the repo root:  python scripts/package.py
"""
import json
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
# Repo-only folders that Chrome doesn't need.
EXCLUDE = {'.git', '.gitignore', 'dist', 'docs', 'scripts'}


def zip_dir(src: Path, out: Path, skip=frozenset()):
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for path in sorted(src.rglob('*')):
            rel = path.relative_to(src)
            if rel.parts[0] in skip or not path.is_file():
                continue
            z.write(path, rel.as_posix())  # forward slashes, so it unzips everywhere


def main():
    shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir()
    zip_dir(ROOT, DIST / 'car-mode.zip', EXCLUDE)
    version = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['version']
    for f in sorted(DIST.iterdir()):
        print(f'{f.name}  {f.stat().st_size / 1048576:.1f} MB')
    print(f'Packaged Car Mode v{version}')


if __name__ == '__main__':
    main()
