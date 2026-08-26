import { useState } from "react";
import { X, Delete } from "lucide-react";

interface CalculatorWidgetProps {
  onClose: () => void;
}

export default function CalculatorWidget({ onClose }: CalculatorWidgetProps) {
  const [display, setDisplay] = useState("");
  const [equation, setEquation] = useState("");

  const appendValue = (val: string) => {
    setDisplay((prev) => prev + val);
    setEquation((prev) => prev + val);
  };

  const handleOperator = (op: string) => {
    setDisplay("");
    setEquation((prev) => {
      const trimmed = prev.trim();
      const lastChar = trimmed.slice(-1);
      if (["+", "-", "*", "/"].includes(lastChar)) {
        return trimmed.slice(0, -1) + " " + op + " ";
      }
      return trimmed + " " + op + " ";
    });
  };

  const calculateResult = () => {
    try {
      if (!equation) return;
      // Evaluate basic arithmetic equations safely
      // eslint-disable-next-line no-eval
      const result = eval(equation);
      setDisplay(String(result));
      setEquation(String(result));
    } catch {
      setDisplay("Error");
      setEquation("");
    }
  };

  const clearAll = () => {
    setDisplay("");
    setEquation("");
  };

  const backspace = () => {
    setDisplay((prev) => prev.slice(0, -1));
    setEquation((prev) => prev.trim().slice(0, -1));
  };

  return (
    <div id="mira-calculator-widget" className="bg-white/[0.03] border border-white/[0.05] backdrop-blur-[20px] rounded-3xl p-5 w-76 shadow-2xl relative text-white">
      <button 
        onClick={onClose} 
        className="absolute top-3.5 right-3.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        aria-label="Close Calculator"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="mb-4">
        <div className="text-xs text-indigo-300 font-mono tracking-wider mb-1 lowercase">aria.calc_utility</div>
        <div className="text-xs text-white/40 font-mono text-right truncate h-4">{equation || "0"}</div>
        <div className="text-2xl font-bold text-right truncate h-8 mt-1 pr-1 border-b border-white/5 font-mono text-indigo-50">{display || "0"}</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <button onClick={clearAll} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-rose-400 font-medium font-mono cursor-pointer transition-all">C</button>
        <button onClick={backspace} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-300 flex items-center justify-center cursor-pointer transition-all" aria-label="backspace">
          <Delete className="w-4 h-4" />
        </button>
        <button onClick={() => handleOperator("/")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-300 font-mono font-bold cursor-pointer transition-all">÷</button>
        <button onClick={() => handleOperator("*")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-300 font-mono font-bold cursor-pointer transition-all">×</button>

        <button onClick={() => appendValue("7")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">7</button>
        <button onClick={() => appendValue("8")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">8</button>
        <button onClick={() => appendValue("9")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">9</button>
        <button onClick={() => handleOperator("-")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-300 font-mono font-bold cursor-pointer transition-all">-</button>

        <button onClick={() => appendValue("4")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">4</button>
        <button onClick={() => appendValue("5")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">5</button>
        <button onClick={() => appendValue("6")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">6</button>
        <button onClick={() => handleOperator("+")} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-indigo-300 font-mono font-bold cursor-pointer transition-all">+</button>

        <button onClick={() => appendValue("1")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">1</button>
        <button onClick={() => appendValue("2")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">2</button>
        <button onClick={() => appendValue("3")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">3</button>
        <button onClick={calculateResult} className="row-span-2 p-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold font-mono cursor-pointer text-xl flex items-center justify-center transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]">=</button>

        <button onClick={() => appendValue("0")} className="col-span-2 p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">0</button>
        <button onClick={() => appendValue(".")} className="p-3 bg-white/[0.02] hover:bg-white/5 rounded-xl text-white/80 font-mono cursor-pointer transition-all">.</button>
      </div>
    </div>
  );
}
