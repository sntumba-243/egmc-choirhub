#!/bin/bash

# Create stub components
for file in Login Register ProtectedRoute; do
  cat > /tmp/cc-agent/59222270/project/src/pages/$file.tsx << 'INNER'
import React from 'react';
export const FILENAME: React.FC<any> = () => <div>Stub</div>;
INNER
  sed -i "s/FILENAME/$file/g" /tmp/cc-agent/59222270/project/src/pages/$file.tsx
done

# Create layouts
for file in MemberLayout AdminLayout; do
  cat > /tmp/cc-agent/59222270/project/src/layouts/$file.tsx << 'INNER'
import React from 'react';
export const FILENAME: React.FC<any> = ({ children }) => <div>{children}</div>;
INNER
  sed -i "s/FILENAME/$file/g" /tmp/cc-agent/59222270/project/src/layouts/$file.tsx
done

# Create member pages
for file in Repertoire SongDetail Calendar EventDetail Messages MessageDetail Practice Profile; do
  cat > /tmp/cc-agent/59222270/project/src/pages/member/$file.tsx << 'INNER'
import React from 'react';
export const Member${file}: React.FC<any> = () => <div>Member $file</div>;
INNER
  sed -i "s/\${file}/$file/g" /tmp/cc-agent/59222270/project/src/pages/member/$file.tsx
done

# Create admin pages
for file in Dashboard Repertoire Events Messages; do
  cat > /tmp/cc-agent/59222270/project/src/pages/admin/$file.tsx << 'INNER'
import React from 'react';
export const Admin${file}: React.FC<any> = () => <div>Admin $file</div>;
INNER
  sed -i "s/\${file}/$file/g" /tmp/cc-agent/59222270/project/src/pages/admin/$file.tsx
done

# Create SongForm
cat > /tmp/cc-agent/59222270/project/src/pages/admin/SongForm.tsx << 'INNER'
import React from 'react';
export const SongForm: React.FC<any> = () => <div>Song Form</div>;
INNER

# Create ProtectedRoute component
cat > /tmp/cc-agent/59222270/project/src/components/ProtectedRoute.tsx << 'INNER'
import React from 'react';
export const ProtectedRoute: React.FC<any> = ({ children }) => <>{children}</>;
INNER

