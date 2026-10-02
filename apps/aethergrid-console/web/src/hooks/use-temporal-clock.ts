import { useEffect, useRef, useState } from 'react';

import { AethergridTemporalClock } from '../time/temporal-clock';
import type { TemporalState } from '../time/temporal-model';

export interface TemporalClockBinding {
  clock: AethergridTemporalClock;
  state: Readonly<TemporalState>;
}

export function useTemporalClock(): TemporalClockBinding {
  const clockRef = useRef<AethergridTemporalClock | null>(null);
  if (!clockRef.current) clockRef.current = new AethergridTemporalClock();

  const clock = clockRef.current;
  const [state, setState] = useState<Readonly<TemporalState>>(clock.snapshot());

  useEffect(() => {
    const unsubscribe = clock.subscribe(setState);
    return () => {
      unsubscribe();
      clock.destroy();
    };
  }, [clock]);

  return { clock, state };
}
