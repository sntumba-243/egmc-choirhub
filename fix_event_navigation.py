with open('src/pages/member/Dashboard-MOBILE.tsx', 'r') as f:
    content = f.read()

# Replace the event card onClick to pass the specific date
old_onclick = "<button key={event.id} onClick={() => navigate('/member/calendar')} className=\"w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left group\">"

new_onclick = "<button key={event.id} onClick={() => navigate('/member/calendar', { state: { selectedDate: event.date } })} className=\"w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left group\">"

content = content.replace(old_onclick, new_onclick)

with open('src/pages/member/Dashboard-MOBILE.tsx', 'w') as f:
    f.write(content)

print("✅ Fixed event navigation!")
