"use client";

import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface EditSuggestion {
  type: 'grammar' | 'missing' | 'inconsistency' | 'detail' | 'organization';
  severity: 'high' | 'medium' | 'low';
  title: string;
  currentText?: string;
  suggestedChange: string;
  reasoning: string;
  lineNumber?: number;
}

interface Props {
  articleId?: string;
  entityId?: string;
  currentContent: string;
  onApplySuggestion?: (suggestion: EditSuggestion) => void;
}

export default function AIEditAssistant({ articleId, entityId, currentContent, onApplySuggestion }: Props) {
  const { workspaceId } = useWorkspace();
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);

  const analyzeContent = async () => {
    if (!workspaceId || !currentContent.trim()) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/edit-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          articleId,
          entityId,
          content: currentContent
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const checkConsistency = async () => {
    if (!workspaceId) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/consistency-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          scope: 'focused',
          focusArticleId: articleId
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Convert consistency issues to edit suggestions
        const issuesAsSuggestions: EditSuggestion[] = (data.issues || []).map((issue: any) => ({
          type: 'inconsistency',
          severity: issue.severity === 'critical' ? 'high' : issue.severity === 'warning' ? 'medium' : 'low',
          title: issue.title,
          currentText: issue.evidence?.[0]?.quote,
          suggestedChange: issue.suggestion,
          reasoning: issue.description
        }));
        setSuggestions(prev => [...prev, ...issuesAsSuggestions]);
      }
    } catch (error) {
      console.error('Consistency check failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const suggestKnowledge = async () => {
    if (!workspaceId) return;

    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/knowledge-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          focusArticleId: articleId,
          focusEntityId: entityId
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Convert knowledge suggestions to edit suggestions
        const knowledgeAsSuggestions: EditSuggestion[] = (data.suggestions || [])
          .filter((s: any) => s.priority === 'high' || s.priority === 'medium')
          .map((s: any) => ({
            type: 'detail',
            severity: s.priority === 'high' ? 'high' : 'medium',
            title: s.title,
            suggestedChange: s.suggestedContent,
            reasoning: s.reasoning
          }));
        setSuggestions(prev => [...prev, ...knowledgeAsSuggestions]);
      }
    } catch (error) {
      console.error('Knowledge suggestions failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredSuggestions = selectedTypes.includes('all')
    ? suggestions
    : suggestions.filter(s => selectedTypes.includes(s.type));

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="text-lg font-bold flex items-center gap-2">
          ✨ AI編集アシスタント
        </h3>
        <p className="text-xs muted mt-1">
          AIが編集内容を分析・提案します
        </p>
      </div>

      {/* Action Buttons */}
      <div className="p-4 space-y-2 border-b">
        <button
          onClick={analyzeContent}
          disabled={isAnalyzing || !currentContent.trim()}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {isAnalyzing ? '分析中...' : '📝 文章を分析'}
        </button>

        <button
          onClick={checkConsistency}
          disabled={isAnalyzing}
          className="w-full px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
        >
          {isAnalyzing ? '確認中...' : '🔍 矛盾をチェック'}
        </button>

        <button
          onClick={suggestKnowledge}
          disabled={isAnalyzing}
          className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {isAnalyzing ? '生成中...' : '💡 ロア追加案'}
        </button>
      </div>

      {/* Filter */}
      {suggestions.length > 0 && (
        <div className="p-4 border-b">
          <p className="text-xs font-semibold mb-2 muted">フィルター</p>
          <div className="flex flex-wrap gap-2">
            {['all', 'grammar', 'missing', 'inconsistency', 'detail', 'organization'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedTypes(prev =>
                  prev.includes(type) ? prev.filter(t => t !== type) : [...prev.filter(t => t !== 'all'), type]
                )}
                className={`px-2 py-1 text-xs rounded ${
                  selectedTypes.includes(type)
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {type === 'all' ? 'すべて' :
                 type === 'grammar' ? '文法' :
                 type === 'missing' ? '不足情報' :
                 type === 'inconsistency' ? '矛盾' :
                 type === 'detail' ? '詳細' : '構成'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredSuggestions.length === 0 && (
          <div className="text-center py-8 text-sm muted">
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p>AIが分析中...</p>
              </div>
            ) : (
              <div>
                <p>提案がありません</p>
                <p className="mt-2">上のボタンで分析を開始してください</p>
              </div>
            )}
          </div>
        )}

        {filteredSuggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className={`p-3 border rounded-lg ${
              suggestion.severity === 'high' ? 'border-red-300 bg-red-50 dark:bg-red-900/20' :
              suggestion.severity === 'medium' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20' :
              'border-slate-300 bg-slate-50 dark:bg-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-semibold text-sm flex-1">{suggestion.title}</h4>
              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                suggestion.severity === 'high' ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100' :
                suggestion.severity === 'medium' ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100' :
                'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
              }`}>
                {suggestion.severity === 'high' ? '高' : suggestion.severity === 'medium' ? '中' : '低'}
              </span>
            </div>

            {suggestion.currentText && (
              <div className="mb-2 p-2 bg-white dark:bg-slate-900 rounded border text-sm">
                <p className="text-xs font-semibold muted mb-1">現在:</p>
                <p className="text-sm">{suggestion.currentText}</p>
              </div>
            )}

            <div className="mb-2 p-2 bg-white dark:bg-slate-900 rounded border">
              <p className="text-xs font-semibold muted mb-1">提案:</p>
              <p className="text-sm">{suggestion.suggestedChange}</p>
            </div>

            <p className="text-xs muted mb-3">{suggestion.reasoning}</p>

            {onApplySuggestion && (
              <button
                onClick={() => onApplySuggestion(suggestion)}
                className="w-full px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs font-medium"
              >
                この提案を適用
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {suggestions.length > 0 && (
        <div className="p-4 border-t bg-slate-50 dark:bg-slate-800">
          <div className="text-xs space-y-1">
            <p className="font-semibold">提案サマリー:</p>
            <p>合計: {suggestions.length}件</p>
            <div className="flex gap-4">
              <span className="text-red-600 dark:text-red-400">高: {suggestions.filter(s => s.severity === 'high').length}</span>
              <span className="text-yellow-600 dark:text-yellow-400">中: {suggestions.filter(s => s.severity === 'medium').length}</span>
              <span className="text-slate-600 dark:text-slate-400">低: {suggestions.filter(s => s.severity === 'low').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
