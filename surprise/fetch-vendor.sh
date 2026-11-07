#!/bin/bash
# Three.js r160 dosyalarını yerel olarak indirir (CDN bağımlılığı olmasın diye)
set -e
cd "$(dirname "$0")"
B="https://cdn.jsdelivr.net/npm/three@0.160.0"
mkdir -p vendor/jsm/controls vendor/jsm/postprocessing vendor/jsm/shaders
curl -fsSL "$B/build/three.module.min.js" -o vendor/three.module.min.js
for f in controls/OrbitControls postprocessing/EffectComposer postprocessing/RenderPass postprocessing/UnrealBloomPass postprocessing/ShaderPass postprocessing/MaskPass postprocessing/Pass postprocessing/OutputPass shaders/CopyShader shaders/LuminosityHighPassShader shaders/OutputShader; do
  curl -fsSL "$B/examples/jsm/$f.js" -o "vendor/jsm/$f.js" || echo "FAIL $f"
done
ls -R vendor
