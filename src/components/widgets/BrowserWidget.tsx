import React, { useState, useEffect, useRef } from "react";
import { 
  X, Plus, ChevronLeft, ChevronRight, RotateCw, Home, 
  Search, Globe, ExternalLink, HelpCircle, Eye, RefreshCw, 
  Tv, Compass, Sparkles, Sliders
} from "lucide-react";
import { useMiraStore, BrowserTab } from "../../store/useMiraStore";

interface BrowserWidgetProps {
  onClose: () => void;
}

export default function BrowserWidget({ onClose }: BrowserWidgetProps) {
  const {
    browserTabs,
    activeTabId,
    browserHistory,
    historyIndex,
    openBrowserTab,
    closeBrowserTab,
    switchBrowserTab,
    updateActiveTabUrl,
    navigateBrowserHistory
  } = useMiraStore();

  const activeTab = browserTabs.find(t => t.id === activeTabId) || browserTabs[0];
  const [addressInput, setAddressInput] = useState(activeTab?.url || "");
  const [isLoading, setIsLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [pageText, setPageText] = useState("");
  const [isReadingPage, setIsReadingPage] = useState(false);
  const [showSummaryPanel, setShowSummaryPanel] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync address line with active tab URL updates
  useEffect(() => {
    if (activeTab) {
      setAddressInput(activeTab.url);
      setPageText(""); // Clear old page text
      setIsLoading(true);
      
      // Auto extraction trigger
      extractPageSummary(activeTab.url);
    }
  }, [activeTab?.url, activeTabId]);

  // Synchronize dynamic link clicks inside our proxy iframe
  useEffect(() => {
    const handleNavigationMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'BROWSER_NAVIGATE' && e.data.url) {
        console.log("[BrowserWidget message client] Intercepted navigation link event:", e.data.url);
        updateActiveTabUrl(e.data.url);
      }
    };
    window.addEventListener('message', handleNavigationMessage);
    return () => window.removeEventListener('message', handleNavigationMessage);
  }, [updateActiveTabUrl]);

  // Fetch readability summary text for Mira's understanding
  const extractPageSummary = async (url: string) => {
    if (!url || url.includes("google.com/search") || url.includes("about:blank")) {
      return;
    }
    setIsReadingPage(true);
    try {
      const res = await fetch(`/api/proxy-text?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        setPageText(data.text || "No printable content extracted.");
      }
    } catch (e) {
      console.warn("Could not read page text context", e);
    } finally {
      setIsReadingPage(false);
    }
  };

  const handleNavigate = () => {
    if (!addressInput.trim()) return;
    let targetUrl = addressInput.trim();

    // Check if it's a search term or a web address
    const isUrlPattern = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(targetUrl) || /^https?:\/\//i.test(targetUrl);
    
    if (isUrlPattern) {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }
    } else {
      // Perform simple google search redirect
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
    }

    updateActiveTabUrl(targetUrl);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleNavigate();
    }
  };

  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(prev => prev + 1);
  };

  const isYouTubeVideo = (url: string) => {
    return url.includes("youtube.com/watch") || url.includes("youtu.be/");
  };

  const extractYouTubeID = (url: string) => {
    try {
      if (url.includes("youtu.be/")) {
        return url.split("youtu.be/")[1]?.split("?")[0];
      }
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
      return null;
    }
  };

  const handleNewTab = () => {
    openBrowserTab("https://www.google.com", "Google Search", true);
  };

  const handleQuickLink = (url: string, title: string) => {
    updateActiveTabUrl(url, title);
  };

  const ytId = activeTab ? extractYouTubeID(activeTab.url) : null;
  const isVideoState = activeTab && isYouTubeVideo(activeTab.url) && ytId;

  // Render the iframe source safely target relative path endpoint if it is standard HTML
  const getIframeSrc = () => {
    if (!activeTab) return "about:blank";
    
    if (isVideoState) {
      return `https://www.youtube.com/embed/${ytId}?enablejsapi=1&autoplay=1`;
    }
    
    // Check if already sandboxed or Google (Google doesn't allow standard frame proxy inside inline frames due to security, load in standard safe container fallback or proxy-html)
    if (activeTab.url.includes("google.com")) {
      // Use direct URL for Google but provide a notice that interactive operations require proxying
      return activeTab.url;
    }

    return `/api/proxy-html?url=${encodeURIComponent(activeTab.url)}`;
  };

  return (
    <div 
      id="mira-browser-widget" 
      className="bg-[#0b0c10]/95 border border-white/[0.08] backdrop-blur-[35px] rounded-[32px] w-[94vw] h-[88vh] max-w-6xl shadow-[0_24px_60px_rgba(0,0,0,0.8)] text-white flex flex-col overflow-hidden relative"
    >
      {/* GLOW DECORATIONS */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[40%] bg-indigo-500/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[40%] bg-fuchsia-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* TOP HEADER: ARIA ID & CLOSE */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_#818cf8]" />
          <div>
            <h3 className="text-xs font-bold tracking-widest text-indigo-300 font-mono lowercase">aria.browser_engine_v1.2</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">Status: Connected to proxy gateway</p>
          </div>
        </div>

        {/* Action Toggle buttons */}
        <div className="flex items-center gap-3">
          {pageText && (
            <button
              onClick={() => setShowSummaryPanel(!showSummaryPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold font-mono transition-all cursor-pointer border ${
                showSummaryPanel 
                  ? "bg-indigo-500/25 border-indigo-400/40 text-indigo-300" 
                  : "bg-white/[0.02] border-white/[0.05] text-zinc-300 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showSummaryPanel ? "Hide ARIA's Vision" : "ARIA's Vision"}</span>
            </button>
          )}

          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer bg-white/[0.04] p-1.5 rounded-xl hover:bg-rose-500/10"
            aria-label="Close Browser"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TABS MULTIPLE MANAGEMENT BAR */}
      <div className="flex items-center bg-[#07080a] px-4 py-2 gap-2 border-b border-white/[0.04] overflow-x-auto scrollbar-none select-none">
        <div className="flex items-center gap-1.5 flex-grow overflow-x-auto scrollbar-none pr-4">
          {browserTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => switchBrowserTab(tab.id)}
                className={`group flex items-center justify-between gap-2.5 px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all duration-300 relative min-w-[130px] max-w-[200px] flex-shrink-0 ${
                  isActive 
                    ? "bg-white/[0.06] border border-white/[0.12] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" 
                    : "bg-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden w-full">
                  <Globe className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-indigo-400" : "text-zinc-500"}`} />
                  <span className="truncate pr-4 leading-none font-sans font-medium">
                    {tab.title || tab.url}
                  </span>
                </div>
                {/* Close Tab Icon */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeBrowserTab(tab.id);
                  }}
                  className="absolute right-2 top-2.5 p-0.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all font-bold"
                  aria-label="Close Tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Plus tab button */}
        <button
          onClick={handleNewTab}
          className="bg-white/[0.03] hover:bg-indigo-500/20 text-zinc-300 hover:text-indigo-300 border border-white/[0.05] p-2 rounded-xl transition-all flex items-center justify-center shrink-0 cursor-pointer"
          title="Open New Tab"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* NAVIGATION CONTROLS ROW */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#0b0c10] border-b border-white/[0.04]">
        <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] p-1 rounded-xl">
          <button
            onClick={() => navigateBrowserHistory("back")}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Back"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => navigateBrowserHistory("forward")}
            disabled={historyIndex >= browserHistory.length - 1}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title="Forward"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleReload}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Reload"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              updateActiveTabUrl("https://www.google.com", "Google Search");
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ADDRESS INPUT FIELD */}
        <div className="flex-grow flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2 hover:border-white/10 transition-colors shadow-inner">
          <Search className="w-4 h-4 text-zinc-500 mr-2 flex-shrink-0" />
          <input
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type URL or search anything..."
            className="bg-transparent border-none text-zinc-100 placeholder-zinc-500 focus:outline-none w-full text-xs font-medium"
          />
          {isLoading && (
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin mr-1 flex-shrink-0" />
          )}
        </div>

        <button
          onClick={handleNavigate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] cursor-pointer hover:scale-[1.02]"
        >
          GO
        </button>
      </div>

      {/* MAIN VIEWPORT FRAME (TWO-PANEL WITH SUMMARY SIDEBAR) */}
      <div className="flex-grow flex bg-[#0d0e12] relative overflow-hidden">
        
        {/* WEBPAGE IFRAME CONTAINER */}
        <div className="flex-grow relative h-full flex flex-col">
          {/* Progress loader animation */}
          {isLoading && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-950 z-20 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 animate-pulse w-[80%] rounded-r" />
            </div>
          )}

          {activeTab.url === "https://www.google.com" ? (
            /* BRAND NEW TAB DASHBOARD GRID */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-[#08090d] overflow-y-auto select-none">
              <div className="absolute inset-x-0 top-12 flex justify-center opacity-40">
                <div className="w-[60%] h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
              </div>

              {/* ANIME GREETINGS BADGE */}
              <div className="flex flex-col items-center max-w-lg text-center mb-10 z-10">
                <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest text-indigo-300 uppercase mb-4">
                  <Sparkles className="w-3 h-3 animate-spin" />
                  <span>ARIA Smart Gateway</span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-zinc-400 bg-clip-text text-transparent font-sans">
                  Where shall we explore, Master?
                </h2>
                <p className="text-xs text-zinc-400 mt-2.5 max-w-sm leading-relaxed">
                  I can automatically search the web, open secure sites, find articles, and load YouTube streams for you synchronously!
                </p>
              </div>

              {/* SEARCH SPEED DIALS SECTION */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 w-full max-w-4xl z-10">
                <button
                  onClick={() => handleQuickLink("https://www.wikipedia.org", "Wikipedia")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-indigo-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-zinc-800/60 rounded-xl flex items-center justify-center text-white font-serif text-lg font-bold group-hover:bg-indigo-950 transition-colors">
                    W
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">Wikipedia</span>
                </button>

                <button
                  onClick={() => handleQuickLink("https://www.youtube.com", "YouTube")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-rose-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-rose-600/20 rounded-xl flex items-center justify-center text-rose-500 group-hover:bg-rose-950 transition-colors">
                    <Tv className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">YouTube</span>
                </button>

                <button
                  onClick={() => handleQuickLink("https://news.google.com", "Google News")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-sky-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-sky-600/10 rounded-xl flex items-center justify-center text-sky-400 group-hover:bg-sky-950 transition-colors">
                    <Compass className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">Google News</span>
                </button>

                <button
                  onClick={() => handleQuickLink("https://chat.openai.com", "ChatGPT")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-emerald-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-emerald-600/10 rounded-xl flex items-center justify-center text-emerald-400 font-bold group-hover:bg-emerald-950 transition-colors">
                    GPT
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">ChatGPT</span>
                </button>

                <button
                  onClick={() => handleQuickLink("https://mail.google.com", "Gmail Inbox")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-amber-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-amber-600/10 rounded-xl flex items-center justify-center text-amber-500 font-bold group-hover:bg-amber-950 transition-colors">
                    @
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">Gmail</span>
                </button>

                <button
                  onClick={() => handleQuickLink("https://github.com", "GitHub Repository")}
                  className="group flex flex-col items-center p-4 bg-white/[0.01] border border-white/[0.04] rounded-2xl hover:bg-white/[0.03] hover:border-fuchsia-500/30 transition-all cursor-pointer shadow-lg hover:-translate-y-1"
                >
                  <div className="w-12 h-12 bg-fuchsia-600/10 rounded-xl flex items-center justify-center text-fuchsia-400 font-bold group-hover:bg-fuchsia-950 transition-colors">
                    Git
                  </div>
                  <span className="text-[11px] font-bold text-zinc-300 mt-2.5">GitHub</span>
                </button>
              </div>

              {/* QUICK GOOGLE SEARCH BAR CONTAINER */}
              <div className="mt-12 w-full max-w-lg z-10">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask Google Search..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const targetVal = (e.target as HTMLInputElement).value;
                        if (targetVal.trim()) {
                          handleQuickLink(`https://www.google.com/search?q=${encodeURIComponent(targetVal.trim())}`, `Search: ${targetVal}`);
                        }
                      }
                    }}
                    className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-xs text-zinc-100 placeholder-white/30 focus:outline-none focus:border-indigo-500 flex-grow"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* REAL WEBSITE VIEWPORT */
            <div className="w-full h-full relative">
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={getIframeSrc()}
                className="w-full h-full bg-[#0d0e12] border-none"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                onLoad={() => setIsLoading(false)}
              />

              {activeTab.url.includes("google.com") && (
                <div className="absolute bottom-4 left-4 right-4 bg-indigo-950/90 border border-indigo-400/20 px-4 py-2.5 rounded-2xl text-[11px] text-zinc-300 flex items-center justify-between shadow-2xl z-10 backdrop-blur-xs font-mono">
                  <span>🚀 Interactive Google iframe safety active. Type searches above to browse natively with CORS proxying!</span>
                  <button 
                    onClick={() => window.open(activeTab.url, "_blank")}
                    className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors cursor-pointer text-[10px]"
                  >
                    Open Clean Tab <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SIDEBAR VIEW: ARIA READ KNOWLEDGE TEXT INSIGHTS */}
        {showSummaryPanel && pageText && (
          <div className="w-80 border-l border-white/[0.04] bg-[#07080a]/95 flex flex-col h-full flex-shrink-0 z-10 animate-slide-left relative overflow-hidden backdrop-blur-md">
            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                <span className="text-xs font-bold tracking-wider font-mono text-indigo-300 uppercase">ARIA's Page Vision</span>
              </div>
              <button 
                onClick={() => setShowSummaryPanel(false)}
                className="text-zinc-500 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 flex-grow overflow-y-auto space-y-4">
              <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4">
                <span className="text-[10px] font-mono tracking-widest text-[#a5b4fc] lowercase block mb-1">active url descriptor</span>
                <p className="text-[11px] font-mono text-zinc-400 break-all select-all leading-relaxed bg-black/30 p-2.5 rounded-xl border border-white/[0.02]">
                  {activeTab.url}
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono tracking-widest text-[#a5b4fc] lowercase block">captured page data text</span>
                {isReadingPage ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                    <span className="text-[10px] font-mono text-zinc-500">Transcribing page content...</span>
                  </div>
                ) : (
                  <div className="bg-[#0b0c10] border border-white/[0.03] p-4 rounded-2xl text-[11px] text-zinc-300 leading-relaxed font-sans max-h-80 overflow-y-auto space-y-3.5">
                    <p className="font-semibold text-xs text-indigo-300 border-b border-indigo-500/10 pb-1.5 font-sans leading-none">
                      {activeTab.title}
                    </p>
                    <p className="whitespace-pre-wrap select-text leading-relaxed">
                      {pageText ? pageText : "No content extracted. This is an interactive/Google page."}
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-r from-indigo-950/50 to-fuchsia-950/20 border border-indigo-400/10 p-4 rounded-2xl">
                <span className="text-[10px] font-bold text-indigo-400 font-mono tracking-wider block uppercase mb-1">Interactive Voice</span>
                <p className="text-[11px] text-indigo-200 leading-relaxed font-sans mt-0.5">
                  "I can see everything on this page! Go ahead and ask me: 'Summarize the page I'm viewing,' or ask specific questions about the text!"
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
