/**
 * Type declarations for @biosensesignal/web-sdk (Binah.ai Web SDK v5.11.4)
 * These allow the code to compile even if the SDK npm package is not installed.
 * The SDK is loaded dynamically at runtime.
 */

declare module "@biosensesignal/web-sdk" {
  export enum SessionState {
    ACTIVE = "active",
    STOPPED = "stopped",
    TERMINATED = "terminated",
  }

  export enum ImageValidity {
    VALID = 0,
    FACE_ORIENTATION = 1,
    INVALID_ROI = 2,
    TILTED_HEAD = 3,
    FACE_TOO_FAR = 4,
    FACE_TOO_CLOSE = 5,
    UNEVEN_LIGHT = 6,
  }

  export interface VitalSignValue<T = number> {
    value: T;
    confidence?: number;
  }

  export interface BloodPressureValue {
    systolic: number;
    diastolic: number;
  }

  export interface VitalSigns {
    pulseRate?: VitalSignValue;
    respirationRate?: VitalSignValue;
    stressLevel?: VitalSignValue;
    sdnn?: VitalSignValue;
    bloodPressure?: VitalSignValue<BloodPressureValue>;
    oxygenSaturation?: VitalSignValue;
    wellnessIndex?: VitalSignValue;
    hemoglobin?: VitalSignValue;
    hemoglobinA1c?: VitalSignValue;
    prq?: VitalSignValue;
    cardiacWorkload?: VitalSignValue;
  }

  export interface VitalSignsResults {
    results: VitalSigns;
  }

  export interface AlertData {
    code: number;
    domain?: string;
    message?: string;
  }

  export interface FaceSessionOptions {
    input: HTMLVideoElement;
    cameraDeviceId: string;
    processingTime?: number;
    onVitalSign?: (vitalSign: VitalSigns) => void;
    onFinalResults?: (results: VitalSignsResults) => void;
    onImageData?: (imageValidity: ImageValidity) => void;
    onError?: (alert: AlertData) => void;
    onStateChange?: (state: SessionState) => void;
    onWarning?: (alert: AlertData) => void;
  }

  export interface Session {
    start(): void;
    stop(): void;
    terminate(): void;
  }

  export interface InitOptions {
    licenseKey: string;
  }

  export interface HealthMonitorManager {
    initialize(options: InitOptions): Promise<void>;
    createFaceSession(options: FaceSessionOptions): Promise<Session>;
  }

  const monitor: HealthMonitorManager;
  export default monitor;
}
