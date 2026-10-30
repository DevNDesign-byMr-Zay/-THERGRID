import { useEffect, useMemo, useState } from 'react';
import { loadWeatherRadar, radarOverlay, type RadarManifest } from '../services/weather-radar';
import type { TemporalInstant } from '../renderer/spatial-renderer';

export function useWeatherRadar({ enabled, mode }: { enabled: boolean; mode: TemporalInstant['mode'] }) {
  const [radarManifest,setRadarManifest]=useState<RadarManifest|null>(null);
  const [radarError,setRadarError]=useState<string|null>(null);
  const [radarFrame,setRadarFrame]=useState(0);
  const [radarPlaying,setRadarPlaying]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [radarCoverage,setRadarCoverage]=useState(false);
  useEffect(()=>{const onError=(event:Event)=>setRadarError(String((event as CustomEvent).detail));window.addEventListener('aethergrid:radar-error',onError);return()=>window.removeEventListener('aethergrid:radar-error',onError);},[]);
  useEffect(()=>{
    if(!enabled || mode!=='live')return;
    const controller=new AbortController();
    const refresh=()=>{void loadWeatherRadar(controller.signal).then(next=>{if(controller.signal.aborted)return;setRadarManifest(next);setRadarFrame(next.frames.length-1);setRadarError(null);}).catch(error=>{if(!controller.signal.aborted){setRadarError(String(error.message));setRadarManifest(null);}});};
    refresh();const timer=globalThis.setInterval(refresh,300000);return()=>{controller.abort();globalThis.clearInterval(timer);};
  },[enabled,mode]);
  useEffect(()=>{
    if(!radarPlaying || !radarManifest || mode!=='live' || !enabled)return;
    const timer=globalThis.setInterval(()=>setRadarFrame(previous=>(previous+1)%radarManifest.frames.length),2000);
    return()=>globalThis.clearInterval(timer);
  },[radarPlaying,radarManifest,mode,enabled]);
  const radarSnapshot=useMemo(()=>radarManifest && !radarError && enabled && mode==='live'?radarOverlay(radarManifest,radarFrame,radarCoverage):null,[radarManifest,radarFrame,radarCoverage,radarError,enabled,mode]);

  return { radarManifest, radarError, radarFrame, setRadarFrame, radarPlaying, setRadarPlaying, radarCoverage, setRadarCoverage, radarSnapshot };
}
