#!/bin/bash
# Test amaçlı: farklı zaman noktalarında headless Chrome ekran görüntüsü alır
cd "$(dirname "$0")/.."
C='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
for s in "$@"; do
  "$C" --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist \
    --window-size=1000,800 --virtual-time-budget=6000 --screenshot="shot_$s.png" \
    "http://localhost:8765/index.html#t=$s" >/dev/null 2>&1
done
ls shot_*
