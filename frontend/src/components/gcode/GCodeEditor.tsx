'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy,
  Download,
  Check,
  AlertTriangle,
  Info,
  ChevronDown,
  Code2,
  Search,
  X,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useGCodeDownload } from '@/hooks/useAnalysis';
import { CNCController } from '@/types';

// ─── Syntax Highlighting ──────────────────────────────────────────────────────

interface Token {
  type: 'gcode' | 'mcode' | 'coord' | 'comment' | 'number' | 'percent' | 'block' | 'plain';
  value: string;
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];

  // Percent (program start/end)
  if (line.trim() === '%') {
    return [{ type: 'percent', value: line }];
  }

  let remaining = line;

  // Block number (N...)
  const blockMatch = remaining.match(/^(N\d+)/);
  if (blockMatch) {
    tokens.push({ type: 'block', value: blockMatch[1] });
    remaining = remaining.slice(blockMatch[1].length);
  }

  // Comment in parentheses
  const commentRegex = /(\([^)]*\))/g;
  const parts = remaining.split(commentRegex);

  parts.forEach((part) => {
    if (part.startsWith('(') && part.endsWith(')')) {
      tokens.push({ type: 'comment', value: part });
      return;
    }

    // Parse remaining part for G, M codes and coordinates
    let str = part;
    while (str.length > 0) {
      // G codes
      const gMatch = str.match(/^(G\d+\.?\d*)/);
      if (gMatch) {
        tokens.push({ type: 'gcode', value: gMatch[1] });
        str = str.slice(gMatch[1].length);
        continue;
      }

      // M codes
      const mMatch = str.match(/^(M\d+)/);
      if (mMatch) {
        tokens.push({ type: 'mcode', value: mMatch[1] });
        str = str.slice(mMatch[1].length);
        continue;
      }

      // Coordinates (X, Y, Z, I, J, K, F, S, T, H, R)
      const coordMatch = str.match(/^([XYZIJKFSTHR])(-?\d+\.?\d*)/);
      if (coordMatch) {
        tokens.push({ type: 'coord', value: coordMatch[1] });
        tokens.push({ type: 'number', value: coordMatch[2] });
        str = str.slice(coordMatch[0].length);
        continue;
      }

      // Plain character
      tokens.push({ type: 'plain', value: str[0] });
      str = str.slice(1);
    }
  });

  return tokens;
}

const TOKEN_COLORS: Record<Token['type'], string> = {
  gcode: '#3385ff',
  mcode: '#ff6b00',
  coord: '#00d4ff',
  number: '#00ff88',
  comment: '#5a5a78',
  percent: '#9933ff',
  block: '#9898b0',
  plain: '#e8e8f0',
};

// ─── Rendered Line ────────────────────────────────────────────────────────────

interface CodeLineProps {
  line: string;
  lineNumber: number;
  isHighlighted?: boolean;
  searchQuery?: string;
}

const CodeLine: React.FC<CodeLineProps> = ({
  line,
  lineNumber,
  isHighlighted = false,
  searchQuery = '',
}) => {
  const tokens = useMemo(() => tokenizeLine(line), [line]);

  return (
    <div
      className="flex group hover:bg-white/[0.02] transition-colors"
      style={{
        backgroundColor: isHighlighted ? 'rgba(0, 102, 255, 0.08)' : undefined,
        borderLeft: isHighlighted ? '2px solid #0066ff' : '2px solid transparent',
      }}
    >
      {/* Line number */}
      <div
        className="select-none text-right pr-3 flex-shrink-0"
        style={{
          width: 44,
          color: '#3a3a55',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          lineHeight: '20px',
          paddingTop: 2,
          paddingBottom: 2,
          borderRight: '1px solid #1e1e2e',
        }}
      >
        {lineNumber}
      </div>

      {/* Code content */}
      <div
        className="px-3 flex-1 flex items-center flex-wrap gap-0"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          lineHeight: '20px',
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        {tokens.map((token, i) => (
          <span key={i} style={{ color: TOKEN_COLORS[token.type] }}>
            {token.value}
          </span>
        ))}
        {line === '' && <span>&nbsp;</span>}
      </div>
    </div>
  );
};

