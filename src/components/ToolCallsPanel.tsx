import { Terminal, Shield, CheckCircle, AlertTriangle, Cpu } from "lucide-react";
import { useMiraStore, ToolCallTrace } from "../store/useMiraStore";

export default function ToolCallsPanel() {
  const { toolCalls } = useMiraStore();

  if (toolCalls.length === 0) {
    return (
      <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-center text-zinc-600 text-xs font-mono lowercase">
        <Cpu className="w-5 h-5 mx-auto mb-2 opacity-30 text-teal-400" />
        No active system tool triggers logged.
      </div>
    );
  }

  const renderArgs = (args: any) => {
    if (!args || Object.keys(args).length === 0) return "{}";
    return JSON.stringify(args, null, 2);
  };

  const renderResponse = (resp: any) => {
    if (!resp) return "";
    return JSON.stringify(resp, null, 2);
  };

  return (
    <div className="bg-zinc-950/95 border border-zinc-700/40 rounded-2xl p-5 w-full max-w-md shadow-2xl text-white">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-teal-400" />
          <h3 className="text-xs font-semibold tracking-wide text-teal-400 font-mono lowercase">aria.system_kernel_logs</h3>
        </div>
        <span className="text-[10px] bg-zinc-800/80 px-2 py-0.5 rounded-full text-zinc-400 font-mono">active_traces: {toolCalls.length}</span>
      </div>

      <div className="space-y-3.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {toolCalls.map((call: ToolCallTrace) => {
          const isCompleted = call.status === "completed";
          const isFailed = call.status === "failed";
          const isRunning = call.status === "running";

          return (
            <div
              key={call.id}
              className={`p-3 rounded-xl border transition-all text-[11px] font-mono leading-relaxed bg-zinc-900/60 ${
                isCompleted 
                  ? "border-emerald-500/15 group-hover:border-emerald-500/30" 
                  : isFailed 
                  ? "border-rose-500/20" 
                  : "border-teal-500/20 shadow-[0_0_8px_rgba(20,184,166,0.06)]"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-3.5 h-3.5 ${isCompleted ? 'text-emerald-400' : isFailed ? 'text-rose-400' : 'text-teal-400 animate-pulse'}`} />
                  <span className="font-bold text-zinc-100">{call.name}()</span>
                </div>
                
                <div className="flex items-center gap-1 text-[9px] font-semibold uppercase">
                  {isCompleted && (
                    <span className="text-emerald-400 flex items-center gap-0.5 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                      <CheckCircle className="w-2.5 h-2.5" /> Done
                    </span>
                  )}
                  {isFailed && (
                    <span className="text-rose-400 flex items-center gap-0.5 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-2.5 h-2.5" /> Failed
                    </span>
                  )}
                  {isRunning && (
                    <span className="text-teal-400 flex items-center gap-1 bg-teal-500/10 px-1.5 py-0.5 rounded-full animate-pulse">
                      Executing
                    </span>
                  )}
                </div>
              </div>

              {/* Arguments */}
              <div className="text-zinc-400 bg-black/40 rounded-lg p-2 overflow-x-auto text-[10px] whitespace-pre-wrap leading-relaxed max-h-32 scrollbar-thin">
                <span className="text-teal-400/80"># arguments:</span>
                {"\n"}{renderArgs(call.args)}
              </div>

              {/* Response */}
              {isCompleted && call.response && (
                <div className="mt-2 text-zinc-300 bg-emerald-900/10 border border-emerald-500/5 rounded-lg p-2 overflow-x-auto text-[10px] whitespace-pre-wrap max-h-32 scrollbar-thin">
                  <span className="text-emerald-400"># output_result:</span>
                  {"\n"}{renderResponse(call.response)}
                </div>
              )}

              {isFailed && (
                <div className="mt-2 text-rose-300 bg-rose-950/20 rounded-lg p-2 overflow-x-auto text-[10px] whitespace-pre-wrap max-h-32 scrollbar-thin">
                  <span className="text-rose-400"># error_log:</span>
                  {"\n"}{JSON.stringify(call.response || "Execution Interrupted", null, 2)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
