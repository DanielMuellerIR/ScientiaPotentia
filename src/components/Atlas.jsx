import React, { useState, useMemo } from 'react';
import { Globe, BookOpen, Compass, Award, Calendar, ChevronRight, Info } from 'lucide-react';

export default function Atlas({ selectedEntity, srsProgress, onStartQuickQuiz, geodb, onSelectEntity }) {
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'geography' | 'cities' | 'subdivisions'
  const [searchQuery, setSearchQuery] = useState('');

  // Format type name in German
  const getGermanType = (t) => {
    switch (t) {
      case 'country': return 'Souveräner Staat';
      case 'state': return 'Bundesland / Staat';
      case 'river': return 'Fluss';
      default: return 'Geografisches Objekt';
    }
  };

  // Get current SRS mastery level label and color
  const getMasteryBadge = () => {
    if (!srsProgress) {
      return { label: 'Ungelernt', color: 'var(--text-muted)', bg: 'rgba(0,0,0,0.03)' };
    }
    
    const { interval = 0, repetitions = 0 } = srsProgress;
    
    if (repetitions === 0) {
      return { label: 'In Prüfung', color: 'var(--color-primary)', bg: 'rgba(27, 48, 91, 0.05)' };
    }
    if (interval >= 30) {
      return { label: 'Gemeistert', color: 'var(--color-secondary)', bg: 'rgba(139, 111, 59, 0.08)' };
    }
    if (interval >= 7) {
      return { label: 'Vertraut', color: '#1D4ED8', bg: 'rgba(29, 78, 216, 0.05)' };
    }
    return { label: 'Lernen', color: 'var(--color-warning)', bg: 'rgba(181, 137, 0, 0.05)' };
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Live filter entities by name/english name/id. useMemo: nicht bei jedem
  // Tastendruck die gesamte Entity-Datenbank (Terra: tausende Eintraege) neu scannen.
  const filteredSearch = useMemo(() => {
    if (searchQuery.trim() === '') return [];
    const query = searchQuery.toLowerCase();
    return Object.values(geodb.entities).filter(entity =>
      (entity.name && entity.name.toLowerCase().includes(query)) ||
      (entity.englishName && entity.englishName.toLowerCase().includes(query)) ||
      (entity.id && entity.id.toLowerCase().includes(query))
    ).slice(0, 5);
  }, [searchQuery, geodb.entities]);

  // Unter-Einheiten (Bundeslaender/Provinzen) des aktuellen Landes — einmal
  // berechnet statt zweimal (Tab-Sichtbarkeit + Liste) bei jedem Render, und nicht
  // erneut bei jedem Tastendruck in der Suchleiste.
  const subdivisions = useMemo(() => {
    if (!selectedEntity || selectedEntity.type !== 'country') return [];
    return Object.values(geodb.entities)
      .filter(e => e.type === 'state' && e.metadata?.countryId === selectedEntity.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [geodb.entities, selectedEntity]);

  const handleSelectSearchResult = (id) => {
    onSelectEntity && onSelectEntity(id);
    setSearchQuery('');
    setActiveSubTab('overview'); // reset subtab for new entity
  };

  return (
    <div className="terra-panel slide-in" style={{
      padding: '20px',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Search Input bar (Always visible at the top) */}
      <div style={{ position: 'relative', marginBottom: '16px', zIndex: 100 }}>
        <input 
          type="text"
          placeholder="Ort, Land oder Fluss suchen..."
          value={searchQuery}
          onChange={handleSearchChange}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid var(--border-light)',
            background: '#FAF8F2',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-bright)',
            outline: 'none'
          }}
        />
        
        {/* Dropdown list of results */}
        {filteredSearch.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '38px',
            left: 0,
            right: 0,
            background: '#FAF8F2',
            border: '1px solid var(--border-light)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
            zIndex: 1000
          }}>
            {filteredSearch.map(entity => {
              const displayType = entity.type === 'country' ? 'Staat' :
                                  entity.type === 'state' ? 'Bundesland' :
                                  entity.type === 'city' ? 'Stadt' : 'Fluss';
              const flag = entity.metadata?.flag || (entity.type === 'river' ? '🌊' : '📍');
              return (
                <div 
                  key={entity.id}
                  onClick={() => handleSelectSearchResult(entity.id)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    fontSize: '13.5px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px dashed rgba(0,0,0,0.05)',
                    transition: 'background 0.15s ease'
                  }}
                  className="search-item"
                >
                  <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                    {flag} {entity.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {displayType}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!selectedEntity ? (
        <div style={{
          flex: 1,
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '300px'
        }}>
          <Globe size={48} style={{ color: 'var(--color-primary)', marginBottom: '16px', opacity: 0.8 }} />
          <h3 style={{ fontFamily: 'var(--font-title)', color: 'var(--text-bright)', marginBottom: '8px', fontSize: '20px' }}>
            Enzyklopädischer Weltatlas
          </h3>
          <p style={{ fontSize: '15px', maxWidth: '320px', lineHeight: '1.6' }}>
            Nutze die Suchleiste oben oder wähle ein Element auf der Karte aus, um die umfassende Länderakte mit Währungen, Städten, Flüssen und höchsten Bergen anzuzeigen.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Entity Title Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <span style={{
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'var(--text-muted)',
                fontWeight: 600,
                display: 'block',
                marginBottom: '4px'
              }}>
                {getGermanType(selectedEntity.type)}
                {selectedEntity.type === 'state' && selectedEntity.metadata?.countryId && (
                  <>
                    {' in '}
                    <span 
                      onClick={() => onSelectEntity && onSelectEntity(selectedEntity.metadata.countryId)}
                      style={{ 
                        color: 'var(--color-secondary)', 
                        cursor: 'pointer', 
                        textDecoration: 'underline',
                        fontWeight: 700 
                      }}
                    >
                      {geodb?.entities[selectedEntity.metadata.countryId]?.name || selectedEntity.metadata.countryId}
                    </span>
                  </>
                )}
              </span>
              <h2 style={{
                fontFamily: 'var(--font-title)',
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                lineHeight: 1.2
              }}>
                {selectedEntity.metadata?.flag && <span style={{ fontSize: '32px' }}>{selectedEntity.metadata.flag}</span>}
                {selectedEntity.type === 'river' && <span style={{ fontSize: '28px' }}>🌊</span>}
                {selectedEntity.name}
              </h2>
            </div>
            
            {/* Progress Badge */}
            <div style={{
              padding: '6px 12px',
              borderRadius: '2px',
              fontSize: '12px',
              fontWeight: 700,
              color: getMasteryBadge().color,
              backgroundColor: getMasteryBadge().bg,
              border: `1px solid ${getMasteryBadge().color}`,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Award size={14} />
              {getMasteryBadge().label}
            </div>
          </div>

          {/* Tab Selectors */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-light)',
            marginBottom: '16px',
            gap: '4px'
          }}>
            <button 
              onClick={() => setActiveSubTab('overview')}
              style={{
                background: activeSubTab === 'overview' ? 'var(--bg-card)' : 'transparent',
                border: '1px solid ' + (activeSubTab === 'overview' ? 'var(--border-light)' : 'transparent'),
                borderBottom: activeSubTab === 'overview' ? '1px solid var(--bg-card)' : 'none',
                color: activeSubTab === 'overview' ? 'var(--color-primary)' : 'var(--text-muted)',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-title)',
                position: 'relative',
                top: '1px',
                borderRadius: '2px 2px 0 0'
              }}
            >
              Übersicht
            </button>
            <button 
              onClick={() => setActiveSubTab('geography')}
              style={{
                background: activeSubTab === 'geography' ? 'var(--bg-card)' : 'transparent',
                border: '1px solid ' + (activeSubTab === 'geography' ? 'var(--border-light)' : 'transparent'),
                borderBottom: activeSubTab === 'geography' ? '1px solid var(--bg-card)' : 'none',
                color: activeSubTab === 'geography' ? 'var(--color-primary)' : 'var(--text-muted)',
                padding: '8px 14px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                fontFamily: 'var(--font-title)',
                position: 'relative',
                top: '1px',
                borderRadius: '2px 2px 0 0'
              }}
            >
              Geografie
            </button>
            {selectedEntity.type === 'country' && (
              <button 
                onClick={() => setActiveSubTab('cities')}
                style={{
                  background: activeSubTab === 'cities' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid ' + (activeSubTab === 'cities' ? 'var(--border-light)' : 'transparent'),
                  borderBottom: activeSubTab === 'cities' ? '1px solid var(--bg-card)' : 'none',
                  color: activeSubTab === 'cities' ? 'var(--color-primary)' : 'var(--text-muted)',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-title)',
                  position: 'relative',
                  top: '1px',
                  borderRadius: '2px 2px 0 0'
                }}
              >
                Städte
              </button>
            )}
            {subdivisions.length > 0 && (
              <button 
                onClick={() => setActiveSubTab('subdivisions')}
                style={{
                  background: activeSubTab === 'subdivisions' ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid ' + (activeSubTab === 'subdivisions' ? 'var(--border-light)' : 'transparent'),
                  borderBottom: activeSubTab === 'subdivisions' ? '1px solid var(--bg-card)' : 'none',
                  color: activeSubTab === 'subdivisions' ? 'var(--color-primary)' : 'var(--text-muted)',
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-title)',
                  position: 'relative',
                  top: '1px',
                  borderRadius: '2px 2px 0 0'
                }}
              >
                Regionen
              </button>
            )}
          </div>

          {/* Main Tab Content Pane (Scrollable) */}
          <div className="terra-panel-inset" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            marginBottom: '16px',
            fontSize: '15px',
            lineHeight: 1.5,
            background: '#FAF9F4'
          }}>
            
            {activeSubTab === 'overview' && (
              <div className="slide-in">
                <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '12px', fontSize: '16px' }}>
                  {selectedEntity.type === 'river' ? 'Flussdaten' : 'Staatliche Kenndaten'}
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedEntity.type === 'river' ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Länge:</span>
                        <span style={{ fontWeight: 600 }}>{selectedEntity.metadata?.lengthKm ? `${selectedEntity.metadata.lengthKm.toLocaleString('de-DE')} km` : 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Mündung:</span>
                        <span style={{ fontWeight: 600 }}>{selectedEntity.metadata?.mouth || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                        <span style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Durchflossene Länder:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {selectedEntity.metadata?.countries && selectedEntity.metadata.countries.map(cId => {
                            const countryEntity = geodb?.entities[cId];
                            return (
                              <span 
                                key={cId}
                                onClick={() => handleSelectSearchResult(cId)}
                                style={{
                                  padding: '2px 8px',
                                  background: 'var(--bg-card)',
                                  border: '1px solid var(--border-light)',
                                  borderRadius: '2px',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  color: 'var(--color-secondary)',
                                  textDecoration: 'underline'
                                }}
                              >
                                {countryEntity?.metadata?.flag} {countryEntity?.name || cId}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Hauptstadt:</span>
                        <span style={{ fontWeight: 600 }}>{selectedEntity.metadata?.capital || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Einwohnerzahl:</span>
                        <span style={{ fontWeight: 600 }}>
                          {selectedEntity.metadata?.population ? selectedEntity.metadata.population.toLocaleString('de-DE') : 'N/A'}
                        </span>
                      </div>
                      {selectedEntity.type === 'country' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Landfläche:</span>
                            <span style={{ fontWeight: 600 }}>{selectedEntity.metadata?.area ? `${selectedEntity.metadata.area.toLocaleString('de-DE')} km²` : 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Staatsoberhaupt:</span>
                            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>{selectedEntity.metadata?.headOfState || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Regierungschef:</span>
                            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>{selectedEntity.metadata?.headOfGov || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Währung:</span>
                            <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '200px' }}>{selectedEntity.metadata?.currency || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Internet TLD:</span>
                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedEntity.metadata?.tld || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Telefonvorwahl:</span>
                            <span style={{ fontWeight: 600 }}>{selectedEntity.metadata?.callingCode || 'N/A'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '6px' }}>
                            <span style={{ color: 'var(--text-muted)', marginBottom: '2px' }}>Zeitzone(n):</span>
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{selectedEntity.metadata?.timezones || 'N/A'}</span>
                          </div>
                        </>
                      )}
                      {selectedEntity.type === 'state' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Länder-Code (ISO):</span>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedEntity.metadata?.iso_3166_2 || 'N/A'}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'geography' && (
              <div className="slide-in">
                {selectedEntity.type === 'country' && (
                  <>
                    <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '12px', fontSize: '16px' }}>
                      Topographie
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Höchster Berg:</span>
                        <span style={{ fontWeight: 600, textAlign: 'right' }}>{selectedEntity.metadata?.highestPoint || 'N/A'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Gipfelhöhe:</span>
                        <span style={{ fontWeight: 600 }}>
                          {selectedEntity.metadata?.highestPointElevation ? `${selectedEntity.metadata.highestPointElevation} Meter (m)` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '12px', fontSize: '16px' }}>
                  Enzyklopädischer Artikel
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {selectedEntity.facts && selectedEntity.facts.map((fact, index) => (
                    <p key={index} style={{
                      textIndent: '16px',
                      textAlign: 'justify',
                      color: 'var(--text-main)',
                      fontSize: '15px',
                      lineHeight: '1.6'
                    }}>
                      {fact}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === 'cities' && selectedEntity.type === 'country' && (
              <div className="slide-in">
                <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '12px', fontSize: '16px' }}>
                  Größte Städte
                </h4>
                
                {selectedEntity.metadata?.largestCities && selectedEntity.metadata.largestCities.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '6px 4px', fontWeight: 600 }}>Rang</th>
                        <th style={{ padding: '6px 4px', fontWeight: 600 }}>Stadt</th>
                        <th style={{ padding: '6px 4px', fontWeight: 600, textAlign: 'right' }}>Einwohner</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEntity.metadata.largestCities.map((city, index) => (
                        <tr key={index} style={{ borderBottom: '1px dashed rgba(0,0,0,0.05)' }}>
                          <td style={{ padding: '8px 4px', color: 'var(--text-muted)', fontWeight: 600 }}>{index + 1}</td>
                          <td style={{ padding: '8px 4px', fontWeight: 600, color: 'var(--color-primary)' }}>{city.name}</td>
                          <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                            {city.population ? city.population.toLocaleString('de-DE') : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Keine Städtedaten offline verfügbar.
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'subdivisions' && selectedEntity.type === 'country' && (
              <div className="slide-in">
                <h4 style={{ fontFamily: 'var(--font-title)', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-light)', paddingBottom: '4px', marginBottom: '12px', fontSize: '16px' }}>
                  Provinzen & Bundesländer
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {subdivisions.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => handleSelectSearchResult(sub.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-light)',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          color: 'var(--color-primary)',
                          fontWeight: 600,
                          fontSize: '14px',
                          fontFamily: 'var(--font-sans)',
                          transition: 'all 0.15s ease'
                        }}
                        className="subdivision-link-btn"
                      >
                        <span>{sub.name}</span>
                        <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                      </button>
                    ))}
                </div>
              </div>
            )}

          </div>

          {/* Learning Status & Review Timer */}
          {srsProgress && (
            <div className="terra-panel-inset" style={{
              padding: '12px 14px',
              marginBottom: '14px',
              fontSize: '13.5px',
              background: 'rgba(0,0,0,0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <Calendar size={15} />
                <span>Nächster Test:</span>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                  {new Date(srsProgress.nextDueDate).toLocaleDateString('de-DE')}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                Intervall: <strong style={{ color: 'var(--text-bright)' }}>{srsProgress.interval}d</strong>
              </div>
            </div>
          )}

          {/* Actions */}
          <button 
            className="btn-terra-primary"
            onClick={() => onStartQuickQuiz(selectedEntity.id)}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            <Compass size={18} />
            Diesen Umriss lernen
          </button>
        </div>
      )}
    </div>
  );
}
