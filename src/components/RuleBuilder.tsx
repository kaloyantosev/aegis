import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Info } from 'lucide-react';
import type { Rule, Portfolio, RuleIndicator } from '../types';

interface RuleBuilderProps {
  rules: Rule[];
  portfolios: Portfolio[];
  defaultPortfolioId: string;
  onUpdateRules: (rules: Rule[]) => void;
  onUpdateDefaultPortfolio: (id: string) => void;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  rules,
  portfolios,
  defaultPortfolioId,
  onUpdateRules,
  onUpdateDefaultPortfolio
}) => {
  
  const handleAddRule = () => {
    if (portfolios.length === 0) return;
    
    const newRule: Rule = {
      id: Math.random().toString(36).substr(2, 9),
      indicator: 'SMA',
      period: 200,
      operator: 'above',
      targetPortfolioId: portfolios[0].id
    };
    
    onUpdateRules([...rules, newRule]);
  };

  const handleRemoveRule = (id: string) => {
    onUpdateRules(rules.filter(r => r.id !== id));
  };

  const handleUpdateRuleField = (id: string, field: keyof Rule, value: any) => {
    const updatedRules = rules.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    onUpdateRules(updatedRules);
  };

  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rules.length - 1) return;

    const newRules = [...rules];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newRules[index];
    newRules[index] = newRules[targetIndex];
    newRules[targetIndex] = temp;

    onUpdateRules(newRules);
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Rotation Rules</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Rules are evaluated in order from top to bottom. The first matching rule decides the active portfolio.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rules.map((rule, index) => (
          <div 
            key={rule.id} 
            className="animate-fade-in"
            style={{ 
              background: 'rgba(30, 41, 59, 0.4)', 
              borderRadius: '10px', 
              padding: '12px', 
              border: '1px solid var(--border-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Rule #{index + 1} Priority
              </span>
              
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => handleMoveRule(index, 'up')}
                  disabled={index === 0}
                  className="btn btn-secondary"
                  style={{ padding: '4px 6px', opacity: index === 0 ? 0.3 : 1 }}
                  title="Move Up"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => handleMoveRule(index, 'down')}
                  disabled={index === rules.length - 1}
                  className="btn btn-secondary"
                  style={{ padding: '4px 6px', opacity: index === rules.length - 1 ? 0.3 : 1 }}
                  title="Move Down"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  onClick={() => handleRemoveRule(rule.id)}
                  className="btn btn-danger"
                  style={{ padding: '4px 6px', marginLeft: '6px' }}
                  title="Delete Rule"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <label>Benchmark Indicator</label>
                <select
                  value={rule.indicator}
                  onChange={(e) => handleUpdateRuleField(rule.id, 'indicator', e.target.value as RuleIndicator)}
                  style={{ width: '100%' }}
                >
                  <option value="SMA">SMA (Simple Moving Avg)</option>
                  <option value="EMA">EMA (Exponential Moving Avg)</option>
                  <option value="Momentum">Price Momentum (%)</option>
                </select>
              </div>

              {rule.indicator !== 'Price' && (
                <div>
                  <label>Period (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={rule.period}
                    onChange={(e) => handleUpdateRuleField(rule.id, 'period', parseInt(e.target.value) || 200)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              <div>
                <label>S&P 500 Price is</label>
                <select
                  value={rule.operator}
                  onChange={(e) => handleUpdateRuleField(rule.id, 'operator', e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="above">Above Indicator</option>
                  <option value="below">Below Indicator</option>
                </select>
              </div>

              <div>
                <label>Rotate To Portfolio</label>
                <select
                  value={rule.targetPortfolioId}
                  onChange={(e) => handleUpdateRuleField(rule.id, 'targetPortfolioId', e.target.value)}
                  style={{ width: '100%' }}
                >
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ))}

        {rules.length === 0 && (
          <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>
            No active conditions defined. Will default to fallback portfolio.
          </div>
        )}

        <button 
          onClick={handleAddRule} 
          className="btn btn-secondary" 
          style={{ width: '100%', borderStyle: 'dashed', borderWidth: '1.5px', justifyContent: 'center' }}
        >
          <Plus size={16} />
          Add Condition Rule
        </button>
      </div>

      {/* Fallback rule setup */}
      <div 
        style={{ 
          background: 'rgba(99, 102, 241, 0.05)', 
          borderRadius: '10px', 
          padding: '14px', 
          border: '1px solid rgba(99, 102, 241, 0.1)',
          marginTop: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
          <Info size={16} style={{ color: 'var(--primary)', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Otherwise / Fallback rule:</strong> If none of the conditions above evaluate to true, select the default portfolio below.
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Fallback Portfolio</label>
          <select
            value={defaultPortfolioId}
            onChange={(e) => onUpdateDefaultPortfolio(e.target.value)}
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)' }}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
