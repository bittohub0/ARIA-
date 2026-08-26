import React, { useState } from "react";
import { X, Plus, Trash } from "lucide-react";
import { useMiraStore } from "../../store/useMiraStore";

interface NotesWidgetProps {
  onClose: () => void;
}

export default function NotesWidget({ onClose }: NotesWidgetProps) {
  const { notes, addNote, deleteNote } = useMiraStore();
  const [inputText, setInputText] = useState("");

  const handleAdd = () => {
    if (!inputText.trim()) return;
    addNote(inputText.trim());
    setInputText("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  return (
    <div id="mira-notes-widget" className="bg-white/[0.03] border border-white/[0.05] backdrop-blur-[20px] rounded-3xl p-5 w-80 shadow-2xl relative text-white">
      <button 
        onClick={onClose} 
        className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        aria-label="Close Notes"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <h3 className="text-sm font-semibold tracking-wide text-indigo-300 font-mono lowercase">aria.notes_utility</h3>
        <p className="text-xs text-indigo-205/50 mt-0.5">save memos, quotes, or thoughts with ARIA</p>
      </div>

      {/* Input row */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="New note..."
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-white/30 focus:outline-none focus:border-indigo-500 flex-grow"
        />
        <button
          onClick={handleAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-center transition-all cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.3)]"
          aria-label="Add Note"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
        {notes.length === 0 ? (
          <div className="text-center py-6 text-white/40 text-xs">Note directory is empty. Ask ARIA to take a note!</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="group flex justify-between items-start p-2.5 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 transition-all text-xs"
            >
              <span className="text-zinc-200 leading-relaxed font-sans">{note.text}</span>
              <button
                onClick={() => deleteNote(note.id)}
                className="text-white/40 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-all cursor-pointer p-0.5 ml-2"
                aria-label="Delete Note"
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
