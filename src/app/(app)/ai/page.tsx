"use client";

import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useRouter } from 'next/navigation';

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

export default function AIAssistantPage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

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
    { label: '矛盾を探す', prompt: 'このプロジェクトの世界設定で矛盾している点や、整合性に問題がある箇所を見つけて教えてください。' },
    { label: '要約を作成', prompt: 'このプロジェクトの世界観全体を簡潔に要約してください。主要な設定、キャラクター、舞台、テーマを含めてください。' },
    { label: '関連を提案', prompt: 'まだ明示的に結びつけられていないエンティティ間の関連性や、追加できる繋がりを提案してください。' },
    { label: 'ロア追加案', prompt: '既存の設定をより深めるための、追加できる歴史、文化、小ネタなどを提案してください。' },
    { label: 'タイムライン確認', prompt: '時系列に矛盾がないか確認してください。イベントの順序や日付に問題がある箇所を指摘してください。' },
    { label: '視点分析', prompt: '主要な陣営や登場人物それぞれの視点から、世界がどう見えているか分析してください。' }
  ];

  if (!workspaceId) {
    return (
      <div className="p-8 text-center">
        <p className="muted">ワークスペースを選択してください</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🤖 AI アシスタント
              </h1>
              <p className="text-sm muted mt-1">
                プロジェクト全体について質問したり、分析を依頼できます
              </p>
            </div>
            {contextLoaded && (
              <div className="text-xs muted bg-green-100 dark:bg-green-900 px-3 py-2 rounded">
                ✅ プロジェクトデータ読み込み済み
                <div className="mt-1">
                  {worldContext && (
                    <>
                      {worldContext.entities.length} entities ·
                      {worldContext.articles.length} articles ·
                      {worldContext.events.length} events
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {messages.length === 0 && (
        <div className="container mx-auto px-4 py-6">
          <h3 className="text-sm font-semibold mb-3 muted">よくある質問</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => setInput(action.prompt)}
                className="p-4 text-left border rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors bg-white dark:bg-slate-800"
              >
                <div className="font-medium text-sm">{action.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto container mx-auto px-4 py-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white flex-shrink-0">
                  🤖
                </div>
              )}
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-slate-800 border'
                }`}
              >
                <div className="prose dark:prose-invert max-w-none">
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 last:mb-0">
                      {line}
                    </p>
                  ))}
                </div>
                <div className="text-xs mt-2 opacity-60">
                  {msg.timestamp.toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center text-white flex-shrink-0">
                  👤
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white">
                🤖
              </div>
              <div className="bg-white dark:bg-slate-800 border px-4 py-3 rounded-lg">
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="max-w-4xl mx-auto flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="プロジェクトについて質問してください... (Shift+Enterで改行)"
              className="flex-1 px-4 py-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-slate-800"
              rows={3}
              disabled={isLoading || !contextLoaded}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim() || !contextLoaded}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              {isLoading ? '送信中...' : '送信'}
              {!isLoading && '✨'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
