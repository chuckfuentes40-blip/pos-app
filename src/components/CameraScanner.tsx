'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle } from 'lucide-react';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (code: string) => void;
}

export default function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasScannedRef = useRef<boolean>(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Enumerate video devices
  useEffect(() => {
    if (!isOpen) return;

    const getDevices = async () => {
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
        
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }

        tempStream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.warn('Could not enumerate camera devices:', err);
      }
    };

    getDevices();
  }, [isOpen]);

  // Start video stream & scanner logic
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    hasScannedRef.current = false;
    setLoading(true);
    setError(null);

    // Stop existing stream if switching devices
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    let animationFrameId: number;

    const startCamera = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId } }
            : { facingMode: { ideal: 'environment' } },
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = async () => {
            try {
              await videoRef.current?.play();
              if (isMounted) setLoading(false);
            } catch (pErr) {
              console.error('Play error:', pErr);
            }
          };
        }
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (isMounted) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Camera access denied in browser settings.'
              : 'Unable to start video feed. Switch camera or open app in a new tab.'
          );
          setLoading(false);
        }
      }
    };

    startCamera();

    // Barcode detection with safe cleanup upon match
    let lastCode = '';
    let consecutiveMatches = 0;

    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'],
      });

      const detectBarcode = async () => {
        if (
          videoRef.current &&
          videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
          !hasScannedRef.current
        ) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const scannedValue = barcodes[0].rawValue.trim();

              if (scannedValue.length >= 3) {
                if (scannedValue === lastCode) {
                  consecutiveMatches++;
                } else {
                  lastCode = scannedValue;
                  consecutiveMatches = 1;
                }

                // Verify across 2 consecutive frames
                if (consecutiveMatches >= 2 && !hasScannedRef.current) {
                  hasScannedRef.current = true;

                  // 1. Stop animation loop
                  if (animationFrameId) cancelAnimationFrame(animationFrameId);

                  // 2. Immediately release hardware camera tracks to prevent mobile crash
                  if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                  }
                  if (videoRef.current) {
                    videoRef.current.srcObject = null;
                  }

                  // 3. Trigger callback and close
                  if (onScan) onScan(scannedValue);
                  onClose();
                  return;
                }
              }
            } else {
              consecutiveMatches = 0;
              lastCode = '';
            }
          } catch {
            // Frame skip catch
          }
        }

        if (isMounted && !hasScannedRef.current) {
          animationFrameId = requestAnimationFrame(detectBarcode);
        }
      };

      animationFrameId = requestAnimationFrame(detectBarcode);
    }

    return () => {
      isMounted = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, selectedDeviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 p-5 border border-slate-800 shadow-2xl text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-fuchsia-400" />
            <h3 className="text-sm font-bold">Camera Scanner</h3>
          </div>
          <button
            onClick={() => {
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
              }
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
        {devices.length > 0 && (
          <div className="mt-3">
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-800 text-slate-200 text-xs rounded-lg p-2 border border-slate-700 outline-none"
            >
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