import React, { useState } from 'react';
import { ArrowRight, Search, Info } from 'lucide-react';
import type { Trade } from '../types';

interface TradeLogTableProps {
  trades: Trade[];
}

export const TradeLogTable: React.FC<TradeLogTableProps> = ({ trades }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const getPortfolioBadgeClass = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('aggressive') || lowerName.includes('stocks') || lowerName.includes('risk-on')) {
      return 'badge-success';
    } else if (lowerName.includes('conservative') || lowerName.includes('defensive') || lowerName.includes('cash') || lowerName.includes('risk-off')) {
      return 'badge-danger';
    }
    return 'badge-warning';
  };

  const filteredTrades = trades.filter(trade => {
    const fromName = trade.fromPortfolio?.name || 'Initial';
    const toName = trade.toPortfolio.name;
    const reason = trade.reason;
    const date = trade.date;
    
    return (
      fromName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      toName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      date.includes(searchTerm)
    );
  });

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', marginBottom: '4px' }}>Rotation Transactions Log</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            List of all historical rotations executed by the signal conditions.
          </p>
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search 
            size={16} 
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
          />
          <input
            type="text"
            placeholder="Filter by portfolio or rule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '36px' }}
          />
        </div>
      </div>

      {filteredTrades.length === 0 ? (
        <div style={{ padding: '36px 0', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
          No rotation transactions recorded for this period. Try extending the date range or adjusting rules.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Rotation Details</th>
                <th>Triggers</th>
                <th>Portfolio Capital</th>
                <th>Transaction Fees</th>
                <th>Holding Period Return</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade, idx) => (
                <tr key={`${trade.date}-${idx}`} className="animate-fade-in">
                  <td style={{ fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {trade.date}
                  </td>
                  
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {trade.fromPortfolio ? (
                        <span className={`badge ${getPortfolioBadgeClass(trade.fromPortfolio.name)}`}>
                          {trade.fromPortfolio.name}
                        </span>
                      ) : (
                        <span className="badge badge-neutral">CASH SEED</span>
                      )}
                      
                      <ArrowRight size={12} style={{ color: 'var(--text-muted)' }} />
                      
                      <span className={`badge ${getPortfolioBadgeClass(trade.toPortfolio.name)}`}>
                        {trade.toPortfolio.name}
                      </span>
                    </div>
                  </td>
                  
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px' }}>{trade.reason}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        SPY Index Price: ${trade.spyPrice.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '600' }}>
                        ${trade.capitalAfter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Pre-trade: ${trade.capitalBefore.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </td>
                  
                  <td style={{ color: 'var(--danger)', fontWeight: '500' }}>
                    ${trade.transactionCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  
                  <td style={{ 
                    fontWeight: '700', 
                    color: trade.returnPct !== undefined 
                      ? (trade.returnPct >= 0 ? 'var(--success)' : 'var(--danger)') 
                      : 'var(--text-secondary)'
                  }}>
                    {trade.returnPct !== undefined 
                      ? `${trade.returnPct >= 0 ? '+' : ''}${trade.returnPct}%` 
                      : '--'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.01)', padding: '10px', borderRadius: '6px' }}>
        <Info size={14} style={{ color: 'var(--primary)' }} />
        <span>Holding Period Return represents the performance of the portfolio from this rotation event until the next rotation (or the end of the simulation).</span>
      </div>
    </div>
  );
};
