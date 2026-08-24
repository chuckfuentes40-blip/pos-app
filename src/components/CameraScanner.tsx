'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (code: string) => void;
}

export default function CameraScanner({ isOpen, onClose, onScan }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Enumerate video devices
  useEffect(() => {
    if (!isOpen) return;

    const getDevices = async () => {
      try {
        // Request temporary access to ensure labels are populated
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
        
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoDevices[0].deviceId);
        }

        // Stop temporary stream
        tempStream.getTracks().forEach((t) => t.stop());
      } catch (err) {
        console.warn('Could not enumerate camera devices:', err);
      }
    };

    getDevices();
  }, [isOpen]);

  // Start stream when device changes
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

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
          // Fallback if specific constraint fails
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

    // Barcode detection loop
    let animationFrameId: number;
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'],
      });

      const detectBarcode = async () => {
        if (
          videoRef.current &&
          videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
        ) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && onScan) {
              onScan(barcodes[0].rawValue);
              onClose();
              return;
            }
          } catch {
            // Continuation frame
          }
        }
        if (isMounted) {
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
            onClick={onClose}
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

        {/* Camera Selector Dropdown */}
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
            Select the active camera from the dropdown above if screen remains black.
          </p>
        </div>

      </div>
    </div>
  );
}