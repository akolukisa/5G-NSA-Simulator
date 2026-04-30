import { useState, useEffect } from 'react';

export interface CellData {
  type: 'LTE' | 'NR';
  siteId: number;
  sector: 'L' | 'R';
  pci: number;
  band: string;
  rsrp: number;
  rsrq: number;
  sinr: number;
  isServing: boolean;
}

export interface EventLog {
  id: string;
  time: string;
  step: number;
  eventName: string;
  position: number;
  fromCell?: string;
  toCell?: string;
  description: string;
}

export interface SimulationState {
  isRunning: boolean;
  currentStep: number;
  metrics: {
    step: number;
    activeLteRsrp: number;
    activeNrRsrp: number;
    reward: number;
    b1Threshold: number;
    eventName?: string;
    position: number;
  }[];
  eventHistory: EventLog[];
  networkStatus: {
    connectedSite: string; // e.g. '1L', '2R'
    connectedNrSite: string | null;
    is5GActive: boolean;
    connectedUEs: number;
    cells: CellData[];
    siteDistances: { // Kulelerin X eksenindeki konumları (metre cinsinden)
      site1: number;
      site2: number;
      site3: number;
    };
    tilts: {
      [siteId: number]: { lte: number; nr: number };
    };
  };
}

// Layer-3 RRC Event Descriptions (Turkish)
const getEventDescription = (eventName: string, fromCell?: string, toCell?: string) => {
  const cellInfo = (fromCell && toCell) ? ` (${fromCell} ➔ ${toCell})` : '';
  if (eventName.includes('B1')) return `5G NSA mimarisinde UE yeterli güce sahip bir NR (5G) sinyali tespit etti. Veri hızını artırmak için LTE bağlantısına ek olarak 5G bacağı (SgNB) başarıyla eklendi (EN-DC Aktif). Eklenen 5G Hücresi: ${toCell || 'Bilinmiyor'}.`;
  if (eventName.includes('A2')) return `5G (NR) sinyal kalitesi belirlenen eşik değerinin (B1 Threshold) altına düştü. Bağlantının kopmasını önlemek için 5G bacağı (${fromCell || 'Mevcut Hücre'}) güvenli bir şekilde düşürüldü, UE sadece LTE üzerinden hizmet alıyor.`;
  if (eventName.includes('Inter-site HO')) return `Kullanıcı cihazı (UE), mevcut LTE baz istasyonundan ayrılarak sinyali daha güçlü olan yeni bir LTE baz istasyonuna geçiş (Handover) yaptı.${cellInfo}`;
  if (eventName.includes('Intra-site HO')) return `Kullanıcı cihazı (UE), aynı baz istasyonundaki başka bir LTE sektörüne geçiş yaptı. Kapsama alanı değiştiği için daha güçlü olan komşu sektöre aktarıldı.${cellInfo}`;
  if (eventName.includes('A5')) return `Mevcut 5G (NR) sinyali zayıflarken başka bir 5G hücresinin sinyali daha iyi hale geldi. Ağ, veri akışını kesmeden 5G bacağını yeni hücreye aktardı.${cellInfo}`;
  if (eventName.includes('PSCell')) return `Aynı 5G baz istasyonunda (Secondary Node) daha iyi sinyal veren başka bir sektöre/hücreye (PSCell) geçiş yapıldı.${cellInfo}`;
  return "Ağ topolojisinde durum değişikliği gerçekleşti.";
};

