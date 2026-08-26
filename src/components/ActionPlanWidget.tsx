import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, 
  Loader2, 
  Circle, 
  XCircle, 
  Sparkles, 
  X, 
  ArrowRight,
  ListOrdered
} from "lucide-react";
import { useMiraStore, ActionPlanStep } from "../store/useMiraStore";

export default function ActionPlanWidget() {
  const { currentActionPlan, setActionPlan } = useMiraStore();

  if (!currentActionPlan) return null;

  const completedSteps = currentActionPlan.steps.filter((s) => s.status === "completed").length;
  const totalSteps = currentActionPlan.steps.length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const isAllComplete = currentActionPlan.status === "completed";
  const isFailed = currentActionPlan.status === "failed";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-lg mx-auto my-3 px-2 z-30"
      >
        <div className="bg-slate-950/90 border border-indigo-500/30 rounded-2xl p-4 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl relative overflow-hidden">
          {/* Subtle Top Gradient Accent */}
          <div 
            className={`absolute top-0 left-0 h-1 transition-all duration-500 ${
              isAllComplete 
                ? "bg-gradient-to-r from-emerald-500 to-teal-400 w-full" 
                : isFailed 
                ? "bg-gradient-to-r from-rose-500 to-amber-500 w-full" 
                : "bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-400"
            }`}
            style={{ width: isAllComplete || isFailed ? "100%" : `${Math.max(10, progressPercent)}%` }}
          />

          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <ListOrdered className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    {currentActionPlan.title}
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-semibold ${
                    isAllComplete 
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                      : isFailed 
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" 
                      : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 animate-pulse"
                  }`}>
                    {isAllComplete ? "Completed" : isFailed ? "Failed" : `Step ${completedSteps + 1} of ${totalSteps}`}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate max-w-xs mt-0.5">
                  &ldquo;{currentActionPlan.originalQuery}&rdquo;
                </p>
              </div>
            </div>

            <button
              onClick={() => setActionPlan(null)}
              className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-all cursor-pointer"
              title="Dismiss plan overview"
              aria-label="Dismiss action plan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Steps Progress List */}
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
            {currentActionPlan.steps.map((step: ActionPlanStep, idx: number) => {
              const isRunning = step.status === "running";
              const isCompleted = step.status === "completed";
              const isStepFailed = step.status === "failed";

              return (
                <motion.div
                  key={step.id || idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                    isRunning 
                      ? "bg-indigo-950/40 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.15)]" 
                      : isCompleted 
                      ? "bg-slate-900/40 border-emerald-500/20 text-zinc-300" 
                      : isStepFailed 
                      ? "bg-rose-950/30 border-rose-500/30 text-rose-300" 
                      : "bg-slate-900/20 border-white/5 text-zinc-500"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isRunning ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : isStepFailed ? (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Circle className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>
                    <div className="truncate">
                      <span className={`font-medium ${isRunning ? "text-indigo-200" : isCompleted ? "text-zinc-200 line-through opacity-80" : "text-zinc-400"}`}>
                        {step.description}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono shrink-0 ml-2 text-zinc-400">
                    {step.stepNumber}/{step.totalSteps}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Spoken summary preview on completion */}
          {isAllComplete && currentActionPlan.spokenSummary && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{currentActionPlan.spokenSummary}</span>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
