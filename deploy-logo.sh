#!/bin/bash
echo "=== Deploy ChoirHub Logo - Concept 1 (Sound Bars) ==="

# Copy icons to public folder
cp icon-72x72.png public/
cp icon-96x96.png public/
cp icon-128x128.png public/
cp icon-144x144.png public/
cp icon-152x152.png public/
cp icon-192x192.png public/
cp icon-384x384.png public/
cp icon-512x512.png public/
cp favicon-32x32.png public/
cp apple-touch-icon.png public/

echo "  [1/2] Icons copied to public/"

# Update manifest.json
cat > public/manifest.json << 'MANIFEST'
{
  "name": "ChoirHub",
  "short_name": "ChoirHub",
  "description": "Choir management made simple",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0d2247",
  "theme_color": "#0d2247",
  "orientation": "any",
  "icons": [
    { "src": "/icon-72x72.png", "sizes": "72x72", "type": "image/png", "purpose": "any" },
    { "src": "/icon-96x96.png", "sizes": "96x96", "type": "image/png", "purpose": "any" },
    { "src": "/icon-128x128.png", "sizes": "128x128", "type": "image/png", "purpose": "any" },
    { "src": "/icon-144x144.png", "sizes": "144x144", "type": "image/png", "purpose": "any" },
    { "src": "/icon-152x152.png", "sizes": "152x152", "type": "image/png", "purpose": "any" },
    { "src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-384x384.png", "sizes": "384x384", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
MANIFEST

echo "  [2/2] manifest.json updated"

echo ""
echo "=== Done! ==="
echo "Run: git add -A && git commit -m 'feat: new ChoirHub logo - Concept 1 Sound Bars' && git push"
