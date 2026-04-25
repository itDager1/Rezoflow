import { useRef, useEffect, useState, useCallback } from 'react';

const ITEM_H = 44;
const VISIBLE = 5;
const PAD = Math.floor(VISIBLE / 2); // 2

interface DrumRollPickerProps {
  items: Array<string | number>;
  value: string | number;
  onChange: (v: string | number) => void;
  showBand?: boolean;   // show the purple selection highlight band
  bgColor?: string;     // color for top/bottom gradient fades
  flex?: boolean;       // stretch to fill parent width
}

export function DrumRollPicker({
  items,
  value,
  onChange,
  showBand = true,
  bgColor = '#141414',
  flex = false,
}: DrumRollPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = Math.max(0, items.findIndex(i => String(i) === String(value)));
  const [scrollY, setScrollY] = useState(selectedIndex * ITEM_H);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = selectedIndex * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = selectedIndex * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTo({ top: target, behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const doSnap = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
    el.scrollTo({ top: idx * ITEM_H, behavior: 'smooth' });
    if (items[idx] !== value) onChange(items[idx]);
  }, [items, value, onChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setScrollY(el.scrollTop);
      if (snapTimer.current) clearTimeout(snapTimer.current);
      snapTimer.current = setTimeout(doSnap, 140);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (snapTimer.current) clearTimeout(snapTimer.current);
    };
  }, [doSnap]);

  const pickerH = ITEM_H * VISIBLE;

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: pickerH, width: flex ? '100%' : undefined }}
    >
      {/* Top fade */}
      <div
        className="absolute inset-x-0 top-0 z-20 pointer-events-none"
        style={{
          height: PAD * ITEM_H,
          background: `linear-gradient(180deg, ${bgColor} 0%, ${bgColor}CC 45%, transparent 100%)`,
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 z-20 pointer-events-none"
        style={{
          height: PAD * ITEM_H,
          background: `linear-gradient(0deg, ${bgColor} 0%, ${bgColor}CC 45%, transparent 100%)`,
        }}
      />
      {/* Optional selection band */}
      {showBand && (
        <div
          className="absolute inset-x-0 z-10 pointer-events-none"
          style={{
            top: PAD * ITEM_H,
            height: ITEM_H,
            borderTop: '1px solid rgba(139,92,246,0.45)',
            borderBottom: '1px solid rgba(139,92,246,0.45)',
            background: 'rgba(139,92,246,0.07)',
          }}
        />
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-scroll"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ height: PAD * ITEM_H }} />
        {items.map((item, i) => {
          const dist = (i * ITEM_H - scrollY) / ITEM_H;
          const absDist = Math.abs(dist);
          const rotX = dist * -22;
          const opacity = Math.max(0.08, 1 - absDist * 0.42);
          const isSelected = absDist < 0.55;

          return (
            <div
              key={i}
              style={{
                height: ITEM_H,
                transform: `perspective(120px) rotateX(${rotX}deg)`,
                opacity,
                willChange: 'transform, opacity',
              }}
              className="flex items-center justify-center select-none cursor-pointer"
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
                onChange(item);
              }}
            >
              <span
                className={`whitespace-nowrap ${
                  isSelected
                    ? 'text-white font-semibold text-[22px]'
                    : 'text-white/35 text-[17px] font-normal'
                }`}
              >
                {item}
              </span>
            </div>
          );
        })}
        <div style={{ height: PAD * ITEM_H }} />
      </div>
    </div>
  );
}
