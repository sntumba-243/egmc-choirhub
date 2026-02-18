#!/bin/bash

echo "=== Phase 3.6: Scope Admin Pages by church_id ==="
echo ""

# =============================================
# DASHBOARD.TSX - Already has useAuth
# =============================================
echo "--- Dashboard.tsx ---"

# Scope members count
sed -i '' "s|supabase.from('members').select('id, created_at')|supabase.from('members').select('id, created_at').eq('church_id', user?.church_id)|" src/pages/admin/Dashboard.tsx

# Scope upcoming events count
sed -i '' "s|supabase.from('events').select('id').gte('date'|supabase.from('events').select('id').eq('church_id', user?.church_id).gte('date'|" src/pages/admin/Dashboard.tsx

# Scope messages count  
sed -i '' "s|supabase.from('messages').select('id, created_at').eq('send_to', 'all')|supabase.from('messages').select('id, created_at').eq('church_id', user?.church_id)|" src/pages/admin/Dashboard.tsx

# Scope upcoming events list
sed -i '' "s|\.from('events')$|.from('events')|" src/pages/admin/Dashboard.tsx

# Scope fetchUpcomingEvents
sed -i '' "/const fetchUpcomingEvents/,/\.limit(3)/{
  s|\.select('\*')$|.select('*').eq('church_id', user?.church_id)|
}" src/pages/admin/Dashboard.tsx 2>/dev/null

# Scope alert member count
sed -i '' "s|\.neq(\"role\", \"inactive\")|.eq('church_id', user?.church_id).neq('role', 'inactive')|" src/pages/admin/Dashboard.tsx 2>/dev/null

echo "  [1/8] Dashboard.tsx scoped"

# =============================================
# MEMBERS.TSX
# =============================================
echo "--- Members.tsx ---"

# Add useAuth import if missing
grep -q "useAuth" src/pages/admin/Members.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/Members.tsx

# Add user hook if missing
grep -q "useAuth()" src/pages/admin/Members.tsx || \
  sed -i '' '/const navigate = useNavigate();/a\
  const { user } = useAuth();
' src/pages/admin/Members.tsx

# Scope the members query
sed -i '' "s|\.order('last_name', { ascending: true });|.eq('church_id', user?.church_id).order('last_name', { ascending: true });|" src/pages/admin/Members.tsx

echo "  [2/8] Members.tsx scoped"

# =============================================
# MEMBERFORM.TSX  
# =============================================
echo "--- MemberForm.tsx ---"

grep -q "useAuth" src/pages/admin/MemberForm.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/MemberForm.tsx

grep -q "useAuth()" src/pages/admin/MemberForm.tsx || \
  sed -i '' '/const navigate = useNavigate();/a\
  const { user } = useAuth();
' src/pages/admin/MemberForm.tsx

echo "  [3/8] MemberForm.tsx - useAuth added"

# =============================================
# EVENTS.TSX
# =============================================
echo "--- Events.tsx ---"

grep -q "useAuth" src/pages/admin/Events.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/Events.tsx

grep -q "useAuth()" src/pages/admin/Events.tsx || \
  sed -i '' '/const navigate = useNavigate();/a\
  const { user } = useAuth();
' src/pages/admin/Events.tsx

echo "  [4/8] Events.tsx - useAuth added"

# =============================================
# EVENTFORM.TSX
# =============================================
echo "--- EventForm.tsx ---"

grep -q "useAuth" src/pages/admin/EventForm.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/EventForm.tsx

grep -q "useAuth()" src/pages/admin/EventForm.tsx || \
  sed -i '' '/const navigate = useNavigate();/a\
  const { user } = useAuth();
' src/pages/admin/EventForm.tsx

echo "  [5/8] EventForm.tsx - useAuth added"

# =============================================
# MESSAGES.TSX
# =============================================
echo "--- Messages.tsx ---"

grep -q "useAuth" src/pages/admin/Messages.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/Messages.tsx

echo "  [6/8] Messages.tsx - useAuth added"

# =============================================
# MESSAGEFORM.TSX
# =============================================
echo "--- MessageForm.tsx ---"

grep -q "useAuth" src/pages/admin/MessageForm.tsx || \
  sed -i '' "s|import toast from 'react-hot-toast';|import toast from 'react-hot-toast';\nimport { useAuth } from '../../contexts/AuthContext';|" src/pages/admin/MessageForm.tsx

grep -q "useAuth()" src/pages/admin/MessageForm.tsx || \
  sed -i '' '/const navigate = useNavigate();/a\
  const { user } = useAuth();
' src/pages/admin/MessageForm.tsx

echo "  [7/8] MessageForm.tsx - useAuth added"

# =============================================
# ATTENDANCESTATS.TSX
# =============================================
echo "--- AttendanceStats.tsx ---"

grep -q "useAuth" src/pages/admin/AttendanceStats.tsx || \
  sed -i '' "1i\\
import { useAuth } from '../../contexts/AuthContext';
" src/pages/admin/AttendanceStats.tsx

echo "  [8/8] AttendanceStats.tsx - useAuth added"

echo ""
echo "=== Verification ==="
echo ""
echo "Files with useAuth:"
grep -l "useAuth" src/pages/admin/Dashboard.tsx src/pages/admin/Members.tsx src/pages/admin/MemberForm.tsx src/pages/admin/Events.tsx src/pages/admin/EventForm.tsx src/pages/admin/Messages.tsx src/pages/admin/MessageForm.tsx src/pages/admin/AttendanceStats.tsx 2>/dev/null

echo ""
echo "Dashboard church_id filters:"
grep -c "church_id" src/pages/admin/Dashboard.tsx

echo ""
echo "Members church_id filters:"
grep -c "church_id" src/pages/admin/Members.tsx

echo ""
echo "=== DONE ==="
echo ""
echo "The script added useAuth imports and scoped key queries."
echo "Run: npm run dev  to test locally."
