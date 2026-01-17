"use client";

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface WorldContext {
  entities: Array<{ id: string; title: string; type: string; summary?: string }>;
  articles: Array<{ id: string; title: string; content: string }>;
  events: Array<{ id: string; title: string; description?: string }>;
  maps: Array<{ id: string; title: string }>;
}

interface AIAssistantClientProps {
  workspaceId: string;
}

export default function AIAssistantClient({ workspaceId }: AIAssistantClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [worldContext, setWorldContext] = useState<WorldContext | null>(null);
  const [contextLoaded, setContextLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load world context on mount
  useEffect(() => {
    if (!workspaceId) return;

    async function loadContext() {
      try {
        const res = await fetch(`/api/ai/world-context?workspaceId=${workspaceId}`);
        if (res.ok) {
          const data = await res.json();
          setWorldContext(data);
          setContextLoaded(true);
        }
      } catch (error) {
        console.error('Failed to load world context:', error);
      }
    }

    loadContext();
  }, [workspaceId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !workspaceId) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          messages: [...messages, userMessage],
          includeContext: true
        })
      });

      if (!res.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await res.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: '申し訳ありません。エラーが発生しました。もう一度お試しください。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const quickActions = [
    {
      label: '矛盾を探す',
      prompt: 'このプロジェクトの世界設定で矛盾している点や整合性に問題がある箇所を見つけて教えてください。'
    },
    {
      label: '要約を作る',
      prompt: 'このプロジェクトの世界観全体を簡潔に要約してください。主要な設定、キャラクター、舞台、テーマを含めてください。'
    },
    {
      label: '関連を提案',
      prompt: 'まだ明示的に結びつけられていないエンティティ間の関連性や追加できる繋がりを提案してください。'
    },
    {
      label: 'ロア追加提案',
      prompt: '既存の設定をより深めるために追加できる歴史、文化、小ネタなどを提案してください。'
    },
    {
      label: 'タイムライン確認',
      prompt: '時系列に矛盾がないか確認してください。イベントの順序や日付に問題がある箇所を指摘してください。'
    },
    {
      label: '視点分析',
      prompt: '主要な陣営や登場人物それぞれの視点から、世界がどのように見えているか分析してください。'
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-bg">
      {/* Header */}
      <div className="border-b bg-panel/80 backdrop-blur-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">
                AI Assistant
              </h1>
              <p className="text-sm muted mt-0.5">
                Analyze project data and explore worldbuilding possibilities.
              </p>
            </div>
            {contextLoaded && (
              <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Context Active
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="space-y-8 max-w-3xl mx-auto">
          {messages.length === 0 && (
            <div className="py-12 text-center space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-ink">How can I help you today?</h2>
                <p className="text-sm muted max-w-sm mx-auto">
                  I have access to your entities, articles, and timeline events to provide context-aware assistance.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(action.prompt)}
                    className="p-4 text-left border border-border rounded-xl hover:border-accent hover:bg-accent/5 transition-all bg-panel group"
                  >
                    <div className="font-medium text-sm text-ink group-hover:text-accent transition-colors">{action.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-5 py-3.5 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-accent text-white shadow-md shadow-accent/10'
                    : 'bg-panel border border-border text-ink shadow-sm'
                }`}
              >
                <div className="prose dark:prose-invert prose-sm max-w-none text-ink leading-relaxed">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-2 last:mb-0">{line}</p>
                    ))
                  )}
                </div>
                <div className={`text-[10px] mt-2 font-medium uppercase tracking-wider ${msg.role === 'user' ? 'text-white/70' : 'text-muted'}`}>
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="bg-panel border border-border px-5 py-4 rounded-2xl shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-1.5 h-1.5 bg-accent/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-accent/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-panel/80 backdrop-blur-sm p-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-3 bg-bg border border-border rounded-2xl p-2 focus-within:border-accent transition-colors shadow-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your project..."
              className="flex-1 bg-transparent px-3 py-2.5 outline-none resize-none text-sm min-h-[44px] max-h-48"
              rows={1}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${target.scrollHeight}px`;
              }}
              disabled={isLoading || !contextLoaded}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !contextLoaded}
              className="p-2.5 bg-accent text-white rounded-xl hover:bg-accent-hover disabled:opacity-30 disabled:hover:bg-accent transition-all flex-shrink-0"
              aria-label="Send message"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] muted mt-3 text-center uppercase tracking-widest font-semibold">
            AI can make mistakes. Verify critical information.
          </p>
        </div>
      </div>
    </div>
  );
}


