import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

function getDaysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getFirstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
}

function getStatusColor(status) {
  const s = (status || '').toLowerCase();
  if (/complete|active|approved/.test(s)) return '#15803d';
  if (/critical|overdue|risk/.test(s)) return '#dc2626';
  if (/watch|pending|upcoming/.test(s)) return '#d97706';
  return '#1d4ed8';
}

export default function Calendar({ events = [], onDateSelect = null }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(event => {
      const date = event.date || event.targetDate;
      if (date) {
        const d = new Date(date).toISOString().split('T')[0];
        if (!map[d]) map[d] = [];
        map[d].push(event);
      }
    });
    return map;
  }, [events]);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const today = new Date();
  const isCurrentMonth = today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="calendar-widget"
    >
      <div className="calendar-header">
        <button className="calendar-nav-btn" onClick={goToPrevMonth}>←</button>
        <h4>{monthName}</h4>
        <button className="calendar-nav-btn" onClick={goToNextMonth}>→</button>
      </div>

      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="calendar-day empty" />;
          }

          const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
            .toISOString()
            .split('T')[0];
          const dayEvents = eventsByDate[dateStr] || [];
          const isToday = isCurrentMonth && day === today.getDate();

          return (
            <motion.div
              key={day}
              className={`calendar-day ${isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
              whileHover={{ scale: 1.05 }}
              onClick={() => onDateSelect?.(dateStr)}
            >
              <div className="calendar-day-num">{day}</div>
              {dayEvents.length > 0 && (
                <div className="calendar-day-events">
                  {dayEvents.slice(0, 2).map((event, i) => (
                    <div
                      key={i}
                      className="event-dot"
                      style={{ background: getStatusColor(event.status) }}
                      title={event.title || event.name}
                    />
                  ))}
                  {dayEvents.length > 2 && <span className="event-more">+{dayEvents.length - 2}</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
