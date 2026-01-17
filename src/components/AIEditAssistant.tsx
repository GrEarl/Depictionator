"use client";

import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from "@/components/ui/Button";

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
      <div className="p-5 border-b bg-panel">
        <h3 className="text-base font-bold text-ink tracking-tight">
          AI Edit Assistant
        </h3>
        <p className="text-xs muted mt-1 uppercase tracking-wider font-semibold">
          Analysis & Suggestions
        </p>
      </div>

      {/* Action Buttons */}
      <div className="p-5 space-y-3 border-b bg-bg/30">
        <Button
          onClick={analyzeContent}
          disabled={isAnalyzing || !currentContent.trim()}
          className="w-full justify-start gap-3"
          variant="primary"
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Writing'}
        </Button>

        <Button
          onClick={checkConsistency}
          disabled={isAnalyzing}
          className="w-full justify-start gap-3"
          variant="secondary"
        >
          {isAnalyzing ? 'Checking...' : 'Check Consistency'}
        </Button>

        <Button
          onClick={suggestKnowledge}
          disabled={isAnalyzing}
          className="w-full justify-start gap-3"
          variant="outline"
        >
          {isAnalyzing ? 'Generating...' : 'Suggest Lore'}
        </Button>
      </div>

      {/* Filter */}
      {suggestions.length > 0 && (
        <div className="p-4 border-b bg-panel">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3 text-muted">Filter Suggestions</p>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'grammar', 'missing', 'inconsistency', 'detail', 'organization'].map(type => (
              <button
                key={type}
                onClick={() => setSelectedTypes(prev =>
                  prev.includes(type) ? prev.filter(t => t !== type) : [...prev.filter(t => t !== 'all'), type]
                )}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
                  selectedTypes.includes(type)
                    ? 'bg-accent text-white border-accent shadow-sm shadow-accent/20'
                    : 'bg-panel border-border text-muted hover:border-accent hover:text-accent'
                }`}
              >
                {type === 'all' ? 'All' :
                 type === 'grammar' ? 'Grammar' :
                 type === 'missing' ? 'Missing Info' :
                 type === 'inconsistency' ? 'Inconsistency' :
                 type === 'detail' ? 'Detail' : 'Structure'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-bg/10">
        {filteredSuggestions.length === 0 && (
          <div className="text-center py-12 text-sm">
            {isAnalyzing ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="muted font-medium">AI is analyzing your content...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-ink font-semibold">No suggestions yet</p>
                <p className="text-xs muted max-w-[200px] mx-auto">Run an analysis above to get AI-powered feedback on your writing.</p>
              </div>
            )}
          </div>
        )}

        {filteredSuggestions.map((suggestion, idx) => (
          <div
            key={idx}
            className={`p-4 border rounded-xl shadow-sm transition-all hover:shadow-md bg-panel ${
              suggestion.severity === 'high' ? 'border-red-200 dark:border-red-900/50' :
              suggestion.severity === 'medium' ? 'border-yellow-200 dark:border-yellow-900/50' :
              'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h4 className="font-bold text-sm text-ink leading-snug">{suggestion.title}</h4>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                suggestion.severity === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' :
                suggestion.severity === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400' :
                'bg-bg text-muted'
              }`}>
                {suggestion.severity === 'high' ? 'High' : suggestion.severity === 'medium' ? 'Med' : 'Low'}
              </span>
            </div>

            {suggestion.currentText && (
              <div className="mb-3 p-3 bg-bg/50 rounded-lg border border-border/50 text-xs">
                <p className="text-[10px] font-bold uppercase text-muted mb-1.5 opacity-60">Current</p>
                <p className="text-ink line-through opacity-60 italic">{suggestion.currentText}</p>
              </div>
            )}

            <div className="mb-3 p-3 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">Suggested</p>
              <p className="text-sm font-medium text-ink">{suggestion.suggestedChange}</p>
            </div>

            <p className="text-xs muted leading-relaxed mb-4">{suggestion.reasoning}</p>

            {onApplySuggestion && (
              <Button
                onClick={() => onApplySuggestion(suggestion)}
                className="w-full text-xs h-8"
                variant="outline"
              >
                Apply Change
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Summary */}
      {suggestions.length > 0 && (
        <div className="p-5 border-t bg-panel">
          <div className="text-[10px] space-y-2">
            <p className="font-bold uppercase tracking-widest text-muted">Summary</p>
            <div className="flex items-center justify-between font-bold text-ink border-b border-border pb-1 mb-2">
               <span>Total Suggestions</span>
               <span>{suggestions.length}</span>
            </div>
            <div className="flex gap-4 font-bold">
              <span className="text-red-600 dark:text-red-400">High: {suggestions.filter(s => s.severity === 'high').length}</span>
              <span className="text-yellow-600 dark:text-yellow-400">Med: {suggestions.filter(s => s.severity === 'medium').length}</span>
              <span className="text-muted">Low: {suggestions.filter(s => s.severity === 'low').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
