import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, RotateCcw, Check, Keyboard } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, isOpen, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (error) {
        console.error("Error stopping scanner:", error);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  const playBeep = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 1200;
        gainNode.gain.value = 0.15;

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 100);
      }
    } catch (e) {
      console.warn("Beep failed", e);
    }
  }, []);

  const startScanning = useCallback(async () => {
    if (scannerRef.current) {
      await stopScanning();
    }

    try {
      const element = document.getElementById("barcode-scanner");
      if (!element) {
        toast.error("ไม่พบ element สำหรับแสดงกล้อง");
        return;
      }

      // รองรับทุกรูปแบบบาร์โค้ด
      const html5QrCode = new Html5Qrcode("barcode-scanner", {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // กรอบใหญ่ขึ้นเพื่อรองรับบาร์โค้ดทุกขนาด
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxWidth = Math.floor(minEdge * 0.9);
            const boxHeight = Math.floor(minEdge * 0.5);
            return { width: boxWidth, height: boxHeight };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          
          hasScannedRef.current = true;
          const code = decodedText.trim();
          
          setLastScannedCode(code);
          playBeep();
          toast.success(`สแกนได้: ${code}`);
          stopScanning();
        },
        () => {}
      );

      setIsScanning(true);
    } catch (error: any) {
      console.error("Scanner start error:", error);
      if (error.name === 'NotAllowedError') {
        toast.error("กรุณาอนุญาตการใช้กล้อง");
      } else if (error.name === 'NotFoundError') {
        toast.error("ไม่พบกล้อง");
      } else {
        toast.error("ไม่สามารถเปิดกล้องได้");
      }
    }
  }, [stopScanning, playBeep]);

  useEffect(() => {
    if (isOpen) {
      hasScannedRef.current = false;
      setLastScannedCode(null);
      setShowManualInput(false);
      setManualBarcode("");
      
      const timer = setTimeout(() => {
        startScanning();
      }, 300);

      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [isOpen, startScanning, stopScanning]);

  const handleRescan = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hasScannedRef.current = false;
    setLastScannedCode(null);
    setShowManualInput(false);
    setManualBarcode("");
    startScanning();
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lastScannedCode) {
      onScan(lastScannedCode);
      onClose();
    }
  };

  const handleManualSubmit = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const code = manualBarcode.trim();
    if (code) {
      playBeep();
      onScan(code);
      onClose();
    } else {
      toast.error("กรุณากรอกบาร์โค้ด");
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stopScanning();
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
      onTouchStart={(e) => e.stopPropagation()}
      style={{ touchAction: 'none' }}
    >
      <div 
        className="bg-background rounded-lg shadow-2xl max-w-lg w-full overflow-hidden border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            <h3 className="font-semibold">สแกนบาร์โค้ด</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowManualInput(!showManualInput);
              }}
              type="button"
            >
              <Keyboard className="h-4 w-4 mr-1" />
              พิมพ์เอง
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose} type="button">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 bg-background">
          {showManualInput && (
            <div className="flex gap-2">
              <Input
                placeholder="กรอกบาร์โค้ด..."
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleManualSubmit();
                  }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <Button onClick={handleManualSubmit} type="button">ยืนยัน</Button>
            </div>
          )}

          {!lastScannedCode && !showManualInput && (
            <>
              <div
                id="barcode-scanner"
                className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-black"
              />
              <p className="text-sm text-muted-foreground text-center">
                จัดบาร์โค้ดให้อยู่ในกรอบ แล้วถือนิ่งๆ
              </p>
            </>
          )}

          {lastScannedCode && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">บาร์โค้ดที่สแกนได้:</p>
              <p className="text-xl font-mono font-bold text-center py-2 break-all">{lastScannedCode}</p>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleRescan}
                  type="button"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  สแกนใหม่
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleConfirm}
                  type="button"
                >
                  <Check className="mr-2 h-4 w-4" />
                  ใช้บาร์โค้ดนี้
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
