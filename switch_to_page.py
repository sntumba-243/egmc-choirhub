# Fix Dashboard to navigate to event page instead of modal
with open('src/pages/member/Dashboard-MOBILE.tsx', 'r') as f:
    content = f.read()

# Remove modal import
content = content.replace(
    "import { EventDetailModal } from '../../components/EventModal';",
    ""
)

# Remove selectedEvent state
content = content.replace(
    """  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);""",
    "  const [loading, setLoading] = useState(true);"
)

# Update event button to navigate to event page
content = content.replace(
    '<button key={event.id} onClick={() => setSelectedEvent(event)} className="w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left group">',
    '<button key={event.id} onClick={() => navigate(`/member/events/${event.id}`)} className="w-full bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors text-left group">'
)

# Remove the modal component at the bottom
content = content.replace(
    """      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};""",
    """    </div>
  );
};"""
)

with open('src/pages/member/Dashboard-MOBILE.tsx', 'w') as f:
    f.write(content)

print("✅ Dashboard updated to use page navigation!")
