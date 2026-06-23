import axios, { AxiosInstance, AxiosProgressEvent } from 'axios';
import {
  Project,
  Dimension,
  MachiningOperation,
  Material,
  GCodeProgram,
  AnalysisResult,
  CNCController,
} from '@/types';

// ─── API Configuration ────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// ─── File Upload ──────────────────────────────────────────────────────────────

export interface UploadOptions {
  file: File;
  projectName?: string;
  material?: string;
  controller?: CNCController;
  onUploadProgress?: (progress: number) => void;
}

export interface UploadResponse {
  projectId: string;
  jobId: string;
  message: string;
}

export const uploadFile = async (options: UploadOptions): Promise<UploadResponse> => {
  const { file, projectName, material, controller, onUploadProgress } = options;

  const formData = new FormData();
  formData.append('file', file);
  if (projectName) formData.append('project_name', projectName);
  if (material) formData.append('material', material);
  if (controller) formData.append('controller', controller);

  const response = await apiClient.post<UploadResponse>('/projects/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (progressEvent.total && onUploadProgress) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(progress);
      }
    },
  });

  return response.data;
};

// ─── Project Management ───────────────────────────────────────────────────────

export const getProject = async (projectId: string): Promise<Project> => {
  const response = await apiClient.get<Project>(`/projects/${projectId}`);
  return response.data;
};

export const listProjects = async (): Promise<Project[]> => {
  const response = await apiClient.get<Project[]>('/projects');
  return response.data;
};

export const deleteProject = async (projectId: string): Promise<void> => {
  await apiClient.delete(`/projects/${projectId}`);
};

// ─── Analysis ─────────────────────────────────────────────────────────────────

export interface AnalysisStatusResponse {
  projectId: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  steps: Array<{
    id: string;
    name: string;
    status: string;
    progress: number;
  }>;
  result?: AnalysisResult;
  error?: string;
}

export const getAnalysisStatus = async (jobId: string): Promise<AnalysisStatusResponse> => {
  const response = await apiClient.get<AnalysisStatusResponse>(`/analysis/${jobId}/status`);
  return response.data;
};

export const getAnalysisResult = async (projectId: string): Promise<AnalysisResult> => {
  const response = await apiClient.get<AnalysisResult>(`/projects/${projectId}/analysis`);
  return response.data;
};

// ─── Dimensions ───────────────────────────────────────────────────────────────

export const getDimensions = async (projectId: string): Promise<Dimension[]> => {
  const response = await apiClient.get<Dimension[]>(`/projects/${projectId}/dimensions`);
  return response.data;
};

export const updateDimension = async (
  dimensionId: string,
  updates: Partial<Pick<Dimension, 'value' | 'tolerance' | 'notes'>>
): Promise<Dimension> => {
  const response = await apiClient.patch<Dimension>(`/dimensions/${dimensionId}`, updates);
  return response.data;
};

export const validateDimensions = async (
  projectId: string
): Promise<{ isValid: boolean; warnings: string[]; errors: string[] }> => {
  const response = await apiClient.post(`/projects/${projectId}/dimensions/validate`);
  return response.data;
};

// ─── Machining Operations ─────────────────────────────────────────────────────

export const getOperations = async (projectId: string): Promise<MachiningOperation[]> => {
  const response = await apiClient.get<MachiningOperation[]>(`/projects/${projectId}/operations`);
  return response.data;
};

export const updateOperation = async (
  operationId: string,
  updates: Partial<MachiningOperation>
): Promise<MachiningOperation> => {
  const response = await apiClient.patch<MachiningOperation>(`/operations/${operationId}`, updates);
  return response.data;
};

export const reorderOperations = async (
  projectId: string,
  operationIds: string[]
): Promise<MachiningOperation[]> => {
  const response = await apiClient.post<MachiningOperation[]>(
    `/projects/${projectId}/operations/reorder`,
    { order: operationIds }
  );
  return response.data;
};

// ─── G-Code ──────────────────────────────────────────────────────────────────

export interface GCodeRequest {
  controller: CNCController;
  optimizeToolpath?: boolean;
  addComments?: boolean;
}

export const getGCode = async (
  projectId: string,
  options: GCodeRequest
): Promise<GCodeProgram> => {
  const response = await apiClient.post<GCodeProgram>(
    `/projects/${projectId}/gcode`,
    options
  );
  return response.data;
};

export const downloadGCode = async (
  projectId: string,
  controller: CNCController
): Promise<Blob> => {
  const response = await apiClient.get(`/projects/${projectId}/gcode/download`, {
    params: { controller },
    responseType: 'blob',
  });
  return response.data;
};

export const validateGCode = async (
  gcode: string,
  controller: CNCController
): Promise<{
  isValid: boolean;
  errors: Array<{ line: number; message: string; severity: string }>;
  warnings: Array<{ line: number; message: string; severity: string }>;
}> => {
  const response = await apiClient.post('/gcode/validate', { gcode, controller });
  return response.data;
};

// ─── Material ─────────────────────────────────────────────────────────────────

export const getMaterials = async (): Promise<Material[]> => {
  const response = await apiClient.get<Material[]>('/materials');
  return response.data;
};

export const getMaterial = async (materialId: string): Promise<Material> => {
  const response = await apiClient.get<Material>(`/materials/${materialId}`);
  return response.data;
};

export const updateProjectMaterial = async (
  projectId: string,
  materialId: string
): Promise<void> => {
  await apiClient.patch(`/projects/${projectId}/material`, { materialId });
};

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface SimulationConfig {
  speed?: number;
  quality?: 'low' | 'medium' | 'high';
}

export interface SimulationData {
  jobId: string;
  frames: number;
  duration: number;
  toolpaths: Array<{
    operationId: string;
    points: [number, number, number][];
  }>;
}

export const startSimulation = async (
  projectId: string,
  config?: SimulationConfig
): Promise<SimulationData> => {
  const response = await apiClient.post<SimulationData>(
    `/projects/${projectId}/simulation/start`,
    config || {}
  );
  return response.data;
};

export const getSimulationFrame = async (
  jobId: string,
  frameIndex: number
): Promise<{
  toolPosition: [number, number, number];
  operation: string;
  progress: number;
}> => {
  const response = await apiClient.get(`/simulation/${jobId}/frame/${frameIndex}`);
  return response.data;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportReport = async (
  projectId: string,
  format: 'pdf' | 'xlsx' | 'json'
): Promise<Blob> => {
  const response = await apiClient.get(`/projects/${projectId}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data;
};

export default apiClient;
