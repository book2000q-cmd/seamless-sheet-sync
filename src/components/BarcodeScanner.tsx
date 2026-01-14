import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, RotateCcw, Check, Keyboard, Scan } from "lucide-react";
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
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "detected" | "success">("idle");

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
        setScanStatus("idle");
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
        gainNode.gain.value = 0.2;

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 150);
      }
    } catch (e) {
      console.warn("Beep failed", e);
    }
  }, []);

  const vibrate = useCallback(() => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch (e) {
      console.warn("Vibrate failed", e);
    }
  }, []);

  const startScanning = useCallback(async () => {
    if (scannerRef.current) {
      await stopScanning();
    }

    setScanStatus("scanning");

    try {
      const element = document.getElementById("barcode-scanner");
      if (!element) {
        toast.error("ไม่พบ element สำหรับแสดงกล้อง");
        return;
      }

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
          Html5QrcodeSupportedFormats.AZTEC,
          Html5QrcodeSupportedFormats.PDF_417,
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { 
          facingMode: "environment",
        },
        {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxWidth = Math.floor(minEdge * 0.85);
            const boxHeight = Math.floor(minEdge * 0.45);
            return { width: Math.max(boxWidth, 250), height: Math.max(boxHeight, 120) };
          },
          aspectRatio: 1.333,
          disableFlip: false,
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          
          hasScannedRef.current = true;
          const code = decodedText.trim();
          
          setScanStatus("success");
          setLastScannedCode(code);
          playBeep();
          vibrate();
          toast.success(`สแกนสำเร็จ: ${code}`);
          stopScanning();
        },
        () => {}
      );

      setIsScanning(true);
    } catch (error: any) {
      console.error("Scanner start error:", error);
      setScanStatus("idle");
      if (error.name === 'NotAllowedError') {
        toast.error("กรุณาอนุญาตการใช้กล้อง");
      } else if (error.name === 'NotFoundError') {
        toast.error("ไม่พบกล้อง");
      } else {
        toast.error("ไม่สามารถเปิดกล้องได้");
      }
    }
  }, [stopScanning, playBeep, vibrate]);

  useEffect(() => {
    if (isOpen) {
      hasScannedRef.current = false;
      setLastScannedCode(null);
      setShowManualInput(false);
      setManualBarcode("");
      setScanStatus("idle");
      
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
    setScanStatus("idle");
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
      vibrate();
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

  const getStatusText = () => {
    switch (scanStatus) {
      case "scanning":
        return "กำลังสแกน...";
      case "detected":
        return "พบบาร์โค้ด!";
      case "success":
        return "สแกนสำเร็จ!";
      default:
        return "เตรียมพร้อม...";
    }
  };

  const getFrameColor = () => {
    switch (scanStatus) {
      case "success":
        return "border-green-500 shadow-green-500/50";
      case "detected":
        return "border-yellow-400 shadow-yellow-400/50";
      case "scanning":
        return "border-blue-400 shadow-blue-400/30";
      default:
        return "border-gray-400";
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black flex flex-col"
      onClick={handleOverlayClick}
      onTouchStart={(e) => e.stopPropagation()}
      style={{ touchAction: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-full">
            <Camera className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">สแกนบาร์โค้ด</h3>
            <p className="text-sm text-gray-400">{getStatusText()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowManualInput(!showManualInput);
              if (!showManualInput) {
                stopScanning();
              } else {
                startScanning();
              }
            }}
            type="button"
          >
            <Keyboard className="h-5 w-5 mr-2" />
            พิมพ์เอง
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20"
            onClick={handleClose} 
            type="button"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Manual Input */}
      {showManualInput && (
        <div className="p-4 bg-black/80 backdrop-blur-sm">
          <div className="flex gap-3">
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
              className="text-lg h-12 bg-white text-black"
              onClick={(e) => e.stopPropagation()}
            />
            <Button 
              onClick={handleManualSubmit} 
              type="button"
              size="lg"
              className="h-12 px-6"
            >
              ยืนยัน
            </Button>
          </div>
        </div>
      )}

      {/* Scanner View */}
      {!lastScannedCode && !showManualInput && (
        <div className="flex-1 relative overflow-hidden">
          {/* Camera View */}
          <div
            id="barcode-scanner"
            className="absolute inset-0 w-full h-full"
            style={{ background: '#000' }}
          />
          
          {/* Overlay with cutout */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Dark overlay - top */}
            <div className="absolute top-0 left-0 right-0 h-[25%] bg-black/70" />
            {/* Dark overlay - bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[25%] bg-black/70" />
            {/* Dark overlay - left */}
            <div className="absolute top-[25%] left-0 w-[10%] h-[50%] bg-black/70" />
            {/* Dark overlay - right */}
            <div className="absolute top-[25%] right-0 w-[10%] h-[50%] bg-black/70" />
            
            {/* Scanning Frame */}
            <div className="absolute top-[25%] left-[10%] right-[10%] h-[50%] flex items-center justify-center">
              <div 
                className={`relative w-full h-full max-h-[200px] border-4 rounded-2xl transition-all duration-300 ${getFrameColor()}`}
                style={{ 
                  boxShadow: scanStatus === "scanning" 
                    ? '0 0 30px rgba(59, 130, 246, 0.3), inset 0 0 30px rgba(59, 130, 246, 0.1)' 
                    : scanStatus === "success"
                    ? '0 0 40px rgba(34, 197, 94, 0.5), inset 0 0 40px rgba(34, 197, 94, 0.15)'
                    : 'none'
                }}
              >
                {/* Corner decorations */}
                <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-xl" />
                
                {/* Scanning line animation */}
                {scanStatus === "scanning" && (
                  <div 
                    className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-green-400 to-transparent rounded-full animate-pulse"
                    style={{
                      top: '50%',
                      transform: 'translateY(-50%)',
                      animation: 'scanLine 2s ease-in-out infinite'
                    }}
                  />
                )}

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Scan className={`h-12 w-12 ${scanStatus === "scanning" ? "text-green-400 animate-pulse" : "text-gray-400"}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="absolute bottom-8 left-0 right-0 text-center px-4">
            <div className="bg-black/80 backdrop-blur-sm rounded-2xl py-4 px-6 mx-auto max-w-sm">
              <p className="text-white text-lg font-medium mb-1">
                จัดบาร์โค้ดให้อยู่ในกรอบ
              </p>
              <p className="text-gray-400 text-sm">
                ถือนิ่งๆ ระบบจะสแกนอัตโนมัติ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Success Result */}
      {lastScannedCode && (
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-black to-gray-900">
          <div className="w-full max-w-md">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="h-10 w-10 text-green-500" />
              </div>
            </div>

            {/* Result Card */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <p className="text-gray-500 text-sm mb-2 text-center">บาร์โค้ดที่สแกนได้</p>
              <p className="text-3xl font-mono font-bold text-center text-gray-900 py-4 break-all tracking-wider">
                {lastScannedCode}
              </p>
              
              <div className="flex gap-3 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1 h-14 text-base" 
                  onClick={handleRescan}
                  type="button"
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  สแกนใหม่
                </Button>
                <Button 
                  className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700" 
                  onClick={handleConfirm}
                  type="button"
                >
                  <Check className="mr-2 h-5 w-5" />
                  ใช้บาร์โค้ดนี้
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for scan line animation */}
      <style>{`
        @keyframes scanLine {
          0%, 100% {
            opacity: 0.3;
            transform: translateY(-50%) scaleX(0.8);
          }
          50% {
            opacity: 1;
            transform: translateY(-50%) scaleX(1);
          }
        }
        
        #barcode-scanner video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        #barcode-scanner > div {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
