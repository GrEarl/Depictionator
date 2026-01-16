"use client";

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface PerspectiveInfo {
  id: string;
  name: string;
  type: 'character' | 'faction' | 'organization' | 'nation';
  color: string;
}

interface EntityPerspectiveView {
  entityId: string;
  entityTitle: string;
  entityType: string;
  perspectives: Array<{
    perspectiveId: string;
    perspectiveName: string;
    knowledgeLevel: 'full' | 'partial' | 'minimal' | 'false' | 'unknown';
    beliefs: Array<{
      statement: string;
      isTrue: boolean;
      reliability: 'confirmed' | 'rumor' | 'propaganda' | 'misunderstanding';
      notes?: string;
    }>;
    relationships: Array<{
      relationshipType: string;
      description: string;
      sentiment: 'positive' | 'neutral' | 'negative';
    }>;
    motivations: string[];
    hiddenFrom: string[]; // What this perspective doesn't know
  }>;
}

interface Props {
  entityId?: string;
  perspectiveId?: string;
}

export default function PerspectiveAnalysisPanel({ entityId, perspectiveId }: Props) {
  const { workspaceId } = useWorkspace();

  const [perspectives, setPerspectives] = useState<PerspectiveInfo[]>([]);
  const [selectedPerspective, setSelectedPerspective] = useState<string>(perspectiveId || '');
  const [selectedEntity, setSelectedEntity] = useState<string>(entityId || '');
  const [analysis, setAnalysis] = useState<EntityPerspectiveView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [entities, setEntities] = useState<Array<{ id: string; title: string; type: string }>>([]);

  // Load perspectives
  useEffect(() => {
    if (!workspaceId) return;

    async function loadPerspectives() {
      const res = await fetch(`/api/perspectives?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setPerspectives(data);
      }
    }

    loadPerspectives();
  }, [workspaceId]);

  // Load entities
  useEffect(() => {
    if (!workspaceId) return;

    async function loadEntities() {
      const res = await fetch(`/api/entities?workspaceId=${workspaceId}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    }

    loadEntities();
  }, [workspaceId]);

  // Analyze perspective
  const analyzePerspective = async () => {
    if (!selectedPerspective || !selectedEntity || !workspaceId) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/perspective-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          perspectiveId: selectedPerspective,
          entityId: selectedEntity
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const compareAllPerspectives = async () => {
    if (!selectedEntity || !workspaceId) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/perspective-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          entityId: selectedEntity,
          perspectiveIds: perspectives.map(p => p.id)
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            🎭 視点分析
          </h2>
          <p className="text-sm muted mt-1">
            陣営・キャラクターごとに異なる認識や情報差を可視化
          </p>
        </div>
      </div>

      {/* Selection Panel */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">対象エンティティ</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800"
          >
            <option value="">-- エンティティを選択 --</option>
            {entities.map(entity => (
              <option key={entity.id} value={entity.id}>
                [{entity.type}] {entity.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">視点（陣営/キャラクター）</label>
          <select
            value={selectedPerspective}
            onChange={(e) => setSelectedPerspective(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800"
          >
            <option value="">-- 視点を選択 --</option>
            {perspectives.map(perspective => (
              <option key={perspective.id} value={perspective.id}>
                [{perspective.type}] {perspective.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={analyzePerspective}
          disabled={!selectedEntity || !selectedPerspective || isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? '分析中...' : '視点分析を実行'}
          {!isLoading && '🔍'}
        </button>

        <button
          onClick={compareAllPerspectives}
          disabled={!selectedEntity || isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? '比較中...' : '全視点を比較'}
          {!isLoading && '📊'}
        </button>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg border">
            <h3 className="text-xl font-bold mb-2">
              {analysis.entityTitle}
            </h3>
            <p className="text-sm muted">
              エンティティタイプ: {analysis.entityType}
            </p>
          </div>

          {/* Perspective Cards */}
          <div className="space-y-4">
            {analysis.perspectives.map((pov, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-6 bg-white dark:bg-slate-800 shadow-sm"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{
                        backgroundColor: perspectives.find(p => p.id === pov.perspectiveId)?.color || '#999'
                      }}
                    ></span>
                    {pov.perspectiveName}
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    pov.knowledgeLevel === 'full' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                    pov.knowledgeLevel === 'partial' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                    pov.knowledgeLevel === 'minimal' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' :
                    pov.knowledgeLevel === 'false' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
                  }`}>
                    {pov.knowledgeLevel}
                  </span>
                </div>

                {/* Beliefs */}
                {pov.beliefs.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                      💭 認識・信念
                    </h5>
                    <div className="space-y-2">
                      {pov.beliefs.map((belief, bIdx) => (
                        <div
                          key={bIdx}
                          className={`p-3 rounded border-l-4 ${
                            belief.isTrue
                              ? 'bg-green-50 border-green-500 dark:bg-green-900/20'
                              : 'bg-red-50 border-red-500 dark:bg-red-900/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="flex-1">{belief.statement}</p>
                            <span className={`text-xs px-2 py-1 rounded ${
                              belief.reliability === 'confirmed' ? 'bg-green-200 dark:bg-green-800' :
                              belief.reliability === 'rumor' ? 'bg-yellow-200 dark:bg-yellow-800' :
                              belief.reliability === 'propaganda' ? 'bg-orange-200 dark:bg-orange-800' :
                              'bg-red-200 dark:bg-red-800'
                            }`}>
                              {belief.reliability}
                            </span>
                          </div>
                          {belief.notes && (
                            <p className="text-sm muted mt-2">{belief.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivations */}
                {pov.motivations.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                      🎯 動機・目的
                    </h5>
                    <ul className="list-disc list-inside space-y-1">
                      {pov.motivations.map((motivation, mIdx) => (
                        <li key={mIdx}>{motivation}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Relationships */}
                {pov.relationships.length > 0 && (
                  <div className="mb-4">
                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                      🔗 関係性
                    </h5>
                    <div className="space-y-2">
                      {pov.relationships.map((rel, rIdx) => (
                        <div key={rIdx} className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900 rounded">
                          <span className={`w-2 h-2 rounded-full ${
                            rel.sentiment === 'positive' ? 'bg-green-500' :
                            rel.sentiment === 'negative' ? 'bg-red-500' :
                            'bg-gray-500'
                          }`}></span>
                          <span className="font-medium text-sm">{rel.relationshipType}:</span>
                          <span className="flex-1">{rel.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hidden Information */}
                {pov.hiddenFrom.length > 0 && (
                  <div>
                    <h5 className="font-semibold mb-2 flex items-center gap-2">
                      🚫 知らない情報
                    </h5>
                    <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {pov.hiddenFrom.map((hidden, hIdx) => (
                          <li key={hIdx} className="opacity-70">{hidden}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
