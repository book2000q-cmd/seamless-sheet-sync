import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, RotateCcw, Check, Keyboard, Scan, ZoomIn, Sun } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, isOpen, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const detectionCountRef = useRef(0);
  const lastDetectedCodeRef = useRef<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "detected" | "success">("idle");
  const [hintMessage, setHintMessage] = useState<string>("");

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
        setHintMessage("");
        detectionCountRef.current = 0;
        lastDetectedCodeRef.current = null;
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
        gainNode.gain.value = 0.3;

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

  const vibrate = useCallback(() => {
    try {
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
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
    setHintMessage("จ่อกล้องไปที่บาร์โค้ด");
    detectionCountRef.current = 0;
    lastDetectedCodeRef.current = null;

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

      // Advanced camera constraints for better scanning
      const cameraConstraints: MediaTrackConstraints = {
        facingMode: "environment",
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
        // Advanced settings for better barcode detection
        // @ts-ignore - These are valid but not in TypeScript definitions
        focusMode: "continuous",
        // @ts-ignore
        exposureMode: "continuous",
        // @ts-ignore
        whiteBalanceMode: "continuous",
      };

      await html5QrCode.start(
        { 
          facingMode: "environment",
        },
        {
          // Maximum FPS for real-time scanning
          fps: 30,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            // Larger scanning area for easier capture
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const maxEdge = Math.max(viewfinderWidth, viewfinderHeight);
            // Make box wider to capture full barcode
            const boxWidth = Math.floor(maxEdge * 0.85);
            const boxHeight = Math.floor(minEdge * 0.4);
            return { 
              width: Math.max(Math.min(boxWidth, viewfinderWidth - 40), 280), 
              height: Math.max(Math.min(boxHeight, 200), 100) 
            };
          },
          aspectRatio: 1.777, // 16:9 for better horizontal coverage
          disableFlip: false,
        },
        (decodedText) => {
          if (hasScannedRef.current) return;
          
          const code = decodedText.trim();
          
          // Quick confirmation - just 1 frame confirmation for speed
          if (lastDetectedCodeRef.current === code) {
            detectionCountRef.current++;
          } else {
            lastDetectedCodeRef.current = code;
            detectionCountRef.current = 1;
          }

          // Show detected state immediately
          if (detectionCountRef.current === 1) {
            setScanStatus("detected");
            setHintMessage("พบบาร์โค้ด! กำลังยืนยัน...");
          }

          // Confirm after just 1-2 frames (almost instant)
          if (detectionCountRef.current >= 1) {
            hasScannedRef.current = true;
            setScanStatus("success");
            setHintMessage("สแกนสำเร็จ!");
            setLastScannedCode(code);
            playBeep();
            vibrate();
            toast.success(`สแกนสำเร็จ: ${code}`);
            
            // CRITICAL: Blur any focused input to hide keyboard on mobile
            if (document.activeElement instanceof HTMLElement) {
              document.activeElement.blur();
            }
            
            stopScanning();
          }
        },
        (errorMessage) => {
          // Use error callback to provide hints
          if (errorMessage.includes("No barcode")) {
            // Don't spam - only update occasionally
            const now = Date.now();
            if (!startScanning.lastHintTime || now - startScanning.lastHintTime > 2000) {
              startScanning.lastHintTime = now;
              setHintMessage("จัดบาร์โค้ดให้อยู่ในกรอบสีเขียว");
            }
          }
        }
      );

      // Try to apply advanced camera settings after start
      try {
        const videoElement = document.querySelector('#barcode-scanner video') as HTMLVideoElement;
        if (videoElement && videoElement.srcObject) {
          const track = (videoElement.srcObject as MediaStream).getVideoTracks()[0];
          if (track) {
            const capabilities = track.getCapabilities?.();
            const settings: MediaTrackConstraintSet = {};
            
            // Apply continuous focus if supported
            // @ts-ignore
            if (capabilities?.focusMode?.includes?.('continuous')) {
              // @ts-ignore
              settings.focusMode = 'continuous';
            }
            
            // Apply continuous exposure if supported
            // @ts-ignore
            if (capabilities?.exposureMode?.includes?.('continuous')) {
              // @ts-ignore
              settings.exposureMode = 'continuous';
            }

            // Increase exposure compensation for better visibility
            // @ts-ignore
            if (capabilities?.exposureCompensation) {
              // @ts-ignore
              settings.exposureCompensation = 0.5;
            }

            if (Object.keys(settings).length > 0) {
              await track.applyConstraints({ advanced: [settings] } as any);
            }
          }
        }
      } catch (e) {
        console.warn("Could not apply advanced camera settings:", e);
      }

      setIsScanning(true);
    } catch (error: any) {
      console.error("Scanner start error:", error);
      setScanStatus("idle");
      setHintMessage("");
      if (error.name === 'NotAllowedError') {
        toast.error("กรุณาอนุญาตการใช้กล้อง");
      } else if (error.name === 'NotFoundError') {
        toast.error("ไม่พบกล้อง");
      } else {
        toast.error("ไม่สามารถเปิดกล้องได้");
      }
    }
  }, [stopScanning, playBeep, vibrate]) as any;

  useEffect(() => {
    if (isOpen) {
      hasScannedRef.current = false;
      detectionCountRef.current = 0;
      lastDetectedCodeRef.current = null;
      setLastScannedCode(null);
      setShowManualInput(false);
      setManualBarcode("");
      setScanStatus("idle");
      setHintMessage("");
      
      const timer = setTimeout(() => {
        startScanning();
      }, 200); // Faster start

      return () => clearTimeout(timer);
    } else {
      stopScanning();
    }
  }, [isOpen, startScanning, stopScanning]);

  const handleRescan = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Blur any focused element first to prevent keyboard from showing
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    hasScannedRef.current = false;
    detectionCountRef.current = 0;
    lastDetectedCodeRef.current = null;
    setLastScannedCode(null);
    setShowManualInput(false);
    setManualBarcode("");
    setScanStatus("idle");
    setHintMessage("");
    startScanning();
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Blur any focused element to hide keyboard
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
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
        return "เตรียมกล้อง...";
    }
  };

  const getFrameColor = () => {
    switch (scanStatus) {
      case "success":
        return "border-green-400";
      case "detected":
        return "border-yellow-400";
      case "scanning":
        return "border-green-500";
      default:
        return "border-white/50";
    }
  };

  const getFrameGlow = () => {
    switch (scanStatus) {
      case "success":
        return "0 0 40px rgba(74, 222, 128, 0.6), inset 0 0 20px rgba(74, 222, 128, 0.2)";
      case "detected":
        return "0 0 30px rgba(250, 204, 21, 0.5), inset 0 0 15px rgba(250, 204, 21, 0.15)";
      case "scanning":
        return "0 0 25px rgba(34, 197, 94, 0.4)";
      default:
        return "none";
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
      <div className="flex items-center justify-between p-3 bg-gradient-to-b from-black/90 to-transparent absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/20 rounded-full">
            <Camera className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">สแกนบาร์โค้ด</h3>
            <p className="text-xs text-green-400">{getStatusText()}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/20 text-sm px-3"
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
            <Keyboard className="h-4 w-4 mr-1" />
            พิมพ์เอง
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/20"
            onClick={handleClose} 
            type="button"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Manual Input */}
      {showManualInput && (
        <div className="p-4 bg-black/90 backdrop-blur-sm mt-16 z-10">
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
              className="h-12 px-6 bg-green-600 hover:bg-green-700"
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
          
          {/* Custom Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Semi-transparent overlay with cutout */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Top dark area */}
              <div className="absolute top-0 left-0 right-0 h-[30%] bg-black/60" />
              {/* Bottom dark area */}
              <div className="absolute bottom-0 left-0 right-0 h-[30%] bg-black/60" />
              {/* Left dark area */}
              <div className="absolute top-[30%] left-0 w-[5%] h-[40%] bg-black/60" />
              {/* Right dark area */}
              <div className="absolute top-[30%] right-0 w-[5%] h-[40%] bg-black/60" />
            </div>
            
            {/* Scanning Frame - centered and large */}
            <div className="absolute top-[30%] left-[5%] right-[5%] h-[40%] flex items-center justify-center">
              <div 
                className={`relative w-full h-full max-h-[180px] border-[3px] rounded-xl transition-all duration-200 ${getFrameColor()}`}
                style={{ boxShadow: getFrameGlow() }}
              >
                {/* Corner brackets - more visible */}
                <div className="absolute -top-[2px] -left-[2px] w-10 h-10 border-t-4 border-l-4 border-green-400 rounded-tl-lg" />
                <div className="absolute -top-[2px] -right-[2px] w-10 h-10 border-t-4 border-r-4 border-green-400 rounded-tr-lg" />
                <div className="absolute -bottom-[2px] -left-[2px] w-10 h-10 border-b-4 border-l-4 border-green-400 rounded-bl-lg" />
                <div className="absolute -bottom-[2px] -right-[2px] w-10 h-10 border-b-4 border-r-4 border-green-400 rounded-br-lg" />
                
                {/* Animated scan line */}
                {scanStatus === "scanning" && (
                  <div 
                    className="absolute left-2 right-2 h-[3px] bg-gradient-to-r from-transparent via-green-400 to-transparent rounded-full"
                    style={{
                      animation: 'scanLineMove 1.5s ease-in-out infinite'
                    }}
                  />
                )}

                {/* Detection pulse effect */}
                {scanStatus === "detected" && (
                  <div className="absolute inset-0 rounded-xl bg-yellow-400/20 animate-pulse" />
                )}

                {/* Success flash */}
                {scanStatus === "success" && (
                  <div className="absolute inset-0 rounded-xl bg-green-400/30" />
                )}
              </div>
            </div>

            {/* Hint Message - dynamic feedback */}
            <div className="absolute bottom-[22%] left-0 right-0 text-center px-4">
              <div className="inline-block bg-black/80 backdrop-blur-sm rounded-full py-3 px-6">
                <p className="text-white text-base font-medium">
                  {hintMessage || "จัดบาร์โค้ดให้อยู่ในกรอบ"}
                </p>
              </div>
            </div>

            {/* Tips at bottom */}
            <div className="absolute bottom-4 left-0 right-0 text-center px-4">
              <div className="flex justify-center gap-4 text-gray-400 text-xs">
                <span className="flex items-center gap-1">
                  <ZoomIn className="h-3 w-3" />
                  ขยับเข้าใกล้
                </span>
                <span className="flex items-center gap-1">
                  <Sun className="h-3 w-3" />
                  หาที่สว่าง
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Result - Confirm Mode (No Input Fields!) */}
      {lastScannedCode && (
        <div 
          className="flex-1 flex items-center justify-center p-6 bg-gradient-to-b from-black to-gray-900"
          onClick={(e) => {
            // Prevent any focus events
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="w-full max-w-md">
            {/* Success Icon with animation */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center animate-bounce-once">
                <Check className="h-10 w-10 text-green-500" />
              </div>
            </div>

            {/* Result Card - READ ONLY, NO INPUT FIELD */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <p className="text-gray-500 text-sm mb-2 text-center">บาร์โค้ดที่สแกนได้</p>
              
              {/* Read-only barcode display - NOT an input to prevent keyboard */}
              <div 
                className="text-2xl font-mono font-bold text-center text-gray-900 py-4 break-all tracking-wider bg-gray-50 rounded-lg select-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {lastScannedCode}
              </div>
              
              {/* Action Buttons - Large and Easy to Tap */}
              <div className="flex gap-3 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1 h-14 text-base border-2" 
                  onClick={handleRescan}
                  type="button"
                  tabIndex={-1}
                >
                  <RotateCcw className="mr-2 h-5 w-5" />
                  สแกนใหม่
                </Button>
                <Button 
                  className="flex-1 h-14 text-base bg-green-600 hover:bg-green-700 shadow-lg" 
                  onClick={handleConfirm}
                  type="button"
                  tabIndex={-1}
                >
                  <Check className="mr-2 h-5 w-5" />
                  ใช้บาร์โค้ดนี้
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes scanLineMove {
          0% {
            top: 15%;
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 85%;
            opacity: 0.5;
          }
        }
        
        @keyframes bounce-once {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
        
        .animate-bounce-once {
          animation: bounce-once 0.3s ease-out;
        }
        
        #barcode-scanner video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        /* Hide the default scanning box from html5-qrcode */
        #barcode-scanner > div,
        #barcode-scanner canvas {
          display: none !important;
        }
        
        #barcode-scanner img {
          display: none !important;
        }
      `}</style>
    </div>
  );
}
