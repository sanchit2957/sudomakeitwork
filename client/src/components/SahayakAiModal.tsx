import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  Bot,
  Send,
  Sparkles,
  X,
  RotateCcw,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Mic,
  MicOff,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface SahayakAiModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SUGGESTED_PROMPTS = [
  { icon: "🌊", text: "Flood safety" },
  { icon: "🏥", text: "Find a hospital" },
  { icon: "🚑", text: "Rescue assistance" },
  { icon: "🌧️", text: "Weather information" },
  { icon: "🆘", text: "What should I do in an emergency?" },
];

export function SahayakAiModal({ isOpen, onClose }: SahayakAiModalProps) {
  const { locale, t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
      }
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      const langMap: Record<string, string> = {
        en: 'en-IN',
        as: 'as-IN', // Experimental / Not widely supported natively but sets standard
        hi: 'hi-IN',
        bn: 'bn-IN',
        or: 'or-IN',
        mr: 'mr-IN',
        gu: 'gu-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        kn: 'kn-IN',
      };
      recognitionRef.current.lang = langMap[locale] || 'en-IN';
    }
  }, [locale]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setErrorMessage(t("Speech recognition is not supported in this browser."));
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => (prev ? prev + " " + transcript : transcript));
          setIsListening(false);
        };
        
        recognitionRef.current.onerror = (event: any) => {
          setIsListening(false);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setErrorMessage(t("Microphone access denied or error occurred."));
          }
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const chatMutation = trpc.ai?.chat?.useMutation
    ? trpc.ai.chat.useMutation()
    : ({
        mutateAsync: async () => ({ reply: "Sahayak AI is online and ready.", conversationId: "default" }),
        isPending: false,
      } as any);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || input).trim();
    if (!messageContent || chatMutation.isPending) return;

    setErrorMessage("");
    setLastFailedMessage("");

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random()}`,
      role: "user",
      content: messageContent,
      timestamp: Date.now(),
    };

    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");

    try {
      const response = await chatMutation.mutateAsync({
        message: messageContent,
        language: locale,
        history: nextHistory.slice(-6).map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}-${Math.random()}`,
        role: "assistant",
        content: response?.reply || t("I have received your request."),
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorText = err?.message || t("Sahayak AI is temporarily unavailable. Please try again or use the SOS/emergency options if you need immediate help.");
      setErrorMessage(errorText);
      setLastFailedMessage(messageContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const handleClearConversation = () => {
    setMessages([]);
    setErrorMessage("");
    setLastFailedMessage("");
    setInput("");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sahayak-ai-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-[2rem] bg-[#fcfdfd] shadow-2xl ring-1 ring-black/10 dark:bg-[#121214] dark:ring-white/10 sm:max-h-[80vh] animate-in slide-in-from-bottom duration-300"
      >
        {/* Top Drag Pill */}
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>

        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#174e46] text-white shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base" role="img" aria-label="robot">🤖</span>
                <h2 id="sahayak-ai-title" className="text-base font-extrabold tracking-tight text-[#142c2b] dark:text-[#f4f4f5]">
                  {t("Sahayak AI")}
                </h2>
              </div>
              <p className="text-[11px] font-bold text-[#63817b] dark:text-[#a1a1aa]">
                {t("Assam Emergency Assistant")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearConversation}
                title={t("Clear conversation")}
                aria-label={t("Clear conversation")}
                className="grid h-8 w-8 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 active:scale-95 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label={t("Close")}
              className="grid h-8 w-8 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 active:scale-95 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Chat Message Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-[#f1f8f5] p-3.5 text-xs text-[#214f44] ring-1 ring-[#174e46]/10 dark:bg-[#162723] dark:text-[#99f6e4] dark:ring-[#2dd4bf]/15">
            <p className="font-extrabold text-sm flex items-center gap-1.5">
              <span>👋</span> {t("Hi! I'm Sahayak AI. How can I help you?")}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed opacity-90">
              {t("Ask about live flood conditions, weather warnings, nearby hospitals, or disaster safety.")}
            </p>
          </div>

          {/* Quick Suggestion Chips (when conversation is fresh) */}
          {messages.length === 0 && (
            <div className="pt-2">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#63817b] dark:text-[#a1a1aa]">
                {t("Suggested Prompts")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_PROMPTS.map(({ icon, text }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSendMessage(t(text))}
                    className="flex items-center gap-1.5 rounded-full border border-[#d6e7e2] bg-white px-3 py-1.5 text-xs font-bold text-[#1e4840] shadow-2xs transition hover:border-[#174e46] hover:bg-[#f6faf8] active:scale-95 dark:border-neutral-700 dark:bg-[#1a1a1c] dark:text-[#e4e4e7] dark:hover:bg-neutral-800"
                  >
                    <span>{icon}</span>
                    <span>{t(text)}</span>
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#174e46] text-white rounded-br-xs shadow-xs"
                    : "bg-white text-[#142c2b] shadow-sm ring-1 ring-black/5 rounded-bl-xs dark:bg-[#1c1c1f] dark:text-[#f4f4f5] dark:ring-white/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="mt-0.5 px-1 text-[9px] font-semibold text-neutral-400 dark:text-neutral-500">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}

          {/* Thinking Indicator */}
          {chatMutation.isPending && (
            <div className="flex items-center gap-2 text-xs font-bold text-[#446f65] dark:text-[#5eead4]">
              <div className="grid h-7 w-7 place-items-center rounded-xl bg-[#eaf4f1] dark:bg-[#1f3632]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
              <span>{t("Sahayak AI is thinking…")}</span>
            </div>
          )}

          {/* Error Message with Retry */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#fff0ef] p-3 text-xs text-[#b44742] ring-1 ring-[#b44742]/15 dark:bg-[#2d1b1b] dark:text-[#f87171]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-bold">{errorMessage}</p>
                {lastFailedMessage && (
                  <button
                    type="button"
                    onClick={() => handleSendMessage(lastFailedMessage)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#b44742] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#993b37] active:scale-95"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>{t("Retry")}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <footer className="border-t border-neutral-100 bg-white p-3.5 dark:border-neutral-800 dark:bg-[#121214]">
          <div className="flex items-center gap-2 rounded-2xl border border-[#d6e7e2] bg-[#fcfdfd] px-3 py-1.5 shadow-2xs focus-within:border-[#174e46] focus-within:ring-2 focus-within:ring-[#174e46]/10 dark:border-neutral-700 dark:bg-[#1a1a1c] dark:focus-within:border-[#2dd4bf]">
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? t("Stop listening") : t("Start listening")}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${
                isListening 
                  ? "bg-rose-500 text-white animate-pulse" 
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
              }`}
            >
              {isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
            </button>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatMutation.isPending}
              placeholder={t("Ask about flood safety, weather, or hospitals…")}
              className="flex-1 bg-transparent py-1.5 text-xs text-[#142c2b] placeholder:text-neutral-400 focus:outline-hidden dark:text-[#f4f4f5] dark:placeholder:text-neutral-500"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || chatMutation.isPending}
              aria-label={t("Send message")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#174e46] text-white transition active:scale-95 hover:bg-[#1f6359] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default SahayakAiModal;
