import { useState } from 'react';
import { useSimulationMock } from "./hooks/useSimulationMock";
import { MetricCard } from "./components/MetricCard";
import { Play, Square, RotateCcw, ActivitySquare, Server, Zap, Pause, Pin, PinOff, MoveHorizontal, Download } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

export default function Dashboard() {
  const { state, position, setPosition, mapScale, setMapScale, setIsDragging, simulationSpeed, setSimulationSpeed, toggleSimulation, resetSimulation, setSiteDistance, setSiteTilt } = useSimulationMock();
  const [isTemsPinned, setIsTemsPinned] = useState(false);

  const [temsOffset, setTemsOffset] = useState({ x: 0, y: 0 });
  const [isDraggingTems, setIsDraggingTems] = useState(false);

  // En son ölçüm verisi
  const latestMetrics = state.metrics.length > 0 
    ? state.metrics[state.metrics.length - 1] 
    : { activeLteRsrp: -65, activeNrRsrp: -70, reward: 5, b1Threshold: -118 };

  const activeLteRsrp = latestMetrics.activeLteRsrp;
  const activeNrRsrp = latestMetrics.activeNrRsrp;

  const exportEventHistory = (format: 'json' | 'csv') => {
    if (state.eventHistory.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `layer3-event-history-${timestamp}.${format}`;

    if (format === 'json') {
      const json = JSON.stringify(state.eventHistory, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['time', 'step', 'position_m', 'eventName', 'fromCell', 'toCell', 'description'];
    const rows = state.eventHistory.map(evt => ([
      evt.time,
      evt.step,
      evt.position.toFixed(0),
      evt.eventName,
      evt.fromCell ?? '',
      evt.toCell ?? '',
      evt.description
    ]).map(esc).join(','));
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="fixed bottom-3 right-3 text-[10px] font-mono text-foreground/40 pointer-events-none z-[90]">
        Designed by Agk
      </div>
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-border pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple glow-text-blue">
            NSA.B1_OPTIMIZER
          </h1>
          <p className="text-foreground/60 font-mono mt-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-neon-green animate-pulse"></span>
            Deep RL PPO Agent Monitoring
          </p>
        </div>

        {/* Control Panel */}
        <div className="flex items-center gap-3 bg-card border border-border p-2 rounded-lg">
          <div className="flex items-center gap-2 border-r border-border/50 pr-3 mr-1">
            <span className="text-xs font-mono text-foreground/50">HIZ:</span>
            <select 
              value={simulationSpeed} 
              onChange={(e) => setSimulationSpeed(Number(e.target.value))} 
              className="bg-background border border-border rounded px-2 py-1 text-xs font-mono text-neon-blue outline-none cursor-pointer"
            >
              <option value={1000}>0.5x</option>
              <option value={500}>1.0x</option>
              <option value={250}>2.0x</option>
              <option value={100}>5.0x</option>
            </select>
          </div>
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-2 px-4 py-2 rounded font-mono text-sm font-bold transition-all ${
              state.isRunning 
                ? "bg-neon-red/10 text-neon-red border border-neon-red/50 hover:bg-neon-red/20" 
                : "bg-neon-blue/10 text-neon-blue border border-neon-blue/50 hover:bg-neon-blue/20"
            }`}
          >
            {state.isRunning ? <Square size={16} /> : <Play size={16} />}
            {state.isRunning ? "DURDUR" : "BAŞLAT"}
          </button>
          
          <button
            onClick={resetSimulation}
            disabled={state.isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded bg-background/50 border border-border text-foreground/60 hover:text-foreground hover:bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
          >
            <RotateCcw size={16} /> SIFIRLA
          </button>
        </div>
      </header>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title={`LTE RSRP (Site ${state.networkStatus.connectedSite})`} 
          value={activeLteRsrp.toFixed(1)} 
          unit="dBm" 
          icon="activity"
          glowColor="blue"
        />
        <MetricCard 
          title={`NR RSRP (Site ${state.networkStatus.connectedSite})`} 
          value={activeNrRsrp.toFixed(1)} 
          unit="dBm" 
          icon="radio"
          glowColor={state.networkStatus.is5GActive ? "purple" : "red"}
        />
        <MetricCard 
          title="Aktif B1 Eşiği" 
          value={latestMetrics.b1Threshold} 
          unit="dBm" 
          icon="cpu"
          glowColor="green"
        />
        <MetricCard 
          title="RL Ödülü (Reward)" 
          value={latestMetrics.reward > 0 ? `+${latestMetrics.reward}` : latestMetrics.reward} 
          icon="network"
          glowColor={latestMetrics.reward > 10 ? "green" : latestMetrics.reward < 0 ? "red" : "blue"}
        />
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col gap-6">
        
        {/* Network Topology Visualizer */}
        <div id="topology-container" className="w-full bg-card rounded-lg border border-border p-6 relative overflow-hidden flex flex-col">
          <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none"></div>
          
          <div className="flex items-center justify-between mb-2 relative z-10">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-mono font-bold text-neon-blue flex items-center gap-2">
                <Server size={18} /> AĞ TOPOLOJİSİ
              </h2>
              <div className="flex items-center gap-2 bg-background/50 border border-border px-3 py-1 rounded text-xs font-mono">
                <span className="text-foreground/60">Harita Uzunluğu:</span>
                <select 
                  className="bg-transparent text-neon-blue font-bold outline-none cursor-pointer"
                  value={mapScale}
                  onChange={(e) => setMapScale(Number(e.target.value))}
                >
                  <option value={1000}>1000m (x1)</option>
                  <option value={2000}>2000m (x2)</option>
                  <option value={3000}>3000m (x3)</option>
                  <option value={5000}>5000m (x5)</option>
                </select>
              </div>
            </div>
            <div className={`px-3 py-1 rounded text-xs font-mono font-bold border ${
              state.networkStatus.is5GActive 
                ? "bg-neon-purple/20 text-neon-purple border-neon-purple/50 glow-purple" 
                : "bg-background text-foreground/50 border-border"
            }`}>
              {state.networkStatus.is5GActive ? "5G NSA AKTİF" : "SADECE LTE"}
            </div>
          </div>

          {/* Topology Canvas (X-Axis Movement) */}
          <div className="relative flex-1 w-full min-h-[300px] mt-4 flex items-end justify-between border-b-2 border-border/50 pb-12 z-10 px-8">
            
            {/* Distance Indicator */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-background/80 border border-border px-4 py-1 rounded-full text-xs font-mono text-foreground/70 z-20 flex items-center gap-2">
              <span>Mesafe:</span>
              <span className="text-neon-blue font-bold">{position.toFixed(0)}m</span>
            </div>

            {/* Draggable Slider Wrapper */}
            <div className="absolute bottom-6 left-0 w-full z-40 px-8 h-10 flex items-center">
              <input 
                type="range" 
                min="0" 
                max={mapScale} 
                value={position} 
                onChange={(e) => setPosition(Number(e.target.value))} 
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                className="w-full opacity-0 cursor-ew-resize h-full absolute inset-0 z-50"
                title="Kullanıcıyı sürükle"
              />
            </div>

            {/* Site 1 Tower (Left) */}
            <div className="absolute bottom-12 flex flex-col items-center justify-end h-full w-24 transform -translate-x-1/2 group z-50 pointer-events-auto" style={{ left: `${(state.networkStatus.siteDistances.site1 / mapScale) * 100}%` }}>
              
              {/* TOWER TOOLTIP & TILT SETTINGS */}
              <div className="absolute -top-10 -right-48 bg-card/95 backdrop-blur border border-border p-3 rounded-lg text-xs font-mono opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 delay-100 hover:opacity-100 hover:visible hover:delay-0 group-hover:delay-0 hover:transition-none group-hover:duration-0 pointer-events-none group-hover:pointer-events-auto flex flex-col gap-3 shadow-2xl cursor-default w-40 z-[60] group-hover:[transition-delay:0ms] [transition-delay:3000ms] [&:not(:hover)]:pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="font-bold text-foreground/80 border-b border-border/50 pb-2 text-center flex justify-between items-center gap-4">
                  <span>TILT (EĞİM)</span>
                  <span className="text-foreground/50 bg-background px-1 rounded">{state.networkStatus.siteDistances.site1.toFixed(0)}m</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-neon-blue font-bold">LTE</span>
                    <span className="text-neon-blue font-bold">{state.networkStatus.tilts[1].lte}°</span>
                  </div>
                  <input 
                    type="range" min="2" max="15" step="1" 
                    value={state.networkStatus.tilts[1].lte} 
                    onChange={(e) => setSiteTilt(1, 'lte', Number(e.target.value))} 
                    className="w-full accent-neon-blue cursor-pointer h-2 bg-border rounded-lg appearance-none" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-neon-purple font-bold">NR</span>
                    <span className="text-neon-purple font-bold">{state.networkStatus.tilts[1].nr}°</span>
                  </div>
                  <input 
                    type="range" min="2" max="15" step="1" 
                    value={state.networkStatus.tilts[1].nr} 
                    onChange={(e) => setSiteTilt(1, 'nr', Number(e.target.value))} 
                    className="w-full accent-neon-purple cursor-pointer h-2 bg-border rounded-lg appearance-none" 
                  />
                </div>
              </div>

              <div className="absolute inset-0 w-32 -left-4 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-neon-blue/10 rounded flex items-center justify-center border border-neon-blue/50"
                   onMouseDown={(e) => {
                     e.preventDefault(); // Metin seçimini engelle
                     setIsDragging(true); // Sürükleme sırasında simülasyonun kendi kendine oynamasını durdur
                     
                     const moveHandler = (moveEv: MouseEvent) => {
                       const container = document.getElementById('topology-container');
                       if (container) {
                         const rect = container.getBoundingClientRect();
                         const pos = Math.max(0, Math.min(mapScale, ((moveEv.clientX - rect.left) / rect.width) * mapScale));
                         setSiteDistance(1, pos);
                       }
                     };
                     const upHandler = () => {
                       setIsDragging(false);
                       document.removeEventListener('mousemove', moveHandler);
                       document.removeEventListener('mouseup', upHandler);
                     };
                     document.addEventListener('mousemove', moveHandler);
                     document.addEventListener('mouseup', upHandler);
                   }}
              >
                <MoveHorizontal className="text-neon-blue drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" size={24} />
              </div>
              {/* Antenna details (Real BTS style) */}
              <div className={`w-16 h-12 border-b-2 flex justify-between items-end pb-1 px-1 relative z-20 transition-colors duration-500 ${state.networkStatus.connectedSite === '1L' || state.networkStatus.connectedSite === '1R' ? "border-neon-blue bg-gradient-to-t from-neon-blue/10 to-transparent glow-blue" : "border-border bg-transparent"}`}>
                 {/* Left Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform -rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '1L' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedNrSite === '1L' ? "bg-neon-purple animate-pulse glow-text-purple" : "bg-foreground/20"}`}></div>
                 </div>
                 {/* Right Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '1R' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedNrSite === '1R' ? "bg-neon-purple animate-pulse glow-text-purple" : "bg-foreground/20"}`}></div>
                 </div>
              </div>
              {/* Tower structure */}
              <div className={`w-8 h-32 border-x-2 flex flex-col justify-evenly items-center transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('1') ? "border-neon-blue/50 bg-gradient-to-b from-neon-blue/10 to-transparent" : "border-border/50"}`}>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
              </div>
              {/* Base/Label */}
              <div className="absolute -bottom-16 w-32 text-center">
                <div className={`bg-background/90 border p-2 rounded transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('1') ? "border-neon-blue/50 shadow-[0_0_10px_rgba(0,240,255,0.1)]" : "border-border"}`}>
                  <div className={`text-[10px] font-mono ${state.networkStatus.connectedSite.startsWith('1') ? "text-neon-blue" : "text-foreground/50"}`}>SITE 1 (LTE+NR)</div>
                </div>
              </div>
            </div>

            {/* Site 2 Tower (Center) */}
            <div className="absolute bottom-12 flex flex-col items-center justify-end h-full w-24 transform -translate-x-1/2 group z-50 pointer-events-auto" style={{ left: `${(state.networkStatus.siteDistances.site2 / mapScale) * 100}%` }}>
              
              {/* TOWER TOOLTIP & TILT SETTINGS */}
              <div className="absolute -top-10 -right-48 bg-card/95 backdrop-blur border border-border p-3 rounded-lg text-xs font-mono opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 delay-100 hover:opacity-100 hover:visible hover:delay-0 group-hover:delay-0 hover:transition-none group-hover:duration-0 pointer-events-none group-hover:pointer-events-auto flex flex-col gap-3 shadow-2xl cursor-default w-40 z-[60] group-hover:[transition-delay:0ms] [transition-delay:3000ms] [&:not(:hover)]:pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="font-bold text-foreground/80 border-b border-border/50 pb-2 text-center flex justify-between items-center gap-4">
                  <span>TILT (EĞİM)</span>
                  <span className="text-foreground/50 bg-background px-1 rounded">{state.networkStatus.siteDistances.site2.toFixed(0)}m</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-neon-blue font-bold">LTE</span>
                    <span className="text-neon-blue font-bold">{state.networkStatus.tilts[2].lte}°</span>
                  </div>
                  <input 
                    type="range" min="2" max="15" step="1" 
                    value={state.networkStatus.tilts[2].lte} 
                    onChange={(e) => setSiteTilt(2, 'lte', Number(e.target.value))} 
                    className="w-full accent-neon-blue cursor-pointer h-2 bg-border rounded-lg appearance-none" 
                  />
                </div>
              </div>

              <div className="absolute inset-0 w-32 -left-4 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-neon-blue/10 rounded flex items-center justify-center border border-neon-blue/50"
                   onMouseDown={(e) => {
                     e.preventDefault();
                     setIsDragging(true);
                     
                     const moveHandler = (moveEv: MouseEvent) => {
                       const container = document.getElementById('topology-container');
                       if (container) {
                         const rect = container.getBoundingClientRect();
                         const pos = Math.max(0, Math.min(mapScale, ((moveEv.clientX - rect.left) / rect.width) * mapScale));
                         setSiteDistance(2, pos);
                       }
                     };
                     const upHandler = () => {
                       setIsDragging(false);
                       document.removeEventListener('mousemove', moveHandler);
                       document.removeEventListener('mouseup', upHandler);
                     };
                     document.addEventListener('mousemove', moveHandler);
                     document.addEventListener('mouseup', upHandler);
                   }}
              >
                <MoveHorizontal className="text-neon-blue drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" size={24} />
              </div>
              {/* Antenna details (Real BTS style) */}
              <div className={`w-16 h-12 border-b-2 flex justify-between items-end pb-1 px-1 relative z-20 transition-colors duration-500 ${state.networkStatus.connectedSite === '2L' || state.networkStatus.connectedSite === '2R' ? "border-neon-blue bg-gradient-to-t from-neon-blue/10 to-transparent glow-blue" : "border-border bg-transparent"}`}>
                 {/* Left Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform -rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '2L' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                 </div>
                 {/* Right Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '2R' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                 </div>
              </div>
              {/* Tower structure */}
              <div className={`w-8 h-32 border-x-2 flex flex-col justify-evenly items-center transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('2') ? "border-neon-blue/50 bg-gradient-to-b from-neon-blue/10 to-transparent" : "border-border/50"}`}>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
              </div>
              {/* Base/Label */}
              <div className="absolute -bottom-16 w-32 text-center">
                <div className={`bg-background/90 border p-2 rounded transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('2') ? "border-neon-blue/50 shadow-[0_0_10px_rgba(0,240,255,0.1)]" : "border-border"}`}>
                  <div className={`text-[10px] font-mono ${state.networkStatus.connectedSite.startsWith('2') ? "text-neon-blue" : "text-foreground/50"}`}>SITE 2 (LTE ONLY)</div>
                </div>
              </div>
            </div>

            {/* Site 3 Tower (Right) */}
            <div className="absolute bottom-12 flex flex-col items-center justify-end h-full w-24 transform -translate-x-1/2 group z-50 pointer-events-auto" style={{ left: `${(state.networkStatus.siteDistances.site3 / mapScale) * 100}%` }}>
              
              {/* TOWER TOOLTIP & TILT SETTINGS */}
              <div className="absolute -top-10 -right-48 bg-card/95 backdrop-blur border border-border p-3 rounded-lg text-xs font-mono opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 delay-100 hover:opacity-100 hover:visible hover:delay-0 group-hover:delay-0 hover:transition-none group-hover:duration-0 pointer-events-none group-hover:pointer-events-auto flex flex-col gap-3 shadow-2xl cursor-default w-40 z-[60] group-hover:[transition-delay:0ms] [transition-delay:3000ms] [&:not(:hover)]:pointer-events-auto" onMouseDown={(e) => e.stopPropagation()}>
                <div className="font-bold text-foreground/80 border-b border-border/50 pb-2 text-center flex justify-between items-center gap-4">
                  <span>TILT (EĞİM)</span>
                  <span className="text-foreground/50 bg-background px-1 rounded">{state.networkStatus.siteDistances.site3.toFixed(0)}m</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-neon-blue font-bold">LTE</span>
                    <span className="text-neon-blue font-bold">{state.networkStatus.tilts[3].lte}°</span>
                  </div>
                  <input 
                    type="range" min="2" max="15" step="1" 
                    value={state.networkStatus.tilts[3].lte} 
                    onChange={(e) => setSiteTilt(3, 'lte', Number(e.target.value))} 
                    className="w-full accent-neon-blue cursor-pointer h-2 bg-border rounded-lg appearance-none" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-neon-purple font-bold">NR</span>
                    <span className="text-neon-purple font-bold">{state.networkStatus.tilts[3].nr}°</span>
                  </div>
                  <input 
                    type="range" min="2" max="15" step="1" 
                    value={state.networkStatus.tilts[3].nr} 
                    onChange={(e) => setSiteTilt(3, 'nr', Number(e.target.value))} 
                    className="w-full accent-neon-purple cursor-pointer h-2 bg-border rounded-lg appearance-none" 
                  />
                </div>
              </div>

              <div className="absolute inset-0 w-32 -left-4 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-neon-blue/10 rounded flex items-center justify-center border border-neon-blue/50"
                   onMouseDown={(e) => {
                     e.preventDefault();
                     setIsDragging(true);
                     
                     const moveHandler = (moveEv: MouseEvent) => {
                       const container = document.getElementById('topology-container');
                       if (container) {
                         const rect = container.getBoundingClientRect();
                         const pos = Math.max(0, Math.min(mapScale, ((moveEv.clientX - rect.left) / rect.width) * mapScale));
                         setSiteDistance(3, pos);
                       }
                     };
                     const upHandler = () => {
                       setIsDragging(false);
                       document.removeEventListener('mousemove', moveHandler);
                       document.removeEventListener('mouseup', upHandler);
                     };
                     document.addEventListener('mousemove', moveHandler);
                     document.addEventListener('mouseup', upHandler);
                   }}
              >
                <MoveHorizontal className="text-neon-blue drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" size={24} />
              </div>
              {/* Antenna details (Real BTS style) */}
              <div className={`w-16 h-12 border-b-2 flex justify-between items-end pb-1 px-1 relative z-20 transition-colors duration-500 ${state.networkStatus.connectedSite === '3L' || state.networkStatus.connectedSite === '3R' ? "border-neon-blue bg-gradient-to-t from-neon-blue/10 to-transparent glow-blue" : "border-border bg-transparent"}`}>
                 {/* Left Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform -rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '3L' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedNrSite === '3L' ? "bg-neon-purple animate-pulse glow-text-purple" : "bg-foreground/20"}`}></div>
                 </div>
                 {/* Right Antenna */}
                 <div className="w-3 h-10 border-2 border-border bg-card rounded-sm flex flex-col items-center justify-between py-1 transform rotate-12 origin-bottom">
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedSite === '3R' ? "bg-neon-blue animate-pulse glow-blue" : "bg-foreground/20"}`}></div>
                   <div className={`w-1 h-1 rounded-full ${state.networkStatus.connectedNrSite === '3R' ? "bg-neon-purple animate-pulse glow-text-purple" : "bg-foreground/20"}`}></div>
                 </div>
              </div>
              {/* Tower structure */}
              <div className={`w-8 h-32 border-x-2 flex flex-col justify-evenly items-center transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('3') ? "border-neon-blue/50 bg-gradient-to-b from-neon-blue/10 to-transparent" : "border-border/50"}`}>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
                <div className="w-full h-px bg-current opacity-30"></div>
              </div>
              {/* Base/Label */}
              <div className="absolute -bottom-16 w-32 text-center">
                <div className={`bg-background/90 border p-2 rounded transition-colors duration-500 ${state.networkStatus.connectedSite.startsWith('3') ? "border-neon-blue/50 shadow-[0_0_10px_rgba(0,240,255,0.1)]" : "border-border"}`}>
                  <div className={`text-[10px] font-mono ${state.networkStatus.connectedSite.startsWith('3') ? "text-neon-blue" : "text-foreground/50"}`}>SITE 3 (LTE+NR)</div>
                </div>
              </div>
            </div>

            {/* Coverage Indicators (Background Sectors) */}
            <svg className="absolute inset-0 w-full h-[85%] pointer-events-none z-0 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
              {[1, 2, 3].map(siteId => {
                const isLTEOnly = siteId === 2;
                const pos = siteId === 1 ? state.networkStatus.siteDistances.site1 : 
                            siteId === 2 ? state.networkStatus.siteDistances.site2 : 
                            state.networkStatus.siteDistances.site3;
                const x = (pos / mapScale) * 100;
                
                // Haritanın mevcut genişliğine (scale) göre kapsama alanını dinamik ölçeklendir
                // Gerçek RF (Radyo Frekansı) Kapsama Geometrisi
                // Yandan/Önden İzdüşüm (Elevation Pattern)
                // 15m kule, 6° ve 7° Downtilt. Antenler yeryüzüne doğru geniş bir yelpaze gibi açılır.
                
                const topY = 35; // Anten tepe noktası
                const bottomY = 100; // Yeryüzü
                
                // Antenlerin merkez noktaları
                const startXLeft = x - 1.5;
                const startXRight = x + 1.5;
                const startY = 32; 

                const tiltLTE = state.networkStatus.tilts[siteId].lte;
                 const tiltNR = state.networkStatus.tilts[siteId].nr;

                 // Kapsama Paterninin Açısını / Şeklini Özelleştirmek İçin Parametreler:
                 // Formül: Baz yayılım / tilt açısı. Eğim arttıkça (tilt yükseldikçe) kapsama daralır.
                 // 6 derece LTE = 400m, 7 derece NR = 200m baz alınmıştır.
                 const lteSpread = ((2400 / tiltLTE) / mapScale) * 100; 
                 const nrSpread = ((1400 / tiltNR) / mapScale) * 100; 

                 // Gerçekçi "Elma Dilimi / Yelpaze" (Sector Footprint) çizimi için Cubic Bezier Curve
                // M: Başlangıç (Anten)
                // C: Kontrol Noktası 1 (Antenden çıkış açısı), Kontrol Noktası 2 (Yere varış açısı), Bitiş Noktası (Uzak köşe)
                // Q: Alt kavis (Yeryüzündeki kapsama sınırı)
                // L/C: Kule dibine (veya yakınına) dönüş
                return (
                  <g key={`coverage-${siteId}`}>
                    {/* LTE Left Sector */}
                    <path 
                      d={`M ${startXLeft} ${startY} 
                          C ${startXLeft - lteSpread * 0.3} ${startY + 10}, 
                            ${x - lteSpread * 0.8} ${bottomY - 20}, 
                            ${x - lteSpread} ${bottomY} 
                          Q ${x - lteSpread * 0.5} ${bottomY - 5}, 
                            ${x} ${bottomY} 
                          C ${x} ${bottomY - 30}, 
                            ${startXLeft + 2} ${startY + 20}, 
                            ${startXLeft} ${startY} Z`} 
                      fill="url(#lteBeam)" 
                      stroke="var(--neon-blue)" strokeWidth="0.2" strokeDasharray="2 3" strokeOpacity="0.6" 
                    />
                    {/* LTE Right Sector */}
                    <path 
                      d={`M ${startXRight} ${startY} 
                          C ${startXRight + lteSpread * 0.3} ${startY + 10}, 
                            ${x + lteSpread * 0.8} ${bottomY - 20}, 
                            ${x + lteSpread} ${bottomY} 
                          Q ${x + lteSpread * 0.5} ${bottomY - 5}, 
                            ${x} ${bottomY} 
                          C ${x} ${bottomY - 30}, 
                            ${startXRight - 2} ${startY + 20}, 
                            ${startXRight} ${startY} Z`} 
                      fill="url(#lteBeam)" 
                      stroke="var(--neon-blue)" strokeWidth="0.2" strokeDasharray="2 3" strokeOpacity="0.6" 
                    />
                    
                    {!isLTEOnly && (
                      <>
                        {/* NR Left Sector (Daha dar ve dik) */}
                        <path 
                          d={`M ${startXLeft} ${startY} 
                              C ${startXLeft - nrSpread * 0.3} ${startY + 15}, 
                                ${x - nrSpread * 0.8} ${bottomY - 15}, 
                                ${x - nrSpread} ${bottomY} 
                              Q ${x - nrSpread * 0.5} ${bottomY - 2}, 
                                ${x} ${bottomY} 
                              C ${x} ${bottomY - 20}, 
                                ${startXLeft + 1} ${startY + 15}, 
                                ${startXLeft} ${startY} Z`} 
                          fill="url(#nrBeam)" 
                          stroke="var(--neon-purple)" strokeWidth="0.2" strokeDasharray="2 3" strokeOpacity="0.7" 
                        />
                        {/* NR Right Sector */}
                        <path 
                          d={`M ${startXRight} ${startY} 
                              C ${startXRight + nrSpread * 0.3} ${startY + 15}, 
                                ${x + nrSpread * 0.8} ${bottomY - 15}, 
                                ${x + nrSpread} ${bottomY} 
                              Q ${x + nrSpread * 0.5} ${bottomY - 2}, 
                                ${x} ${bottomY} 
                              C ${x} ${bottomY - 20}, 
                                ${startXRight - 1} ${startY + 15}, 
                                ${startXRight} ${startY} Z`} 
                          fill="url(#nrBeam)" 
                          stroke="var(--neon-purple)" strokeWidth="0.2" strokeDasharray="2 3" strokeOpacity="0.7" 
                        />
                      </>
                    )}
                  </g>
                );
              })}
              
              <defs>
                {/* Yukarıdan (Antenden) aşağıya (Yere) doğru azalan Gradient */}
                <linearGradient id="lteBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--neon-blue)" stopOpacity="0.6" />
                  <stop offset="40%" stopColor="var(--neon-blue)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--neon-blue)" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="nrBeam" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--neon-purple)" stopOpacity="0.7" />
                  <stop offset="40%" stopColor="var(--neon-purple)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--neon-purple)" stopOpacity="0.05" />
                </linearGradient>
              </defs>
            </svg>

            {/* Signal Connection Lines (SVG) */}
            <svg className="absolute inset-y-0 left-8 right-8 h-full pointer-events-none z-10 overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
               {/* Line to Active LTE Site */}
               {state.networkStatus.cells.filter(c => c.type === 'LTE' && c.isServing).map(c => {
                 const targetX = c.siteId === 1 ? state.networkStatus.siteDistances.site1 : 
                                 c.siteId === 2 ? state.networkStatus.siteDistances.site2 : 
                                 state.networkStatus.siteDistances.site3;
                 const antennaX = c.sector === 'L' ? (targetX / mapScale * 100) - 1.5 : (targetX / mapScale * 100) + 1.5;
                 return (
                   <line 
                     key={`lte-line-${c.siteId}-${c.sector}`}
                     x1={(position / mapScale) * 100} y1="95" 
                     x2={antennaX} y2="32" 
                     stroke="var(--neon-blue)" strokeWidth="0.2" strokeDasharray="0.5 0.5" className="opacity-60" 
                   />
                 );
               })}
               {/* Line to Active NR (5G) Site */}
               {state.networkStatus.cells.filter(c => c.type === 'NR' && c.isServing).map(c => {
                 const targetX = c.siteId === 1 ? state.networkStatus.siteDistances.site1 : 
                                 state.networkStatus.siteDistances.site3;
                 const antennaX = c.sector === 'L' ? (targetX / mapScale * 100) - 1.5 : (targetX / mapScale * 100) + 1.5;
                 return (
                   <line 
                     key={`nr-line-${c.siteId}-${c.sector}`}
                     x1={(position / mapScale) * 100} y1="95" 
                     x2={antennaX} y2="32" 
                     stroke="var(--neon-purple)" strokeWidth="0.3" strokeDasharray="0.5 0.5" className="opacity-90 drop-shadow-[0_0_2px_rgba(176,38,255,0.8)]" 
                   />
                 );
               })}
            </svg>

            {/* Event Markers on Topology (Persistent History) */}
            {state.eventHistory.map(evt => {
              const isB1 = evt.eventName.includes('B1');
              const isA2 = evt.eventName.includes('A2');
              const isA5 = evt.eventName.includes('A5') || evt.eventName.includes('PSCell');
              const color = isB1 || isA5 ? 'var(--neon-purple)' : isA2 ? 'var(--neon-red)' : 'var(--neon-blue)';
              const label = isB1 ? 'B1' : isA2 ? 'A2' : isA5 ? 'A5' : 'A3';
              
              return (
                <div 
                  key={`history-marker-${evt.id}`}
                  className="absolute top-4 bottom-10 border-l-2 border-dashed z-0 flex flex-col justify-end pb-2 pointer-events-none transform -translate-x-1/2"
                  style={{ 
                    left: `${(evt.position / mapScale) * 100}%`,
                    borderColor: color,
                    opacity: 0.6
                  }}
                  title={evt.eventName}
                >
                  <div className="bg-background/90 border rounded px-1 mb-2 shadow-lg" style={{ borderColor: color }}>
                    <span className="text-[10px] font-mono font-bold" style={{ color: color }}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* UE (Draggable Avatar) */}
            <div 
              className="absolute bottom-10 z-50 transition-all duration-75 ease-out flex flex-col items-center gap-2 transform -translate-x-1/2 group pointer-events-auto"
              style={{ left: `${(position / mapScale) * 100}%` }}
            >
              {/* TEMS Pocket Tooltip (Hover or Pinned) */}
              <div 
                className={`absolute bottom-full mb-8 flex flex-row gap-4 bg-card/95 border border-border p-4 rounded-lg shadow-2xl backdrop-blur-md w-[560px] text-[10px] font-mono z-[70] left-1/2 hover:border-neon-blue/50 ${
                isTemsPinned 
                  ? 'opacity-100 visible' 
                  : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                } ${isDraggingTems ? 'transition-none cursor-grabbing' : 'transition-all duration-200 cursor-pointer [transition-delay:1500ms] group-hover:[transition-delay:0ms] hover:[transition-delay:0ms]'}`}
                style={{
                  transform: `translate(calc(-50% + ${temsOffset.x}px), ${temsOffset.y}px)`
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingTems(true);
                  const startX = e.clientX - temsOffset.x;
                  const startY = e.clientY - temsOffset.y;
                  let hasDragged = false;

                  const moveHandler = (moveEv: MouseEvent) => {
                    hasDragged = true;
                    setTemsOffset({
                      x: moveEv.clientX - startX,
                      y: moveEv.clientY - startY
                    });
                  };
                  const upHandler = () => {
                    setIsDraggingTems(false);
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                    // Eğer sadece tıkladıysa (sürüklemediyse) toggle yap
                    if (!hasDragged) {
                      toggleSimulation();
                    }
                  };
                  document.addEventListener('mousemove', moveHandler);
                  document.addEventListener('mouseup', upHandler);
                }}
              >
                {/* Pin Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsTemsPinned(!isTemsPinned); }}
                  className={`absolute -top-3 -right-3 border rounded-full p-1.5 z-50 cursor-pointer shadow-lg transition-colors ${
                    isTemsPinned 
                      ? 'bg-neon-blue/20 border-neon-blue text-neon-blue' 
                      : 'bg-card border-border text-foreground hover:text-neon-blue hover:border-neon-blue'
                  }`}
                  title={isTemsPinned ? "Sabitlemeyi Kaldır" : "Ekranda Sabitle"}
                >
                  {isTemsPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                
                {/* LTE SCANNER */}
                <div className="flex-1 flex flex-col">
                  <div className="text-neon-blue font-bold mb-2 border-b border-border pb-1 text-xs">LTE SCANNER</div>
                  <div className="text-foreground/50 font-bold mb-2 border-b border-border/50 pb-1 flex justify-between">
                    <span className="w-14">CELL</span>
                    <span className="w-16">CON TYPE</span>
                    <span className="w-10 text-right">RSRP</span>
                    <span className="w-10 text-right">RSRQ</span>
                    <span className="w-10 text-right">SINR</span>
                  </div>
                  {state.networkStatus.cells.filter(c => c.type === 'LTE').map(cell => (
                    <div key={`${cell.siteId}-${cell.sector}-${cell.type}`} className={`flex justify-between py-1 border-b border-border/30 last:border-0 ${cell.isServing ? 'text-neon-blue font-bold' : 'text-foreground/60'}`}>
                      <span className="w-14">LTE-{cell.siteId}{cell.sector}</span>
                      <span className="w-16">{cell.isServing ? 'Serving' : 'Monitoring'}</span>
                      <span className={`w-10 text-right ${cell.rsrp > -90 ? 'text-neon-green' : cell.rsrp < -115 ? 'text-neon-red' : ''}`}>{cell.rsrp}</span>
                      <span className="w-10 text-right">{cell.rsrq}</span>
                      <span className={`w-10 text-right ${cell.sinr > 15 ? 'text-neon-green' : cell.sinr < 5 ? 'text-neon-red' : ''}`}>{cell.sinr}</span>
                    </div>
                  ))}
                </div>

                {/* Vertical Divider */}
                <div className="w-px bg-border/50"></div>

                {/* NR SCANNER */}
                <div className="flex-1 flex flex-col">
                  <div className="text-neon-purple font-bold mb-2 border-b border-border pb-1 text-xs glow-text-purple">NR SCANNER</div>
                  <div className="text-foreground/50 font-bold mb-2 border-b border-border/50 pb-1 flex justify-between">
                    <span className="w-14">CELL</span>
                    <span className="w-16">CON TYPE</span>
                    <span className="w-10 text-right">RSRP</span>
                    <span className="w-10 text-right">RSRQ</span>
                    <span className="w-10 text-right">SINR</span>
                  </div>
                  {state.networkStatus.cells.filter(c => c.type === 'NR').map(cell => (
                    <div key={`${cell.siteId}-${cell.sector}-${cell.type}`} className={`flex justify-between py-1 border-b border-border/30 last:border-0 ${cell.isServing ? 'text-neon-purple font-bold glow-text-purple' : 'text-foreground/60'}`}>
                      <span className="w-14">NR-{cell.siteId}{cell.sector}</span>
                      <span className="w-16">{cell.isServing ? 'Serving' : 'Monitoring'}</span>
                      <span className={`w-10 text-right ${cell.rsrp > -90 ? 'text-neon-green' : cell.rsrp < -115 ? 'text-neon-red' : ''}`}>{cell.rsrp}</span>
                      <span className="w-10 text-right">{cell.rsrq}</span>
                      <span className={`w-10 text-right ${cell.sinr > 15 ? 'text-neon-green' : cell.sinr < 5 ? 'text-neon-red' : ''}`}>{cell.sinr}</span>
                    </div>
                  ))}
                </div>

              </div>

              <div 
                className="w-6 h-4 rounded bg-foreground shadow-[0_0_15px_rgba(255,255,255,0.8)] relative mt-4 cursor-pointer hover:shadow-[0_0_20px_rgba(0,240,255,0.9)] transition-shadow"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSimulation();
                }}
                title={state.isRunning ? "Simülasyonu Durdur" : "Simülasyonu Başlat"}
              >
                 <div className="absolute top-0 right-1 w-1.5 h-1.5 bg-neon-green rounded-full -mt-1.5 animate-ping"></div>
              </div>
            </div>

          </div>
        </div>

        {/* Charts Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Signal Strength Chart */}
          <div className="bg-card rounded-lg border border-border p-6 h-[300px] flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-neon-blue/5 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
            <h2 className="text-lg font-mono font-bold text-foreground/80 flex items-center gap-2 mb-4 relative z-10">
              <ActivitySquare size={18} className="text-neon-blue" /> RSRP SİNYAL GÜCÜ & EŞİK
            </h2>
            <div className="flex-1 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.metrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" vertical={false} />
                  <XAxis dataKey="step" stroke="#6b7280" fontSize={12} tickLine={false} />
                  <YAxis domain={[-140, -60]} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141423', borderColor: '#2a2a40', borderRadius: '8px', color: '#f0f0f5', fontFamily: 'monospace' }}
                    itemStyle={{ color: '#f0f0f5' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
                  
                  {state.metrics.filter(m => m.eventName).map(m => {
                    const isB1 = m.eventName === 'Event B1 (SgNB Add)';
                    const isA2 = m.eventName === 'Event A2 (SgNB Rel)';
                    const isA5 = m.eventName === 'Event A5 (SN Change)' || m.eventName === 'Intra-SN PSCell Change';
                    const color = isB1 || isA5 ? '#b026ff' : isA2 ? '#ff003c' : '#00f0ff';
                    
                    return (
                      <ReferenceLine 
                        key={m.step} 
                        x={m.step} 
                        stroke={color} 
                        strokeDasharray="3 3" 
                        strokeOpacity={0.8}
                        label={{ 
                          position: 'insideTopLeft', 
                          value: m.eventName, 
                          fill: color, 
                          fontSize: 10, 
                          fontFamily: 'monospace' 
                        }} 
                      />
                    );
                  })}

                  <Line type="monotone" dataKey="activeLteRsrp" name="LTE RSRP (Aktif)" stroke="#00f0ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="activeNrRsrp" name="NR RSRP (Aktif)" stroke="#b026ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="stepAfter" dataKey="b1Threshold" name="B1 Threshold" stroke="#00ff66" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reward & Load Chart */}
          <div className="bg-card rounded-lg border border-border p-6 h-[250px] flex flex-col relative overflow-hidden">
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-neon-green/5 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10"></div>
            <h2 className="text-lg font-mono font-bold text-foreground/80 flex items-center gap-2 mb-4 relative z-10">
              <Zap size={18} className="text-neon-green" /> PPO AJAN ÖDÜLÜ (REWARD)
            </h2>
            <div className="flex-1 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.metrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a40" vertical={false} />
                  <XAxis dataKey="step" stroke="#6b7280" fontSize={12} tickLine={false} />
                  <YAxis domain={[-10, 25]} stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141423', borderColor: '#2a2a40', borderRadius: '8px', color: '#f0f0f5', fontFamily: 'monospace' }}
                  />
                  <ReferenceLine y={0} stroke="#ff003c" strokeOpacity={0.5} strokeDasharray="3 3" />
                  
                  <Line 
                    type="stepAfter" 
                    dataKey="reward" 
                    name="Ödül Puanı" 
                    stroke="#00ff66" 
                    strokeWidth={2} 
                    dot={(props: any) => {
                      // Hata/ceza durumunda kırmızı nokta göster
                      if (props.payload.reward < 0) {
                        return <circle cx={props.cx} cy={props.cy} r={4} fill="#ff003c" stroke="none" />;
                      }
                      return <circle cx={props.cx} cy={props.cy} r={0} fill="none" />;
                    }} 
                    isAnimationActive={false} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* LAYER-3 RRC EVENT CONSOLE */}
        <div className="bg-[#0a0a0a] border border-border/50 rounded-lg p-4 font-mono text-xs shadow-inner h-56 flex flex-col z-10">
          <div className="text-neon-blue border-b border-border/50 pb-2 mb-2 font-bold flex justify-between items-center">
            <span className="flex items-center gap-2"><ActivitySquare size={16} /> LAYER-3 RRC EVENT CONSOLE</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportEventHistory('json')}
                disabled={state.eventHistory.length === 0}
                className="flex items-center gap-2 px-2 py-1 rounded bg-background/50 border border-border text-foreground/70 hover:text-foreground hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                title="JSON olarak indir"
              >
                <Download size={14} /> JSON
              </button>
              <button
                onClick={() => exportEventHistory('csv')}
                disabled={state.eventHistory.length === 0}
                className="flex items-center gap-2 px-2 py-1 rounded bg-background/50 border border-border text-foreground/70 hover:text-foreground hover:bg-card transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                title="CSV olarak indir"
              >
                <Download size={14} /> CSV
              </button>
              <span className="text-foreground/50 font-normal">Toplam Olay: {state.eventHistory.length}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-2">
            {state.eventHistory.length === 0 ? (
              <div className="text-foreground/30 flex items-center justify-center h-full italic">
                Bekleniyor... Animasyonu başlatın veya cihazı sürükleyin.
              </div>
            ) : (
              state.eventHistory.slice().reverse().map(evt => (
                <details 
                  key={evt.id} 
                  className="group bg-card/30 hover:bg-card/80 border border-border/30 rounded p-2 cursor-pointer transition-colors"
                >
                  <summary className="flex items-center gap-4 list-none outline-none">
                    <span className="text-foreground/50 w-24">[{evt.time}]</span>
                    <span className={`font-bold w-48 ${evt.eventName.includes('B1') || evt.eventName.includes('A5') || evt.eventName.includes('PSCell') ? 'text-neon-purple' : evt.eventName.includes('A2') ? 'text-neon-red' : 'text-neon-blue'}`}>
                      {evt.eventName}
                    </span>
                    {evt.fromCell || evt.toCell ? (
                      <span className="text-foreground/60 w-44">
                        {evt.fromCell ?? '—'} → {evt.toCell ?? '—'}
                      </span>
                    ) : null}
                    <span className="text-foreground/70">Mesafe: {evt.position.toFixed(0)}m</span>
                    <span className="text-foreground/40 ml-auto group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="mt-2 pt-2 border-t border-border/30 text-foreground/80 leading-relaxed pl-[104px]">
                    <span className="text-neon-green/80 font-bold mr-2">{">"} Açıklama:</span>
                    {evt.description}
                  </div>
                </details>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