export function useSimulationMock() {
  const [mapScale, setMapScale] = useState(1000); // Haritanın toplam uzunluğu (metre)
  const [position, setPosition] = useState(150); // UE pozisyonu (metre cinsinden)
  const [isDragging, setIsDragging] = useState(false); 
  const [simulationSpeed, setSimulationSpeed] = useState(500); // Milisaniye cinsinden hız
  
  // Kulelerin konumlarını state'te tutuyoruz ki kullanıcı sürükleyebilsin
  const [site1Pos, setSite1Pos] = useState(150); // Metre
  const [site2Pos, setSite2Pos] = useState(500); // Metre
  const [site3Pos, setSite3Pos] = useState(850); // Metre

  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    currentStep: 0,
    metrics: [],
    eventHistory: [],
    networkStatus: {
      connectedSite: '1L',
      connectedNrSite: null, // B1 ölçümü olmadan 5G'ye bağlanmamalı
      is5GActive: false, // İlk açılışta sadece LTE olmalı
      connectedUEs: 5,
      cells: [],
      siteDistances: { site1: 150, site2: 500, site3: 850 },
      tilts: {
        1: { lte: 6, nr: 7 },
        2: { lte: 6, nr: 7 },
        3: { lte: 6, nr: 7 }
      }
    }
  });

  // Sinyal gücüne göre sanal RSRQ ve SINR hesapla
  const calculateQuality = (rsrp: number, isNr: boolean) => {
    const rsrq = Math.max(-20, Math.min(-3, (rsrp + 120) / 4 - 18));
    const sinr = Math.max(-5, Math.min(30, (rsrp + 120) / 1.5 - 2));
    return { 
      rsrq: Number((rsrq + (Math.random() * 1 - 0.5)).toFixed(1)), 
      sinr: Number((sinr + (Math.random() * 2 - 1)).toFixed(1)) 
    };
  };

  // Sektör bazlı sinyal zayıflaması hesaplama (Görsel model ile %100 senkronize)
  const calculateSectorRsrp = (distance: number, isNr: boolean, isFront: boolean, tilt: number) => {
    const base = isNr ? -65 : -60;
    // Görsel model ile matematiksel modeli %100 senkronize ediyoruz:
    // Görselde kapsama yarıçapı (footprint): LTE = 2400 / tilt, NR = 1400 / tilt
    const maxRadius = isNr ? 1400 / tilt : 2400 / tilt;
    
    // Sinyalin maxRadius mesafesinde tam olarak -120 dBm (kopma noktası) olmasını sağlayan formül:
    const attenuation = Math.abs(-120 - base) / maxRadius;
    
    let rsrp = base - (distance * attenuation);
    
    // Arka loba (Back-lobe) geçen sinyal keskin zayıflar (Gerçekçi ön/arka oranlaması)
    if (!isFront) rsrp -= 25; 
    
    return Math.max(-140, Number(rsrp.toFixed(1)));
  };

  // Ana Sinyal Hesaplama Fonksiyonu (Hem interval hem de manuel hareketlerde kullanılmak üzere)
  const updateRFState = (currentPos: number, currentTilts: any, siteDistances: any) => {
    const d1 = Math.abs(currentPos - siteDistances.site1);
    const d2 = Math.abs(currentPos - siteDistances.site2);
    const d3 = Math.abs(currentPos - siteDistances.site3);

    const isLeft1 = currentPos <= siteDistances.site1;
    const lte1L = calculateSectorRsrp(d1, false, isLeft1, currentTilts[1].lte);
    const lte1R = calculateSectorRsrp(d1, false, !isLeft1, currentTilts[1].lte);
    const nr1L  = calculateSectorRsrp(d1, true, isLeft1, currentTilts[1].nr);
    const nr1R  = calculateSectorRsrp(d1, true, !isLeft1, currentTilts[1].nr);
    
    const isLeft2 = currentPos <= siteDistances.site2;
    const lte2L = calculateSectorRsrp(d2, false, isLeft2, currentTilts[2].lte);
    const lte2R = calculateSectorRsrp(d2, false, !isLeft2, currentTilts[2].lte);

    const isLeft3 = currentPos <= siteDistances.site3;
    const lte3L = calculateSectorRsrp(d3, false, isLeft3, currentTilts[3].lte);
    const lte3R = calculateSectorRsrp(d3, false, !isLeft3, currentTilts[3].lte);
    const nr3L  = calculateSectorRsrp(d3, true, isLeft3, currentTilts[3].nr);
    const nr3R  = calculateSectorRsrp(d3, true, !isLeft3, currentTilts[3].nr);

    const allLteCells = [
      { id: '1L', siteId: 1, sector: 'L', rsrp: lte1L },
      { id: '1R', siteId: 1, sector: 'R', rsrp: lte1R },
      { id: '2L', siteId: 2, sector: 'L', rsrp: lte2L },
      { id: '2R', siteId: 2, sector: 'R', rsrp: lte2R },
      { id: '3L', siteId: 3, sector: 'L', rsrp: lte3L },
      { id: '3R', siteId: 3, sector: 'R', rsrp: lte3R },
    ];

    const allNrCells = [
      { id: '1L', siteId: 1, sector: 'L', rsrp: nr1L },
      { id: '1R', siteId: 1, sector: 'R', rsrp: nr1R },
      { id: '3L', siteId: 3, sector: 'L', rsrp: nr3L },
      { id: '3R', siteId: 3, sector: 'R', rsrp: nr3R },
    ];

    return { allLteCells, allNrCells };
  };

  // State içindeki siteDistances'i anlık güncellemek için useEffect ekliyoruz
  useEffect(() => {
    setState(prev => ({
      ...prev,
      networkStatus: {
        ...prev.networkStatus,
        siteDistances: { site1: site1Pos, site2: site2Pos, site3: site3Pos }
      }
    }));
  }, [site1Pos, site2Pos, site3Pos]);

  const toggleSimulation = () => {
    setState(prev => ({ ...prev, isRunning: !prev.isRunning }));
  };

  const resetSimulation = () => {
    setPosition(150);
    // SAHALARIN YERİNİ (sitePos) SIFIRLAMIYORUZ!
    setState(prev => ({
      ...prev,
      isRunning: false,
      currentStep: 0,
      metrics: [],
      eventHistory: [],
      networkStatus: {
        ...prev.networkStatus,
        connectedSite: '1L',
        connectedNrSite: null,
        is5GActive: false,
      }
    }));
  };