// ─── Controller Selector ──────────────────────────────────────────────────────

const CONTROLLERS: { value: CNCController; label: string; logo: string }[] = [
  { value: 'fanuc', label: 'Fanuc', logo: 'F' },
  { value: 'siemens', label: 'Sinumerik', logo: 'S' },
  { value: 'heidenhain', label: 'Heidenhain', logo: 'H' },
  { value: 'iso', label: 'ISO 6983', logo: 'ISO' },
];

// ─── Validation Messages ──────────────────────────────────────────────────────

const MOCK_WARNINGS = [
  { line: 70, severity: 'warning' as const, message: 'Vitesse d\'avance élevée (1200 mm/min) pour fraisage profond', code: 'W001' },
  { line: 490, severity: 'info' as const, message: 'G81 cycle de perçage simplifié — vérifier retrait suffisant', code: 'I001' },
  { line: 830, severity: 'info' as const, message: 'Contournage sans compensation outil (G41/G42)', code: 'I002' },
];

// ─── G-Code Editor Component ──────────────────────────────────────────────────

const GCodeEditor: React.FC = () => {
  const { gcode, cncController, setCncController } = useAppStore();
  const { downloadGCode, copyGCode } = useGCodeDownload();

  const [copied, setCopied] = useState(false);
  const [showValidation, setShowValidation] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => gcode.split('\n'), [gcode]);

  const filteredLineIndices = useMemo(() => {
    if (!searchQuery) return [];
    return lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => line.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(({ i }) => i);
  }, [lines, searchQuery]);

  const handleCopy = useCallback(async () => {
    const success = await copyGCode();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [copyGCode]);

  const handleValidationClick = (lineNum: number) => {
    setHighlightedLine(lineNum);
    // Scroll to line
    if (scrollRef.current) {
      const lineHeight = 24;
      scrollRef.current.scrollTop = (lineNum - 5) * lineHeight;
    }
    setTimeout(() => setHighlightedLine(null), 2000);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#0a0a0f' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: '#12121a',
          borderBottom: '1px solid #1e1e2e',
        }}
      >
        {/* Left: controller selector + stats */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {CONTROLLERS.map((ctrl) => (
              <motion.button
                key={ctrl.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCncController(ctrl.value)}
                className="px-2.5 py-1 rounded text-2xs font-medium transition-all"
                style={{
                  backgroundColor:
                    cncController === ctrl.value
                      ? 'rgba(0, 102, 255, 0.2)'
                      : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cncController === ctrl.value ? 'rgba(0, 102, 255, 0.5)' : '#1e1e2e'}`,
                  color: cncController === ctrl.value ? '#3385ff' : '#5a5a78',
                }}
              >
                {ctrl.label}
              </motion.button>
            ))}
          </div>

          <div
            className="px-2 py-1 rounded text-2xs font-mono"
            style={{
              backgroundColor: 'rgba(0, 255, 136, 0.06)',
              border: '1px solid rgba(0, 255, 136, 0.2)',
              color: '#00ff88',
            }}
          >
            {lines.length} lignes
          </div>

          <div
            className="px-2 py-1 rounded text-2xs font-mono"
            style={{
              backgroundColor: 'rgba(0, 102, 255, 0.06)',
              border: '1px solid rgba(0, 102, 255, 0.2)',
              color: '#3385ff',
            }}
          >
            ~11m 15s
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowSearch(!showSearch)}
            className="p-1.5 rounded transition-colors"
            style={{
              backgroundColor: showSearch
                ? 'rgba(0, 102, 255, 0.15)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showSearch ? 'rgba(0, 102, 255, 0.4)' : '#1e1e2e'}`,
              color: showSearch ? '#3385ff' : '#5a5a78',
            }}
            title="Rechercher"
          >
            <Search size={13} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowValidation(!showValidation)}
            className="p-1.5 rounded transition-colors relative"
            style={{
              backgroundColor: showValidation
                ? 'rgba(255, 215, 0, 0.1)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showValidation ? 'rgba(255, 215, 0, 0.3)' : '#1e1e2e'}`,
              color: showValidation ? '#ffd700' : '#5a5a78',
            }}
            title="Validation"
          >
            <AlertTriangle size={13} />
            {MOCK_WARNINGS.length > 0 && (
              <span
                className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-2xs flex items-center justify-center font-bold"
                style={{
                  backgroundColor: '#ffd700',
                  color: '#000',
                }}
              >
                {MOCK_WARNINGS.length}
              </span>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs transition-all"
            style={{
              backgroundColor: copied
                ? 'rgba(0, 255, 136, 0.12)'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${copied ? 'rgba(0, 255, 136, 0.4)' : '#1e1e2e'}`,
              color: copied ? '#00ff88' : '#9898b0',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={downloadGCode}
            className="px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs font-medium"
            style={{
              background: 'linear-gradient(135deg, #0052cc, #0066ff)',
              border: '1px solid rgba(0, 102, 255, 0.5)',
              color: '#fff',
              boxShadow: '0 0 10px rgba(0, 102, 255, 0.2)',
            }}
          >
            <Download size={12} />
            <span>Télécharger .nc</span>
          </motion.button>
        </div>
      </div>

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
            style={{ borderBottom: '1px solid #1e1e2e' }}
          >
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: '#12121a' }}>
              <Search size={12} style={{ color: '#5a5a78' }} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans le code..."
                className="flex-1 bg-transparent text-xs outline-none"
                style={{
                  color: '#e8e8f0',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
              {searchQuery && (
                <span className="text-2xs text-text-muted">
                  {filteredLineIndices.length} résultat(s)
                </span>
              )}
              <button
                onClick={() => { setSearchQuery(''); setShowSearch(false); }}
                style={{ color: '#5a5a78' }}
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="py-1">
            {lines.map((line, i) => (
              <CodeLine
                key={i}
                line={line}
                lineNumber={i + 1}
                isHighlighted={
                  highlightedLine === i + 1 ||
                  (searchQuery.length > 0 && filteredLineIndices.includes(i))
                }
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </div>

        {/* Validation panel */}
        <AnimatePresence>
          {showValidation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 overflow-hidden"
              style={{
                borderTop: '1px solid #1e1e2e',
                background: '#12121a',
                maxHeight: 150,
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: '1px solid #1e1e2e' }}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} style={{ color: '#ffd700' }} />
                  <span className="text-2xs font-semibold" style={{ color: '#9898b0' }}>
                    VALIDATION G-CODE
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="text-2xs" style={{ color: '#ffd700' }}>
                    {MOCK_WARNINGS.filter((w) => w.severity === 'warning').length} avertissement(s)
                  </span>
                  <span className="text-2xs" style={{ color: '#3385ff' }}>
                    {MOCK_WARNINGS.filter((w) => w.severity === 'info').length} info(s)
                  </span>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: 110 }}>
                {MOCK_WARNINGS.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => handleValidationClick(msg.line)}
                  >
                    {msg.severity === 'warning' ? (
                      <AlertTriangle size={11} style={{ color: '#ffd700', flexShrink: 0, marginTop: 2 }} />
                    ) : (
                      <Info size={11} style={{ color: '#3385ff', flexShrink: 0, marginTop: 2 }} />
                    )}
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="text-2xs font-mono flex-shrink-0"
                        style={{ color: '#5a5a78' }}
                      >
                        L{msg.line}
                      </span>
                      <span className="text-2xs" style={{ color: '#9898b0' }}>
                        {msg.message}
                      </span>
                      <span
                        className="text-2xs flex-shrink-0 px-1 rounded font-mono"
                        style={{
                          backgroundColor: 'rgba(90,90,120,0.15)',
                          color: '#5a5a78',
                          border: '1px solid rgba(90,90,120,0.2)',
                        }}
                      >
                        {msg.code}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default GCodeEditor;
