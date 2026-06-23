import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getAnalysisStatus } from '@/services/api';

// ─── Analysis Hook ────────────────────────────────────────────────────────────

interface UseAnalysisOptions {
  pollInterval?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseAnalysisReturn {
  startAnalysis: (file: File) => void;
  cancelAnalysis: () => void;
  isPolling: boolean;
  currentJobId: string | null;
  error: string | null;
  clearError: () => void;
}

export const useAnalysis = (options: UseAnalysisOptions = {}): UseAnalysisReturn => {
  const { pollInterval = 1500, onComplete, onError } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = useRef(false);

  const {
    startAnalysis: startStoreAnalysis,
    setAnalysisStatus,
    setAnalysisProgress,
    updatePipelineStep,
  } = useAppStore();

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const pollStatus = useCallback(
    async (jobId: string) => {
      if (isCancelledRef.current) return;

      try {
        const status = await getAnalysisStatus(jobId);

        if (isCancelledRef.current) return;

        // Update store with real API status
        setAnalysisProgress(status.progress);

        // Update pipeline steps from API
        status.steps.forEach((step) => {
          updatePipelineStep(step.id, {
            status: step.status as 'pending' | 'running' | 'complete' | 'error',
            progress: step.progress,
          });
        });

        if (status.status === 'complete') {
          setAnalysisStatus('complete');
          setAnalysisProgress(100);
          stopPolling();
          onComplete?.();
        } else if (status.status === 'error') {
          const errMsg = status.error || 'Erreur d\'analyse inconnue';
          setAnalysisStatus('error');
          setError(errMsg);
          stopPolling();
          onError?.(errMsg);
        } else {
          // Continue polling
          pollTimerRef.current = setTimeout(() => pollStatus(jobId), pollInterval);
        }
      } catch (err) {
        if (!isCancelledRef.current) {
          // If API not available, use local simulation (already started by store)
          console.warn('API not available, using simulation mode');
          // Don't stop the local simulation
        }
      }
    },
    [pollInterval, setAnalysisStatus, setAnalysisProgress, updatePipelineStep, stopPolling, onComplete, onError]
  );

  const startAnalysis = useCallback(
    (file: File) => {
      isCancelledRef.current = false;
      setError(null);

      // Start local simulation (works without API)
      startStoreAnalysis(file);

      // Try to connect to real API
      const tryRealApi = async () => {
        try {
          const { uploadFile } = await import('@/services/api');
          const response = await uploadFile({
            file,
            onUploadProgress: (progress) => {
              if (progress < 100) {
                setAnalysisProgress(Math.round(progress * 0.1)); // Upload = first 10%
              }
            },
          });

          if (!isCancelledRef.current) {
            setCurrentJobId(response.jobId);
            setIsPolling(true);
            // Start polling real API
            pollTimerRef.current = setTimeout(
              () => pollStatus(response.jobId),
              pollInterval
            );
          }
        } catch {
          // API not available - local simulation handles everything
          console.info('Running in offline simulation mode');
        }
      };

      tryRealApi();
    },
    [startStoreAnalysis, setAnalysisProgress, pollInterval, pollStatus]
  );

  const cancelAnalysis = useCallback(() => {
    isCancelledRef.current = true;
    stopPolling();
    setCurrentJobId(null);
    setAnalysisStatus('idle');
    setAnalysisProgress(0);
  }, [stopPolling, setAnalysisStatus, setAnalysisProgress]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      stopPolling();
    };
  }, [stopPolling]);

  return {
    startAnalysis,
    cancelAnalysis,
    isPolling,
    currentJobId,
    error,
    clearError,
  };
};

// ─── Dimension Validation Hook ────────────────────────────────────────────────

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export const useDimensionValidation = () => {
  const { detectedDimensions } = useAppStore();
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    warnings: [],
    errors: [],
  });

  useEffect(() => {
    const warnings: string[] = [];
    const errors: string[] = [];

    detectedDimensions.forEach((dim) => {
      if (dim.confidence < 70) {
        warnings.push(`Confiance faible (${dim.confidence}%) pour: ${dim.label}`);
      }
      if (dim.confidence < 50) {
        errors.push(`Confiance critique (${dim.confidence}%) pour: ${dim.label} - vérification manuelle requise`);
      }
      if (dim.value <= 0) {
        errors.push(`Valeur invalide (${dim.value}) pour: ${dim.label}`);
      }
      if (dim.tolerance) {
        if (Math.abs(dim.tolerance.upper) > dim.value * 0.1) {
          warnings.push(`Tolérance large pour: ${dim.label}`);
        }
      }
    });

    setValidation({
      isValid: errors.length === 0,
      warnings,
      errors,
    });
  }, [detectedDimensions]);

  return validation;
};

// ─── G-Code Download Hook ─────────────────────────────────────────────────────

export const useGCodeDownload = () => {
  const { gcode, cncController, currentProject } = useAppStore();

  const downloadGCode = useCallback(() => {
    if (!gcode) return;

    const blob = new Blob([gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name?.replace(/\.[^/.]+$/, '') || 'program'}_${cncController}.nc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [gcode, cncController, currentProject]);

  const copyGCode = useCallback(async () => {
    if (!gcode) return false;
    try {
      await navigator.clipboard.writeText(gcode);
      return true;
    } catch {
      return false;
    }
  }, [gcode]);

  return { downloadGCode, copyGCode };
};