const setSiteDistance = (siteId: 1 | 2 | 3, newPos: number) => {
  if (siteId === 1) setSite1Pos(newPos);
  if (siteId === 2) setSite2Pos(newPos);
  if (siteId === 3) setSite3Pos(newPos);
};

const setSiteTilt = (siteId: number, type: 'lte' | 'nr', newTilt: number) => {
  setState(prev => ({
    ...prev,
    networkStatus: {
      ...prev.networkStatus,
      tilts: {
        ...prev.networkStatus.tilts,
        [siteId]: {
          ...prev.networkStatus.tilts[siteId],
          [type]: newTilt
        }
      }
    }
  }));
};

  // Arayüzdeki (UI) manuel hareketlerde (Sürükleme veya Tilt değiştirme) tüm sistemi anlık güncelle
  useEffect(() => {
    if (state.isRunning) return; // Simülasyon akıyorsa interval zaten bu işi yapıyor

    setState(prev => {
      const { allLteCells, allNrCells } = updateRFState(position, prev.networkStatus.tilts, prev.networkStatus.siteDistances);
      
      let currentLteId = prev.networkStatus.connectedSite;
      let currentLteRsrp = allLteCells.find(c => c.id === currentLteId)?.rsrp || -140;
      let bestLte = allLteCells.reduce((p, c) => (p.rsrp > c.rsrp) ? p : c);
      
      let is5G = prev.networkStatus.is5GActive;
      let eventName: string | undefined = undefined;
      let fromCell: string | undefined = undefined;
      let toCell: string | undefined = undefined;

      // A3 Event (Manuel hareket sırasında)
      if (bestLte.rsrp > currentLteRsrp + 3) {
          const isIntraSite = bestLte.siteId === parseInt(currentLteId[0]);
          fromCell = `LTE-${currentLteId}`;
          toCell = `LTE-${bestLte.id}`;
          currentLteId = bestLte.id;
          is5G = false; 
          eventName = isIntraSite ? 'Event A3 (Intra-site HO)' : 'Event A3 (Inter-site HO)';
      }

      const activeLte = allLteCells.find(c => c.id === currentLteId)?.rsrp || -140;
      let bestNr = allNrCells.reduce((p, c) => (p.rsrp > c.rsrp) ? p : c);
      
      const lastMetrics = prev.metrics.length > 0 ? prev.metrics[prev.metrics.length - 1] : { b1Threshold: -118 };
      const threshold = lastMetrics.b1Threshold || -118;

      let servingNrId = prev.networkStatus.connectedNrSite;

      // B1 / A2 Eventleri (Manuel hareket sırasında)
      if (!is5G && bestNr.rsrp >= threshold) {
          is5G = true; 
          toCell = `NR-${bestNr.id}`;
          eventName = 'Event B1 (SgNB Add)';
      } else if (is5G && bestNr.rsrp < threshold - 2) {
          is5G = false; 
          fromCell = `NR-${servingNrId || bestNr.id}`;
          eventName = 'Event A2 (SgNB Rel)';
      }
      
      if (is5G) {
          if (servingNrId !== bestNr.id && servingNrId !== null) {
              const isIntraSiteNr = bestNr.siteId === parseInt(servingNrId[0]);
              if (!eventName) {
                 fromCell = `NR-${servingNrId}`;
                 toCell = `NR-${bestNr.id}`;
                 eventName = isIntraSiteNr ? 'Intra-SN PSCell Change' : 'Event A5 (SN Change)';
              }
          }
          servingNrId = bestNr.id;
      } else {
          servingNrId = null;
      }

      const cells: CellData[] = [
        ...allLteCells.map(c => ({
          type: 'LTE' as const,
          siteId: c.siteId,
          sector: c.sector as 'L' | 'R',
          pci: c.siteId * 100 + (c.sector === 'L' ? 1 : 2),
          band: c.siteId === 2 ? 'B20 (800MHz)' : 'B3 (1800MHz)',
          rsrp: c.rsrp,
          ...calculateQuality(c.rsrp, false),
          isServing: c.id === currentLteId
        })),
        ...allNrCells.map(c => {
          if (c.rsrp <= -140) return null;
          return {
            type: 'NR' as const,
            siteId: c.siteId,
            sector: c.sector as 'L' | 'R',
            pci: c.siteId * 100 + (c.sector === 'L' ? 10 : 20),
            band: 'n78 (3500MHz)',
            rsrp: c.rsrp,
            ...calculateQuality(c.rsrp, true),
            isServing: is5G && c.id === servingNrId
          }
        }).filter(Boolean) as CellData[]
      ];

      const newHistory = [...prev.eventHistory];
      if (eventName) {
         newHistory.push({
            id: Math.random().toString(36).substr(2, 9),
            time: new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
            step: prev.currentStep,
            eventName,
            position,
            fromCell,
            toCell,
            description: getEventDescription(eventName, fromCell, toCell)
         });
      }

      // Sürükleme sırasında üst kartlardaki metriklerin de güncellenmesi için son ölçümü ez
      const updatedMetrics = [...prev.metrics];
      if (updatedMetrics.length > 0) {
          updatedMetrics[updatedMetrics.length - 1] = {
              ...updatedMetrics[updatedMetrics.length - 1],
              activeLteRsrp: activeLte,
              activeNrRsrp: is5G ? bestNr.rsrp : -140,
              position: position,
              eventName: eventName || updatedMetrics[updatedMetrics.length - 1].eventName
          };
      }

      return {
        ...prev,
        metrics: updatedMetrics,
        eventHistory: newHistory,
        networkStatus: {
          ...prev.networkStatus,
          connectedSite: currentLteId,
          connectedNrSite: servingNrId,
          is5GActive: is5G,
          cells: cells.sort((a, b) => b.rsrp - a.rsrp)
        }
      };
    });
  }, [position, state.networkStatus.siteDistances, state.networkStatus.tilts]);

  useEffect(() => {
    if (!state.isRunning) return;

    const interval = setInterval(() => {
      // Eğer kullanıcı sürüklemiyorsa aracı sağa doğru otomatik hareket ettir
      if (!isDragging) {
        setPosition(prevPos => {
          let nextPos = prevPos + (mapScale * 0.005); // Haritanın %0.5'i kadar ilerle
          if (nextPos > mapScale) nextPos = 0; // Başa dön
          return nextPos;
        });
      }

      setState(prev => {
        const nextStep = prev.currentStep + 1;
        
        const lastMetrics = prev.metrics.length > 0 
          ? prev.metrics[prev.metrics.length - 1] 
          : { activeLteRsrp: -65, activeNrRsrp: -70, reward: 5, b1Threshold: -118 };

        // Kule pozisyonları (metre)
        const site1Pos = prev.networkStatus.siteDistances.site1;
        const site2Pos = prev.networkStatus.siteDistances.site2;
        const site3Pos = prev.networkStatus.siteDistances.site3;

        const { allLteCells, allNrCells } = updateRFState(position, prev.networkStatus.tilts, prev.networkStatus.siteDistances);

        let currentLteId = prev.networkStatus.connectedSite;
        let currentLteRsrp = allLteCells.find(c => c.id === currentLteId)?.rsrp || -140;

        let bestLte = allLteCells.reduce((prev, current) => (prev.rsrp > current.rsrp) ? prev : current);

        let is5G = prev.networkStatus.is5GActive;
        let newReward = 5.0;
        let eventName: string | undefined = undefined;
        let fromCell: string | undefined = undefined;
        let toCell: string | undefined = undefined;

        // A3 Event (LTE Handover / Intra-site Sector Change)
        if (bestLte.rsrp > currentLteRsrp + 3) {
            // Eğer aynı sahanın diğer sektörüne geçiyorsa Intra-site Handover
            const isIntraSite = bestLte.siteId === parseInt(currentLteId[0]);
            fromCell = `LTE-${currentLteId}`;
            toCell = `LTE-${bestLte.id}`;
            currentLteId = bestLte.id;
            is5G = false; // RRC Handover olunca 5G (SgNB) bacağı düşer
            newReward = -2.0; 
            eventName = isIntraSite ? 'Event A3 (Intra-site HO)' : 'Event A3 (Inter-site HO)';
        }

        const activeLte = allLteCells.find(c => c.id === currentLteId)?.rsrp || -140;
        
        let bestNr = allNrCells.reduce((prev, current) => (prev.rsrp > current.rsrp) ? prev : current);

        let newThreshold = lastMetrics.b1Threshold;
        
        if (nextStep % 10 === 0) {
           const thresholds = [-120, -118, -116, -114, -112];
           newThreshold = thresholds[Math.floor(Math.random() * thresholds.length)];
        }

        let servingNrId = prev.networkStatus.connectedNrSite;

        if (!is5G && bestNr.rsrp >= newThreshold) {
            is5G = true; 
            if (!eventName) {
               toCell = `NR-${bestNr.id}`;
               eventName = 'Event B1 (SgNB Add)';
            }
        } else if (is5G && bestNr.rsrp < newThreshold - 2) {
            is5G = false; 
            if (!eventName) {
               fromCell = `NR-${servingNrId || bestNr.id}`;
               eventName = 'Event A2 (SgNB Rel)';
            }
        }
        
        if (is5G) {
            if (servingNrId !== bestNr.id && servingNrId !== null) {
                const isIntraSiteNr = bestNr.siteId === parseInt(servingNrId[0]);
                if (!eventName) {
                   fromCell = `NR-${servingNrId}`;
                   toCell = `NR-${bestNr.id}`;
                   eventName = isIntraSiteNr ? 'Intra-SN PSCell Change' : 'Event A5 (SN Change)';
                }
            }
            servingNrId = bestNr.id;
        } else {
            servingNrId = null;
        }

        // Ödül (Reward) Hesabı
        if (activeLte < -125) {
            newReward = -10.0; // Kapsama alanı dışı! (Out of coverage)
            is5G = false;
        } else if (is5G) {
            if (bestNr.rsrp < -115.0) {
                newReward = -5.0; // Kötü 5G sinyali, ping-pong riski
            } else {
                newReward = 20.0; // Mükemmel 5G hızı
                newThreshold = -116; // Ajan doğru eşiği öğrendi
            }
        } else {
            newReward = 8.0; // Sadece LTE hızı
        }

        const newMetric = {
          step: nextStep,
          activeLteRsrp: Number(activeLte.toFixed(1)),
          activeNrRsrp: Number(bestNr.rsrp.toFixed(1)), // Grafikte en güçlü NR sinyali çizilir
          reward: newReward,
          b1Threshold: newThreshold,
          eventName,
          position
        };

        const newMetricsList = [...prev.metrics, newMetric].slice(-40);
        
        const newHistory = [...prev.eventHistory];
        if (eventName) {
           newHistory.push({
              id: Math.random().toString(36).substr(2, 9),
              time: new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
              step: nextStep,
              eventName,
              position,
              fromCell,
              toCell,
              description: getEventDescription(eventName, fromCell, toCell)
           });
        }

        // Generate Cell Data for TEMS Pocket View
        const cells: CellData[] = [];
        
        // Helper to create cell
        const createCell = (type: 'LTE'|'NR', siteId: number, sector: 'L'|'R', pci: number, band: string, rsrp: number, isServing: boolean) => {
           const { rsrq, sinr } = calculateQuality(rsrp, type === 'NR');
           return { type, siteId, sector, pci, band, rsrp: Number(rsrp.toFixed(1)), rsrq, sinr, isServing };
        };

        allLteCells.forEach(c => {
           cells.push(createCell('LTE', c.siteId, c.sector as 'L'|'R', c.siteId * 100 + (c.sector === 'L' ? 1 : 2), 'B20+B3', c.rsrp, c.id === currentLteId));
        });
        allNrCells.forEach(c => {
           if (c.rsrp > -140) {
              cells.push(createCell('NR', c.siteId, c.sector as 'L'|'R', c.siteId * 500 + (c.sector === 'L' ? 1 : 2), 'n78', c.rsrp, is5G && c.id === servingNrId));
           }
        });

        // Sort by RSRP descending
        cells.sort((a, b) => b.rsrp - a.rsrp);

        return {
          ...prev,
          currentStep: nextStep,
          metrics: newMetricsList,
          eventHistory: newHistory,
          networkStatus: {
            ...prev.networkStatus,
            connectedSite: currentLteId,
            connectedNrSite: servingNrId,
            is5GActive: is5G,
            cells
          }
        };
      });
    }, simulationSpeed);

    return () => clearInterval(interval);
  }, [state.isRunning, position, isDragging, simulationSpeed]);

  return {
    state,
    position,
    setPosition,
    mapScale,
    setMapScale,
    isDragging,
    setIsDragging,
    simulationSpeed,
    setSimulationSpeed,
    toggleSimulation,
    resetSimulation,
    setSiteDistance,
    setSiteTilt
  };
}
