import React, { useState, useEffect } from "react";
import { 
  X, 
  Clock, 
  Globe, 
  Bell, 
  Timer, 
  ListTodo, 
  Calendar as CalendarIcon,
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle, 
  Circle 
} from "lucide-react";
import { useMiraStore } from "../../store/useMiraStore";

interface ClockWidgetProps {
  onClose: () => void;
}

export default function ClockWidget({ onClose }: ClockWidgetProps) {
  const {
    alarms,
    addAlarm,
    deleteAlarm,
    toggleAlarm,
    timers,
    addTimer,
    deleteTimer,
    updateTimer,
    reminders,
    addReminder,
    deleteReminder,
    toggleReminder,
    calendarEvents,
    addCalendarEvent,
    deleteCalendarEvent,
    toggleCalendarEvent
  } = useMiraStore();

  const [activeTab, setActiveTab] = useState<"clock" | "calendar" | "alarms" | "timers" | "reminders">("clock");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Input states for creation
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [alarmLabel, setAlarmLabel] = useState("");
  const [timerDuration, setTimerDuration] = useState("5"); // default 5 mins
  const [timerLabel, setTimerLabel] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date(Date.now() + 86400000).toISOString().split("T")[0]);
  const [eventTime, setEventTime] = useState("19:00");

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Render second ticker coordinates for clock tab
  const seconds = currentTime.getSeconds();
  const rotationDegrees = (seconds / 60) * 360;

  const handleAddAlarmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alarmTime) return;
    addAlarm(alarmTime, alarmLabel.trim() || "Alarm");
    setAlarmLabel("");
  };

  const handleAddTimerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationMins = parseFloat(timerDuration);
    if (isNaN(durationMins) || durationMins <= 0) return;
    const durationSeconds = Math.round(durationMins * 60);
    addTimer(durationSeconds, timerLabel.trim() || "Timer");
    setTimerLabel("");
  };

  const handleAddReminderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reminderText.trim()) return;
    addReminder(reminderText.trim(), reminderTime || undefined);
    setReminderText("");
    setReminderTime("");
  };

  const handleAddCalendarSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    addCalendarEvent(eventTitle.trim(), eventDate || "Tomorrow", eventTime || "19:00");
    setEventTitle("");
  };

  const formatTimerTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div id="mira-clock-widget" className="bg-zinc-950/95 border border-white/[0.08] backdrop-blur-[24px] rounded-3xl p-6 w-[420px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative text-white transition-all">
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
        aria-label="Close Clock"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Widget Header */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold tracking-widest text-indigo-400 font-mono uppercase">system_time_matrix</h3>
        <p className="text-[10px] text-zinc-500 font-mono uppercase mt-0.5">aria native alarms, timers, calendar & schedule</p>
      </div>

      {/* Tab Navigation Pill Row */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5 mb-5 text-[11px]">
        <button
          onClick={() => setActiveTab("clock")}
          className={`flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 font-sans font-medium transition-all cursor-pointer ${activeTab === "clock" ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/50" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Clock</span>
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 font-sans font-medium transition-all cursor-pointer ${activeTab === "calendar" ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/50" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Events</span>
        </button>
        <button
          onClick={() => setActiveTab("alarms")}
          className={`flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 font-sans font-medium transition-all cursor-pointer ${activeTab === "alarms" ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/50" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Alarms</span>
          {alarms.filter(a => a.enabled).length > 0 && (
            <span className="w-1.5 h-1.5 bg-rose-400 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("timers")}
          className={`flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 font-sans font-medium transition-all cursor-pointer ${activeTab === "timers" ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/50" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <Timer className="w-3.5 h-3.5" />
          <span>Timers</span>
          {timers.filter(t => t.status === "running").length > 0 && (
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab("reminders")}
          className={`flex-1 py-1.5 px-1 rounded-lg flex items-center justify-center gap-1 font-sans font-medium transition-all cursor-pointer ${activeTab === "reminders" ? "bg-indigo-650 text-white shadow-md shadow-indigo-950/50" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Tasks</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="min-h-[250px] flex flex-col justify-between">
        
        {/* TAB 1: SYSTEM CLOCK */}
        {activeTab === "clock" && (
          <div className="flex flex-col items-center justify-center py-2 relative">
            {/* Visual Circular Pulse Gauge */}
            <div className="relative w-44 h-44 rounded-full border border-white/10 flex items-center justify-center shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]">
              {/* Dynamic Second hand tracker */}
              <div 
                className="absolute inset-0 rounded-full pointer-events-none transition-all duration-300"
                style={{
                  background: `conic-gradient(from 0deg, rgba(99, 102, 241, 0.15) 0deg, rgba(99, 102, 241, 0.4) ${rotationDegrees}deg, transparent ${rotationDegrees}deg 360deg)`
                }}
              />
              
              <div className="flex flex-col items-center justify-center z-10 text-center">
                <span className="text-3xl font-bold font-mono tracking-tight text-white mb-1">
                  {formattedTime}
                </span>
                <span className="text-[11px] text-indigo-400 font-mono tracking-wider uppercase">
                  {formattedDate}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 text-[10px] text-zinc-500 font-mono bg-white/[0.02] border border-white/5 px-3 py-1.5 rounded-full">
              <Globe className="w-3 h-3 text-indigo-400" />
              <span>TIMEZONE: {timezone}</span>
            </div>
          </div>
        )}

        {/* TAB 2: CALENDAR & EVENTS */}
        {activeTab === "calendar" && (
          <div className="flex flex-col flex-1 gap-3">
            {/* Calendar events scrollable list */}
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                  No upcoming calendar events scheduled.
                </div>
              ) : (
                calendarEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <button
                      onClick={() => toggleCalendarEvent(evt.id)}
                      className="flex-1 flex items-start gap-3 text-left cursor-pointer"
                    >
                      <div className="shrink-0 mt-0.5">
                        {evt.completed ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-500 hover:text-indigo-400 transition-colors" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-semibold ${evt.completed ? "text-zinc-500 line-through" : "text-white"}`}>
                          {evt.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 text-indigo-400" /> {evt.date}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-zinc-500" /> {evt.time}
                          </span>
                        </div>
                        {evt.description && (
                          <span className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{evt.description}</span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteCalendarEvent(evt.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 ml-2"
                      title="Delete event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Event Form */}
            <form onSubmit={handleAddCalendarSubmit} className="flex flex-col gap-2 border-t border-white/5 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Event title (e.g., Team Sync, Doctor Appointment)..."
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all"
                  required
                />
                <button
                  type="submit"
                  className="p-2 bg-indigo-650 hover:bg-indigo-600 border border-indigo-400/20 text-white rounded-xl transition duration-200 cursor-pointer w-8 h-8 flex items-center justify-center shrink-0"
                  title="Schedule event"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none transition-all font-mono"
                />
                <input
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-white outline-none transition-all font-mono w-24"
                />
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: ALARMS LIST */}
        {activeTab === "alarms" && (
          <div className="flex flex-col flex-1 gap-4">
            {/* Alarms scrollable list */}
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
              {alarms.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                  No active alarms registered.
                </div>
              ) : (
                alarms.map((alarm) => (
                  <div key={alarm.id} className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <div className="flex flex-col">
                      <span className="text-lg font-mono font-bold text-white tracking-wider">{alarm.time}</span>
                      <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono mt-0.5">{alarm.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Alarm toggle switch */}
                      <button
                        onClick={() => toggleAlarm(alarm.id)}
                        className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${alarm.enabled ? "bg-indigo-600" : "bg-zinc-700"}`}
                        title={alarm.enabled ? "Disable alarm" : "Enable alarm"}
                      >
                        <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform absolute top-0.75 ${alarm.enabled ? "right-1" : "left-1"}`} />
                      </button>
                      
                      <button
                        onClick={() => deleteAlarm(alarm.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Delete alarm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Alarm Form */}
            <form onSubmit={handleAddAlarmSubmit} className="flex items-center gap-2 border-t border-white/5 pt-3">
              <input
                type="time"
                value={alarmTime}
                onChange={(e) => setAlarmTime(e.target.value)}
                className="bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white outline-none transition-all font-mono shrink-0 w-24"
                required
              />
              <input
                type="text"
                placeholder="Label (e.g. Standup)..."
                value={alarmLabel}
                onChange={(e) => setAlarmLabel(e.target.value)}
                className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-650 hover:bg-indigo-600 border border-indigo-400/20 text-white rounded-xl transition duration-200 cursor-pointer w-8 h-8 flex items-center justify-center shrink-0"
                title="Add alarm"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 4: TIMERS LIST */}
        {activeTab === "timers" && (
          <div className="flex flex-col flex-1 gap-4">
            {/* Timers scrollable list */}
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
              {timers.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                  No running countdown timers.
                </div>
              ) : (
                timers.map((timer) => {
                  const percent = timer.duration > 0 ? (timer.remaining / timer.duration) * 100 : 0;
                  return (
                    <div key={timer.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2 relative overflow-hidden">
                      {/* Visual timer remaining progress bar */}
                      <div className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-all duration-1000" style={{ width: `${percent}%` }} />

                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white capitalize">{timer.label}</span>
                          <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{timer.duration / 60} min preset</span>
                        </div>
                        <span className="text-base font-mono font-bold text-indigo-300">{formatTimerTime(timer.remaining)}</span>
                      </div>

                      {/* Controls bar */}
                      <div className="flex items-center justify-end gap-1.5 mt-1 border-t border-white/[0.02] pt-2">
                        {timer.status === "completed" ? (
                          <span className="text-[10px] font-mono font-semibold text-rose-400 uppercase tracking-widest mr-auto animate-pulse">ELAPSED</span>
                        ) : (
                          <button
                            onClick={() => updateTimer(timer.id, { status: timer.status === "running" ? "paused" : "running" })}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                            title={timer.status === "running" ? "Pause timer" : "Resume timer"}
                          >
                            {timer.status === "running" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => updateTimer(timer.id, { remaining: timer.duration, status: "paused" })}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                          title="Reset timer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTimer(timer.id)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer flex items-center justify-center"
                          title="Delete timer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Timer Form */}
            <form onSubmit={handleAddTimerSubmit} className="flex items-center gap-2 border-t border-white/5 pt-3">
              <div className="relative flex items-center shrink-0 w-24">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={timerDuration}
                  onChange={(e) => setTimerDuration(e.target.value)}
                  className="w-full bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl pl-3 pr-8 py-2 text-xs text-white outline-none transition-all font-mono"
                  required
                />
                <span className="absolute right-3 text-[10px] text-zinc-500 font-mono select-none pointer-events-none uppercase">MIN</span>
              </div>
              <input
                type="text"
                placeholder="Timer Label..."
                value={timerLabel}
                onChange={(e) => setTimerLabel(e.target.value)}
                className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all"
              />
              <button
                type="submit"
                className="p-2 bg-indigo-650 hover:bg-indigo-600 border border-indigo-400/20 text-white rounded-xl transition duration-200 cursor-pointer w-8 h-8 flex items-center justify-center shrink-0"
                title="Add timer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 5: REMINDERS LIST */}
        {activeTab === "reminders" && (
          <div className="flex flex-col flex-1 gap-4">
            {/* Reminders scrollable list */}
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar flex-1">
              {reminders.length === 0 ? (
                <div className="text-center py-8 text-zinc-500 text-xs font-mono">
                  No reminders scheduled.
                </div>
              ) : (
                reminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all">
                    <button
                      onClick={() => toggleReminder(reminder.id)}
                      className="flex-1 flex items-start gap-3.5 text-left cursor-pointer"
                    >
                      <div className="shrink-0 mt-0.5">
                        {reminder.completed ? (
                          <CheckCircle className="w-4 h-4 text-indigo-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-500 hover:text-indigo-400 transition-colors" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-xs font-medium transition-all ${reminder.completed ? "text-zinc-500 line-through" : "text-white"}`}>{reminder.text}</span>
                        {reminder.time && (
                          <span className="text-[9px] text-indigo-300 font-mono mt-0.5 tracking-wider uppercase flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-indigo-400" /> {reminder.time}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 ml-2"
                      title="Delete reminder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Reminder Form */}
            <form onSubmit={handleAddReminderSubmit} className="flex flex-col gap-2 border-t border-white/5 pt-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Study for math, walk dog..."
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  className="flex-1 bg-white/5 hover:bg-white/10 focus:bg-white/15 border border-white/10 focus:border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none transition-all"
                  required
                />
                <button
                  type="submit"
                  className="p-2 bg-indigo-650 hover:bg-indigo-600 border border-indigo-400/20 text-white rounded-xl transition duration-200 cursor-pointer w-8 h-8 flex items-center justify-center shrink-0"
                  title="Add reminder"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">ALERT TIME (OPTIONAL):</span>
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-2 py-1 text-[10px] text-white outline-none transition-all font-mono w-24"
                />
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
