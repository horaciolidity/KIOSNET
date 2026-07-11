import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTourStore } from '../../store/useTourStore';
import { ChevronLeft, ChevronRight, X, Sparkles, HelpCircle } from 'lucide-react';

export const TourOverlay: React.FC = () => {
  const location = useLocation();
  const { active, stepIndex, steps, nextStep, prevStep, endTour, setStepsForRoute } = useTourStore();
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync steps when route changes
  useEffect(() => {
    if (active) {
      setStepsForRoute(location.pathname);
    }
  }, [location.pathname, active, setStepsForRoute]);

  const currentStep = steps[stepIndex];

  // Calculate target element position
  useEffect(() => {
    if (!active || !currentStep) {
      setHighlightRect(null);
      return;
    }

    const updatePosition = () => {
      const element = document.getElementById(currentStep.targetId);
      if (element) {
        // Scroll element into view if needed
        element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        const rect = element.getBoundingClientRect();
        setHighlightRect(rect);
      } else {
        setHighlightRect(null); // Fallback to center popover
      }
    };

    updatePosition();
    // Re-calculate on resize, scroll or DOM updates
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition);

    // Timeout to wait for page transitions / render
    const timeoutId = setTimeout(updatePosition, 300);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
      clearTimeout(timeoutId);
    };
  }, [active, currentStep, stepIndex]);

  // Position the popover relative to the highlighted element
  useEffect(() => {
    if (!active || !currentStep) return;

    if (!highlightRect) {
      // Center placement fallback
      setPopoverStyle({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 110,
        width: '350px'
      });
      return;
    }

    const placement = currentStep.placement;
    const offset = 16; // space between highlight and popover
    const popoverWidth = 320;
    const popoverHeight = 180; // approximate

    let top = 0;
    let left = 0;

    switch (placement) {
      case 'top':
        top = highlightRect.top - popoverHeight - offset;
        left = highlightRect.left + (highlightRect.width / 2) - (popoverWidth / 2);
        break;
      case 'bottom':
        top = highlightRect.bottom + offset;
        left = highlightRect.left + (highlightRect.width / 2) - (popoverWidth / 2);
        break;
      case 'left':
        top = highlightRect.top + (highlightRect.height / 2) - (popoverHeight / 2);
        left = highlightRect.left - popoverWidth - offset;
        break;
      case 'right':
        top = highlightRect.top + (highlightRect.height / 2) - (popoverHeight / 2);
        left = highlightRect.right + offset;
        break;
      default:
        // Center fallback
        top = window.innerHeight / 2 - popoverHeight / 2;
        left = window.innerWidth / 2 - popoverWidth / 2;
    }

    // Keep popover inside screen bounds
    const margin = 20;
    top = Math.max(margin, Math.min(top, window.innerHeight - popoverHeight - margin));
    left = Math.max(margin, Math.min(left, window.innerWidth - popoverWidth - margin));

    setPopoverStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${popoverWidth}px`,
      zIndex: 110
    });
  }, [active, currentStep, highlightRect, stepIndex]);

  if (!active || !currentStep) return null;

  return (
    <>
      {/* Backdrop with SVG Mask (Highlighter effect) */}
      <div 
        className="fixed inset-0 pointer-events-auto"
        style={{
          zIndex: 100,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(3px)',
          clipPath: highlightRect 
            ? `polygon(
                0% 0%, 
                0% 100%, 
                ${highlightRect.left}px 100%, 
                ${highlightRect.left}px ${highlightRect.top}px, 
                ${highlightRect.right}px ${highlightRect.top}px, 
                ${highlightRect.right}px ${highlightRect.bottom}px, 
                ${highlightRect.left}px ${highlightRect.bottom}px, 
                ${highlightRect.left}px 100%, 
                100% 100%, 
                100% 0%
              )`
            : 'none'
        }}
      />

      {/* Focus Highlight Border Ring (pulsing outline around the element) */}
      {highlightRect && (
        <div 
          className="fixed pointer-events-none rounded-2xl border-4 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.6)] animate-pulse transition-all duration-300"
          style={{
            top: `${highlightRect.top - 4}px`,
            left: `${highlightRect.left - 4}px`,
            width: `${highlightRect.width + 8}px`,
            height: `${highlightRect.height + 8}px`,
            zIndex: 105
          }}
        />
      )}

      {/* Assistant Guide Card */}
      <div 
        ref={popoverRef}
        style={popoverStyle}
        className="bg-slate-900/95 dark:bg-slate-950/95 border border-white/10 text-white rounded-[32px] p-6 shadow-2xl backdrop-blur-xl flex flex-col justify-between space-y-4 animate-in zoom-in-95 duration-200"
      >
        <div className="space-y-2">
          {/* Header */}
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5">
              <Sparkles size={12} /> KIOSNET Asistente
            </span>
            <button 
              onClick={endTour}
              className="p-1 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          
          {/* Title & Description */}
          <h4 className="font-black text-base text-white tracking-tight">{currentStep.title}</h4>
          <p className="text-slate-300 text-xs leading-relaxed font-semibold">{currentStep.description}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-2 border-t border-white/5">
          <span className="text-[10px] font-bold text-slate-400">Paso {stepIndex + 1} de {steps.length}</span>
          
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button 
                onClick={prevStep}
                className="p-2 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-all"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            
            <button 
              onClick={nextStep}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              {stepIndex === steps.length - 1 ? 'Finalizar' : 'Siguiente'} <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
