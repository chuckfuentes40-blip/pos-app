'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (code: string) => void;
}

export default function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    hasScannedRef.current = false;
    setLoading(true);
    setError(null);

    const codeReader = new BrowserMultiFormatReader();

    const startScanning = async () => {
      try {
        if (!videoRef.current) return;

        // Clean up previous controls if existing
        if (controlsRef.current) {
          controlsRef.current.stop();
          controlsRef.current = null;
        }

        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : { facingMode: { ideal: 'environment' } },
        };

        // 1. Start scanner & capture controls reference
        const controls = await codeReader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (!isMounted) return;

            if (result && !hasScannedRef.current) {
              const scannedText = result.getText().trim();
              if (scannedText.length >= 3) {
                hasScannedRef.current = true;
                stopScanner();
                if (onScan) onScan(scannedText);
                onClose();
              }
            }
          }
        );

        controlsRef.current = controls;

        // 2. Fetch available camera devices safely AFTER stream starts
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
        if (isMounted) {
          setDevices(videoDevices);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Camera scanner error:', err);
        if (isMounted) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Camera access denied in browser settings.'
              : 'Unable to start camera feed. Ensure you are on HTTPS or localhost.'
          );
          setLoading(false);
        }
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen, selectedDeviceId]);

  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 p-5 border border-slate-800 shadow-2xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-fuchsia-400" />
            <h3 className="text-sm font-bold">Camera Scanner</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
          {error ? (
            <div className="flex flex-col items-center justify-center p-4 text-center text-red-400 gap-2">
              <AlertCircle size={24} />
              <p className="text-xs font-medium">{error}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay */}
              <div className="absolute inset-8 border-2 border-emerald-400/80 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-full h-0.5 bg-emerald-400/80" />
              </div>

              {loading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-slate-400 text-xs">
                  Starting camera...
                </div>
              )}
            </>
          )}
        </div>

        {/* Camera Selector */}
        {devices.length > 1 && (
          <div className="mt-3">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg p-2 border border-slate-700 outline-none"
            >
              <option value="">Default (Rear Camera)</option>
              {devices.map((device, index) => (
                <option key={device.deviceId || index} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-2 text-center">
          <p className="text-[11px] text-slate-400">
            Hold barcode steady inside the box to register.
          </p>
        </div>

      </div>
    </div>
  );
}