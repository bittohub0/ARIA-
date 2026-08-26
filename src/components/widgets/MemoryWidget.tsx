import React, { useState, useEffect } from "react";
import { X, Trash, Plus, Brain, Sparkles, Tag, HelpCircle } from "lucide-react";
import { useMiraStore, MemoryItem } from "../../store/useMiraStore";

export default function MemoryWidget({ onClose }: { onClose: () => void }) {
  const { memories, setMemories } = useMiraStore();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  const fetchMemories = async () => {
    try {
      const res = await fetch("/api/memories");
      if (res.ok) {
        const data = await res.json();
        setMemories(data);
      }
    } catch (err) {
      console.error("Failed to load user memories from server:", err);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim(), content: newValue.trim() })
      });
      if (res.ok) {
        setNewKey("");
        setNewValue("");
        fetchMemories();
      }
    } catch (err) {
      console.error("Failed to save memory:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchMemories();
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const filteredMemories = memories.filter(m => 
    m.key.toLowerCase().includes(filterQuery.toLowerCase()) || 
    m.content.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div 
      id="mira-memory-widget" 
      className="bg-white/[0.03] border border-white/[0.05] backdrop-blur-[20px] rounded-3xl p-5 w-84 md:w-96 shadow-[0_15px_40px_rgba(0,0,0,0.5)] relative text-white flex flex-col gap-4 max-h-[480px] overflow-hidden"
    >
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        aria-label="Close Memory Vault"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-indigo-300 font-mono tracking-wider mb-0.5 text-xs lowercase">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span>aria.memory_vault</span>
        </div>
        <p className="text-[11px] text-indigo-100/40">long-term user profiling & preferences</p>
      </div>

      {/* Search Filter */}
      {memories.length > 0 && (
        <input
          type="text"
          placeholder="Filter memories..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="bg-white/5 border border-white/5 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/4d w-full"
        />
      )}

      {/* List section */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-52 scrollbar-thin scrollbar-thumb-white/10">
        {filteredMemories.length === 0 ? (
          <div className="text-center py-8 text-white/30 text-xs flex flex-col items-center justify-center gap-2">
            <div className="p-3 bg-white/[0.02] border border-white/5 rounded-full text-zinc-500">
              <Sparkles className="w-5 h-5 text-indigo-300/40" />
            </div>
            <span>
              {filterQuery 
                ? "No matching memories found." 
                : "ARIA's database is empty. Speak to ARIA to let her automatically remember key facts about your life!"}
            </span>
          </div>
        ) : (
          filteredMemories.map((memory) => {
            const formattedDate = new Date(memory.timestamp).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric"
            });

            return (
              <div
                key={memory.id}
                className="group flex flex-col p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:border-white/10 hover:bg-white/[0.04] transition-all relative"
              >
                <div className="flex justify-between items-start gap-2 mb-1.5">
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-[9px] uppercase font-bold tracking-wide">
                    <Tag className="w-2.5 h-2.5" />
                    {memory.key}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-white/30 font-mono">{formattedDate}</span>
                    <button
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="text-white/40 hover:text-rose-400 opacity-60 group-hover:opacity-100 transition-all cursor-pointer p-0.5"
                      title="Forget memory"
                      aria-label="Delete Memory"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-white/85 leading-relaxed font-sans">{memory.content}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Memory Add Form */}
      <form onSubmit={handleAddMemory} className="border-t border-white/5 pt-3.5 mt-auto flex flex-col gap-2.5">
        <div className="text-[10px] text-indigo-300/70 font-mono tracking-wider uppercase mb-0.5">Explicitly Teach Fact</div>
        
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Key (e.g. favorite_food)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            disabled={isLoading}
            className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Detail (e.g. likes Spicy Ramen)"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={isLoading}
            className="bg-white/5 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 placeholder-white/30 focus:outline-none focus:border-indigo-500"
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !newKey.trim() || !newValue.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-white/20 text-white rounded-xl py-1.5 text-xs font-bold transition-all flex items-center justify-center gap-1.5 h-9 cursor-pointer shadow-[0_0_12px_rgba(99,102,241,0.2)]"
        >
          <Plus className="w-4 h-4" />
          <span>Teach ARIA memory</span>
        </button>
      </form>
    </div>
  );
}
