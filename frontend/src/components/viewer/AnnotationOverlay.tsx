'use client';

import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Dimension } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import * as THREE from 'three';

// ─── Annotation Label ─────────────────────────────────────────────────────────

interface AnnotationLabelProps {
  dimension: Dimension;
  isSelected: boolean;
  onClick: () => void;
}

const AnnotationLabel: React.FC<AnnotationLabelProps> = ({ dimension, isSelected, onClick }) => {
  const typePrefix =
    dimension.type === 'diameter'
      ? 'Ø'
      : dimension.type === 'radius'
      ? 'R'
      : dimension.type === 'thread'
      ? 'M'
      : '';

  const toleranceStr = dimension.tolerance
    ? ` +${dimension.tolerance.upper}/${dimension.tolerance.lower}`
    : '';

  const color = isSelected ? '#00d4ff' : '#0066ff';

  return (
    <div
      onClick={onClick}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          backgroundColor: isSelected
            ? 'rgba(0, 212, 255, 0.15)'
            : 'rgba(0, 102, 255, 0.12)',
          border: `1px solid ${color}60`,
          borderRadius: 4,
          padding: '3px 7px',
          backdropFilter: 'blur(8px)',
          boxShadow: isSelected
            ? `0 0 12px rgba(0, 212, 255, 0.4)`
            : `0 0 8px rgba(0, 102, 255, 0.2)`,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            color,
            fontSize: 11,
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 600,
          }}
        >
          {typePrefix}{dimension.value.toFixed(1)} mm
        </span>
        {dimension.tolerance?.isoCode && (
          <span
            style={{
              color: 'rgba(0, 212, 255, 0.8)',
              fontSize: 9,
              marginLeft: 4,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {dimension.tolerance.isoCode}
          </span>
        )}
      </motion.div>

      {/* Leader line indicator */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 4,
          height: 4,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          boxShadow: `0 0 6px ${color}`,
        }}
      />
    </div>
  );
};

// ─── Annotation Overlay Component ─────────────────────────────────────────────

interface AnnotationOverlayProps {
  dimensions: Dimension[];
  scale?: number;
}

const AnnotationOverlay: React.FC<AnnotationOverlayProps> = ({
  dimensions,
  scale = 0.01,
}) => {
  const { selectedDimensionId, setSelectedDimension } = useAppStore();

  // Filter dimensions with valid 3D positions
  const annotatedDimensions = dimensions.filter(
    (d) => d.position && d.position.some((v) => v !== 0)
  );

  return (
    <>
      {annotatedDimensions.map((dim) => {
        if (!dim.position) return null;

        const pos: [number, number, number] = [
          dim.position[0] * scale,
          dim.position[1] * scale + 0.02,
          dim.position[2] * scale,
        ];

        return (
          <Html
            key={dim.id}
            position={pos}
            center
            occlude={false}
            style={{ pointerEvents: 'none' }}
            distanceFactor={6}
          >
            <div style={{ pointerEvents: 'auto' }}>
              <AnnotationLabel
                dimension={dim}
                isSelected={selectedDimensionId === dim.id}
                onClick={() =>
                  setSelectedDimension(
                    selectedDimensionId === dim.id ? null : dim.id
                  )
                }
              />
            </div>
          </Html>
        );
      })}
    </>
  );
};

export default AnnotationOverlay;
