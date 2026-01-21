"use client";

import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from "@/components/ui/Button";

interface PerspectiveInfo {
  id: string;
  name: string;
  type: 'player' | 'faction' | 'character' | 'omniscient';
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
  const fallbackColor = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 55%)`;
  };

  // Load perspectives
  useEffect(() => {
    if (!workspaceId) return;

    async function loadPerspectives() {
      const res = await fetch(`/api/perspectives?workspaceId=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setPerspectives(Array.isArray(data) ? data : []);
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
        setEntities(Array.isArray(data) ? data : []);
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
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-ink">
          Perspective Analysis
        </h2>
        <p className="text-sm muted mt-1 uppercase tracking-wider font-semibold">
          Analyze conflicting beliefs and information gaps
        </p>
      </div>

      {/* Selection Panel */}
      <div className="grid md:grid-cols-2 gap-6 bg-panel p-6 rounded-xl border border-border">
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Target Entity</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">-- Select Entity --</option>
            {entities.map(entity => (
              <option key={entity.id} value={entity.id}>
                [{entity.type.toUpperCase()}] {entity.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted">Viewpoint Source</label>
          <select
            value={selectedPerspective}
            onChange={(e) => setSelectedPerspective(e.target.value)}
            className="w-full px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">-- Select Viewpoint --</option>
            {perspectives.map(perspective => (
              <option key={perspective.id} value={perspective.id}>
                [{perspective.type.toUpperCase()}] {perspective.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={analyzePerspective}
          disabled={!selectedEntity || !selectedPerspective || isLoading}
          className="flex-1 gap-2"
        >
          {isLoading ? 'Analyzing...' : 'Run Perspective Analysis'}
        </Button>

        <Button
          onClick={compareAllPerspectives}
          disabled={!selectedEntity || isLoading}
          variant="secondary"
          className="flex-1 gap-2"
        >
          {isLoading ? 'Comparing...' : 'Compare All Perspectives'}
        </Button>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-accent/5 p-8 rounded-xl border border-accent/20">
            <h3 className="text-2xl font-bold text-ink mb-1">
              {analysis.entityTitle}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent">
              Type: {analysis.entityType}
            </p>
          </div>

          {/* Perspective Cards */}
          <div className="space-y-6">
            {analysis.perspectives.map((pov, idx) => (
              <div
                key={idx}
                className="border border-border rounded-xl p-8 bg-panel shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-8 border-b border-border pb-4">
                  <h4 className="text-xl font-bold text-ink flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: perspectives.find(p => p.id === pov.perspectiveId)?.color || fallbackColor(pov.perspectiveId)
                      }}
                    ></span>
                    {pov.perspectiveName}
                  </h4>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    pov.knowledgeLevel === 'full' ? 'bg-emerald-100 text-emerald-800' :
                    pov.knowledgeLevel === 'partial' ? 'bg-amber-100 text-amber-800' :
                    pov.knowledgeLevel === 'minimal' ? 'bg-orange-100 text-orange-800' :
                    pov.knowledgeLevel === 'false' ? 'bg-red-100 text-red-800' :
                    'bg-bg text-muted border border-border'
                  }`}>
                    {pov.knowledgeLevel} Knowledge
                  </span>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Beliefs */}
                  {pov.beliefs.length > 0 && (
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted">Perceptions & Beliefs</h5>
                      <div className="space-y-3">
                        {pov.beliefs.map((belief, bIdx) => (
                          <div
                            key={bIdx}
                            className={`p-4 rounded-lg border-l-4 shadow-sm bg-bg/50 ${
                              belief.isTrue
                                ? 'border-emerald-500'
                                : 'border-red-500'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm font-medium leading-relaxed text-ink">{belief.statement}</p>
                              <span className={`text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border ${
                                belief.reliability === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                belief.reliability === 'rumor' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {belief.reliability}
                              </span>
                            </div>
                            {belief.notes && (
                              <p className="text-xs muted mt-3 italic leading-relaxed opacity-80">{belief.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-8">
                    {/* Motivations */}
                    {pov.motivations.length > 0 && (
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted">Motivations & Objectives</h5>
                        <ul className="space-y-2">
                          {pov.motivations.map((motivation, mIdx) => (
                            <li key={mIdx} className="text-sm text-ink flex items-start gap-2">
                              <span className="text-accent mt-1">•</span>
                              {motivation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Relationships */}
                    {pov.relationships.length > 0 && (
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted">Inter-entity Dynamics</h5>
                        <div className="space-y-2">
                          {pov.relationships.map((rel, rIdx) => (
                            <div key={rIdx} className="flex items-center gap-3 p-3 bg-bg rounded-lg border border-border/50">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                rel.sentiment === 'positive' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                rel.sentiment === 'negative' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                'bg-muted opacity-40'
                              }`}></span>
                              <span className="font-bold text-[10px] uppercase text-muted tracking-tight w-24 shrink-0">{rel.relationshipType}</span>
                              <span className="text-sm text-ink">{rel.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Hidden Information */}
                    {pov.hiddenFrom.length > 0 && (
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted">Information Gaps</h5>
                        <div className="bg-bg/80 p-4 rounded-lg border border-dashed border-border">
                          <ul className="space-y-2">
                            {pov.hiddenFrom.map((hidden, hIdx) => (
                              <li key={hIdx} className="text-sm text-muted italic flex items-start gap-2">
                                <span className="opacity-40 mt-1">?</span>
                                {hidden}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
