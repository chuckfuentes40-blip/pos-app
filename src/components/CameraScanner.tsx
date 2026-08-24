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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Camera access error:', err);
        if (isMounted) {
          setError(
            err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access in browser settings.'
              : 'Unable to start camera. Ensure no other application is using it.'
          );
          setLoading(false);
        }
      }
    };

    startCamera();

    let animationFrameId: number;
    if ('BarcodeDetector' in window) {
      const barcodeDetector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'],
      });

      const detectBarcode = async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0 && onScan) {
              onScan(barcodes[0].rawValue);
              onClose();
              return;
            }
          } catch (e) {
            // Ignore frame detection failures
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
  }, [isOpen, onClose, onScan]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 p-5 border border-slate-800 shadow-2xl text-white">
        
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

        <div className="mt-3 text-center">
          <p className="text-[11px] text-slate-400">
            Align barcode inside the green frame to scan.
          </p>
        </div>

      </div>
    </div>
  );
}