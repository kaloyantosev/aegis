import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { Portfolio, PortfolioAsset } from '../types';

interface PortfolioEditorProps {
  portfolios: Portfolio[];
  onUpdatePortfolios: (portfolios: Portfolio[]) => void;
  availableTickers: string[];
}

export const PortfolioEditor: React.FC<PortfolioEditorProps> = ({
  portfolios,
  onUpdatePortfolios,
  availableTickers
}) => {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(portfolios[0]?.id || '');
  const [newTickerInput, setNewTickerInput] = useState<string>('');

  const activePortfolio = portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0];

  const handleWeightChange = (index: number, newWeight: number) => {
    if (!activePortfolio) return;
    const updatedAssets = [...activePortfolio.assets];
    updatedAssets[index] = { ...updatedAssets[index], weight: newWeight };
    
    updateActivePortfolioAssets(updatedAssets);
  };

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortfolio || !newTickerInput) return;
    
    const ticker = newTickerInput.trim().toUpperCase();
    if (activePortfolio.assets.some(a => a.ticker === ticker)) {
      alert('Asset ticker already exists in this portfolio.');
      return;
    }

    // Allocate remaining weight if possible, otherwise default to 0
    const currentSum = activePortfolio.assets.reduce((sum, a) => sum + a.weight, 0);
    const defaultWeight = Math.max(0, 100 - currentSum);

    const updatedAssets = [...activePortfolio.assets, { ticker, weight: defaultWeight }];
    updateActivePortfolioAssets(updatedAssets);
    setNewTickerInput('');
  };

  const handleRemoveAsset = (index: number) => {
    if (!activePortfolio) return;
    const updatedAssets = activePortfolio.assets.filter((_, i) => i !== index);
    updateActivePortfolioAssets(updatedAssets);
  };

  const updateActivePortfolioAssets = (assets: PortfolioAsset[]) => {
    const updatedPortfolios = portfolios.map(p => {
      if (p.id === activePortfolio.id) {
        return { ...p, assets };
      }
      return p;
    });
    onUpdatePortfolios(updatedPortfolios);
  };

  const handleLoadPreset = (presetName: string) => {
    if (!activePortfolio) return;
    let presetAssets: PortfolioAsset[] = [];

    switch (presetName) {
      case 'aggressive-spy':
        presetAssets = [{ ticker: 'SPY', weight: 100 }];
        break;
      case 'nasdaq-heavy':
        presetAssets = [{ ticker: 'QQQ', weight: 80 }, { ticker: 'SPY', weight: 20 }];
        break;
      case 'balanced-60-40':
        presetAssets = [{ ticker: 'SPY', weight: 60 }, { ticker: 'TLT', weight: 40 }];
        break;
      case 'all-weather':
        presetAssets = [
          { ticker: 'SPY', weight: 30 },
          { ticker: 'TLT', weight: 40 },
          { ticker: 'GLD', weight: 20 },
          { ticker: 'QQQ', weight: 10 }
        ];
        break;
      case 'cash-defense':
        presetAssets = [{ ticker: 'BIL', weight: 100 }];
        break;
      case 'defensive-mix':
        presetAssets = [{ ticker: 'BIL', weight: 70 }, { ticker: 'TLT', weight: 30 }];
        break;
      default:
        return;
    }

    const updatedPortfolios = portfolios.map(p => {
      if (p.id === activePortfolio.id) {
        return { 
          ...p, 
          assets: presetAssets 
        };
      }
      return p;
    });
    onUpdatePortfolios(updatedPortfolios);
  };

  const handleAutoRebalance = () => {
    if (!activePortfolio || activePortfolio.assets.length === 0) return;
    const count = activePortfolio.assets.length;
    const baseWeight = Math.floor(100 / count);
    const remainder = 100 % count;
    
    const rebalancedAssets = activePortfolio.assets.map((asset, i) => ({
      ...asset,
      weight: baseWeight + (i < remainder ? 1 : 0)
    }));
    
    updateActivePortfolioAssets(rebalancedAssets);
  };

  if (!activePortfolio) return null;

  const totalAllocated = activePortfolio.assets.reduce((sum, a) => sum + a.weight, 0);
  const isAllocationValid = totalAllocated === 100;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Preset Portfolios</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Configure asset allocations for your active strategy portfolios.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {portfolios.map(p => (
          <button
            key={p.id}
            onClick={() => setSelectedPortfolioId(p.id)}
            className={`btn ${selectedPortfolioId === p.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h4 style={{ fontSize: '15px' }}>{activePortfolio.name} Asset Weights</h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{activePortfolio.description}</span>
          </div>
          
          <button 
            onClick={handleAutoRebalance}
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Distribute weights equally"
          >
            <RefreshCw size={12} />
            Equal Weight
          </button>
        </div>

        {activePortfolio.assets.length === 0 ? (
          <div style={{ padding: '24px 0', color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center' }}>
            No assets added yet. Add a ticker below or choose a template preset.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
            {activePortfolio.assets.map((asset, index) => (
              <div key={asset.ticker} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '50px', fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>
                  {asset.ticker}
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={asset.weight}
                  onChange={(e) => handleWeightChange(index, parseInt(e.target.value) || 0)}
                  style={{ flex: 1 }}
                />
                
                <div style={{ width: '40px', textAlign: 'right', fontSize: '13px', fontWeight: '500' }}>
                  {asset.weight}%
                </div>
                
                <button
                  onClick={() => handleRemoveAsset(index)}
                  className="btn btn-danger"
                  style={{ padding: '6px', borderRadius: '6px' }}
                  title="Remove asset"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add Asset (e.g. SPY, GLD)"
            value={newTickerInput}
            onChange={(e) => setNewTickerInput(e.target.value)}
            style={{ flex: 1, padding: '8px 12px' }}
            list="suggested-tickers"
          />
          <datalist id="suggested-tickers">
            {availableTickers.map(t => (
              <option key={t} value={t} />
            ))}
          </datalist>
          
          <button type="submit" className="btn btn-secondary" style={{ padding: '8px 12px' }}>
            <Plus size={16} />
            Add
          </button>
        </form>
      </div>

      {/* Preset template loaders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ margin: 0 }}>Apply Allocation Preset:</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          <button onClick={() => handleLoadPreset('aggressive-spy')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            100% S&P 500
          </button>
          <button onClick={() => handleLoadPreset('nasdaq-heavy')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            Nasdaq Heavy
          </button>
          <button onClick={() => handleLoadPreset('balanced-60-40')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            Classic 60/40
          </button>
          <button onClick={() => handleLoadPreset('all-weather')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            All-Weather
          </button>
          <button onClick={() => handleLoadPreset('cash-defense')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            100% Cash/BIL
          </button>
          <button onClick={() => handleLoadPreset('defensive-mix')} className="btn btn-secondary" style={{ padding: '6px', fontSize: '11px' }}>
            Cash & Bonds
          </button>
        </div>
      </div>

      {/* Allocation Validator Status */}
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '10px 12px', 
          borderRadius: '8px', 
          fontSize: '12px',
          fontWeight: '500',
          background: isAllocationValid ? 'var(--success-bg)' : 'var(--danger-bg)',
          border: `1px solid ${isAllocationValid ? 'var(--success-border)' : 'var(--danger-border)'}`,
          color: isAllocationValid ? '#a7f3d0' : '#fecdd3'
        }}
      >
        {isAllocationValid ? (
          <>
            <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            <span>Allocation Valid: Exactly 100% allocated.</span>
          </>
        ) : (
          <>
            <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
            <span>
              Allocation Warning: Currently <strong>{totalAllocated}%</strong>. Must equal 100%.
            </span>
          </>
        )}
      </div>
    </div>
  );
};
