'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Settings2,
  Cpu,
  Github,
  Layers,
  Cog,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { CNCController } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = ['PDF', 'DXF', 'DWG', 'JPG', 'PNG'] as const;

const MATERIALS = [
  { id: 'al6061', label: 'Aluminium 6061-T6', color: '#c0c8d0', category: 'aluminum' },
  { id: 'steel1045', label: 'Acier 1045', color: '#888899', category: 'steel' },
  { id: 'ss316', label: 'Inox 316L', color: '#aab0bb', category: 'stainless' },
  { id: 'ti6al4v', label: 'Titane Ti6Al4V', color: '#8899aa', category: 'titanium' },
  { id: 'brassc360', label: 'Laiton C360', color: '#d4aa55', category: 'brass' },
  { id: 'pom', label: 'Plastique POM', color: '#ccddee', category: 'plastic' },
] as const;

const CONTROLLERS: { id: CNCController; label: string; version: string }[] = [
  { id: 'fanuc', label: 'Fanuc', version: '0i-MF' },
  { id: 'siemens', label: 'Siemens 840D', version: 'sl' },
  { id: 'heidenhain', label: 'Heidenhain iTNC', version: '530' },
  { id: 'iso', label: 'ISO Standard', version: '6983' },
];

// ─── Section Label ────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({
  children,
  icon,
}) => (
  <div className="flex items-center gap-2 px-3 py-2">
    {icon && <span style={{ color: '#5a5a78' }}>{icon}</span>}
    <span
      className="text-2xs font-semibold uppercase tracking-widest"
      style={{ color: '#5a5a78' }}
    >
      {children}
    </span>
  </div>
);

const Divider: React.FC = () => (
  <div style={{ height: 1, backgroundColor: '#1e1e2e', margin: '4px 0' }} />
);

// ─── Dropzone ─────────────────────────────────────────────────────────────────

interface DropzoneProps {
  onFileUpload: (file: File) => void;
}

