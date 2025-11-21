#!/bin/bash
sed -i '' '80s/toast.success`/toast.success(`/' src/pages/admin/Settings.tsx
sed -i '' '82s/toast.info`/toast.info(`/' src/pages/admin/Settings.tsx
echo "Fixed!"