const UploadDropzone: React.FC<DropzoneProps> = ({ onFileUpload }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const { analysisStatus } = useAppStore();
  const isLoading = analysisStatus === 'uploading' || analysisStatus === 'analyzing';

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setUploadProgress(0);
      onFileUpload(file);

      // Fake upload progress for UX
      let p = 0;
      const t = setInterval(() => {
        p += Math.random() * 20 + 5;
        if (p >= 100) {
          p = 100;
          clearInterval(t);
        }
        setUploadProgress(Math.round(p));
      }, 80);
    },
    [onFileUpload]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/dxf': ['.dxf'],
      'application/acad': ['.dwg'],
    },
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div className="px-3 py-2">
      <motion.div
        {...getRootProps()}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="relative rounded-lg cursor-pointer transition-all duration-200 overflow-hidden"
        style={{
          border: `1px dashed ${isDragging ? '#0066ff' : '#2a2a3e'}`,
          backgroundColor: isDragging
            ? 'rgba(0,102,255,0.08)'
            : 'rgba(255,255,255,0.02)',
          padding: '14px 12px',
        }}
      >
        <input {...getInputProps()} />

        {/* Scan line animation when dragging */}
        {isDragging && (
          <motion.div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{
              background: 'linear-gradient(90deg, transparent, #0066ff, transparent)',
            }}
            animate={{ y: ['0%', '200%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}

        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: isDragging
                ? 'linear-gradient(135deg, rgba(0,102,255,0.25), rgba(0,212,255,0.15))'
                : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isDragging ? 'rgba(0,102,255,0.5)' : '#1e1e2e'}`,
              boxShadow: isDragging ? '0 0 16px rgba(0,102,255,0.3)' : 'none',
            }}
          >
            <Upload
              size={16}
              style={{ color: isDragging ? '#0066ff' : '#5a5a78' }}
            />
          </div>

          <div>
            <p className="text-xs font-medium" style={{ color: isDragging ? '#e8e8f0' : '#9898b0' }}>
              {isDragging ? 'Déposer le fichier ici' : 'Glisser-déposer ou cliquer'}
            </p>
            <p className="text-2xs mt-0.5" style={{ color: '#5a5a78' }}>
              {ACCEPTED_FORMATS.join(' · ')}
            </p>
          </div>
        </div>

        {/* Upload progress */}
        {isLoading && (
          <div
            className="mt-3 h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(0,102,255,0.1)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #0066ff, #00d4ff)' }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ─── Recent Projects ──────────────────────────────────────────────────────────

const ProjectStatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'complete')
    return <CheckCircle2 size={11} style={{ color: '#00ff88' }} />;
  if (status === 'error')
    return <AlertCircle size={11} style={{ color: '#ff3366' }} />;
  return <Clock size={11} style={{ color: '#5a5a78' }} />;
};

const formatTimeAgo = (date: Date): string => {
  const now = Date.now();
  const diff = now - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `il y a ${days}j`;
  if (hours > 0) return `il y a ${hours}h`;
  return 'récent';
};

const RecentProjects: React.FC = () => {
  const { recentProjects } = useAppStore();

  return (
    <div className="px-1">
      <AnimatePresence>
        {recentProjects.map((proj, i) => (
          <motion.button
            key={proj.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all duration-150 group"
            style={{ color: '#9898b0' }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid #1e1e2e',
              }}
            >
              <FileText size={10} style={{ color: '#5a5a78' }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span
                  className="text-xs font-medium truncate"
                  style={{ color: '#c8c8d8' }}
                  title={proj.name}
                >
                  {proj.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <ProjectStatusIcon status={proj.status} />
                <span className="text-2xs" style={{ color: '#5a5a78' }}>
                  {formatTimeAgo(proj.createdAt)}
                </span>
                {proj.status === 'complete' && (
                  <span className="text-2xs" style={{ color: '#5a5a78' }}>
                    · {proj.dimensionCount} cotes
                  </span>
                )}
              </div>
            </div>

            <ChevronRight
              size={11}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              style={{ color: '#5a5a78' }}
            />
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ─── Material Selector ────────────────────────────────────────────────────────

const MaterialSelector: React.FC = () => {
  const { material, setMaterial } = useAppStore();

  return (
    <div className="px-3 space-y-1">
      {MATERIALS.map((mat) => (
        <button
          key={mat.id}
          onClick={() => setMaterial(mat.label)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-all duration-150"
          style={{
            backgroundColor:
              material === mat.label
                ? 'rgba(0,102,255,0.12)'
                : 'transparent',
            border:
              material === mat.label
                ? '1px solid rgba(0,102,255,0.35)'
                : '1px solid transparent',
          }}
        >
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              backgroundColor: mat.color,
              boxShadow: material === mat.label ? `0 0 6px ${mat.color}` : 'none',
            }}
          />
          <span
            className="text-xs"
            style={{
              color: material === mat.label ? '#e8e8f0' : '#9898b0',
            }}
          >
            {mat.label}
          </span>
        </button>
      ))}
    </div>
  );
};

// ─── Controller Selector ──────────────────────────────────────────────────────

const ControllerSelector: React.FC = () => {
  const { cncController, setCncController } = useAppStore();

  return (
    <div className="px-3 space-y-1">
      {CONTROLLERS.map((ctrl) => (
        <button
          key={ctrl.id}
          onClick={() => setCncController(ctrl.id)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-all duration-150"
          style={{
            backgroundColor:
              cncController === ctrl.id
                ? 'rgba(0,212,255,0.1)'
                : 'transparent',
            border:
              cncController === ctrl.id
                ? '1px solid rgba(0,212,255,0.3)'
                : '1px solid transparent',
          }}
        >
          <div className="flex items-center gap-2">
            <Cpu
              size={11}
              style={{
                color: cncController === ctrl.id ? '#00d4ff' : '#5a5a78',
              }}
            />
            <span
              className="text-xs font-medium"
              style={{
                color: cncController === ctrl.id ? '#e8e8f0' : '#9898b0',
              }}
            >
              {ctrl.label}
            </span>
          </div>
          <span
            className="text-2xs font-mono px-1.5 py-0.5 rounded"
            style={{
              backgroundColor:
                cncController === ctrl.id
                  ? 'rgba(0,212,255,0.15)'
                  : 'rgba(255,255,255,0.04)',
              color: cncController === ctrl.id ? '#00d4ff' : '#5a5a78',
            }}
          >
            {ctrl.version}
          </span>
        </button>
      ))}
    </div>
  );
};

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

interface LeftSidebarProps {
  onFileUpload: (file: File) => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ onFileUpload }) => {
  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: '#0d0d14' }}
    >
      {/* Logo header */}
      <div
        className="flex items-center gap-2.5 px-4 h-12 flex-shrink-0"
        style={{ borderBottom: '1px solid #1e1e2e' }}
      >
        <div
          className="w-7 h-7 rounded flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0066ff 0%, #00d4ff 100%)',
            boxShadow: '0 0 12px rgba(0,102,255,0.5)',
          }}
        >
          <Cog size={14} color="white" />
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-sm font-bold" style={{ color: '#e8e8f0' }}>
            Math
          </span>
          <span
            className="text-sm font-bold"
            style={{
              color: '#0066ff',
              textShadow: '0 0 10px rgba(0,102,255,0.6)',
            }}
          >
            V2
          </span>
        </div>
        <div
          className="ml-auto text-2xs px-1.5 py-0.5 rounded font-mono"
          style={{
            backgroundColor: 'rgba(0,255,136,0.08)',
            color: '#00ff88',
            border: '1px solid rgba(0,255,136,0.2)',
          }}
        >
          v2.1
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* File upload */}
        <div className="pt-3">
          <SectionLabel icon={<Upload size={11} />}>Importer fichier</SectionLabel>
          <UploadDropzone onFileUpload={onFileUpload} />
        </div>

        <Divider />

        {/* Recent projects */}
        <div className="pt-1">
          <SectionLabel icon={<FileText size={11} />}>Projets récents</SectionLabel>
          <RecentProjects />
        </div>

        <Divider />

        {/* Material selector */}
        <div className="pt-1">
          <SectionLabel icon={<Layers size={11} />}>Matériau</SectionLabel>
          <MaterialSelector />
        </div>

        <Divider />

        {/* CNC controller */}
        <div className="pt-1 pb-3">
          <SectionLabel icon={<Settings2 size={11} />}>Contrôleur CNC</SectionLabel>
          <ControllerSelector />
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-3 py-2"
        style={{ borderTop: '1px solid #1e1e2e' }}
      >
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-2xs transition-colors hover:text-text-secondary"
          style={{ color: '#5a5a78' }}
        >
          <Github size={11} />
          GitHub
        </a>
        <span
          className="text-2xs font-mono"
          style={{
            backgroundColor: 'rgba(0,102,255,0.1)',
            color: '#3385ff',
            border: '1px solid rgba(0,102,255,0.25)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          CAD/CAM AI
        </span>
      </div>
    </div>
  );
};

export default LeftSidebar;
