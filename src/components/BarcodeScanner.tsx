import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { toast } from "sonner";

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, isOpen, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isOpen && !isScanning) {
      startScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async () => {
    try {
      console.log("Starting barcode scanner...");
      const html5QrCode = new Html5Qrcode("barcode-scanner");
      scannerRef.current = html5QrCode;

      const config: any = {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,

        (decodedText) => {
          console.log("Barcode scanned:", decodedText);
          toast.success(`สแกนบาร์โค้ดสำเร็จ: ${decodedText}`);
          onScan(decodedText);
          stopScanning();
          onClose();
        },
        (errorMessage) => {
          // Ignore frequent scanning errors (this fires rapidly)
        }
      );

      setIsScanning(true);
      console.log("Scanner started successfully");
    } catch (error: any) {
      console.error("Error starting scanner:", error);
      if (error.name === 'NotAllowedError') {
        toast.error("กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์");
      } else if (error.name === 'NotFoundError') {
        toast.error("ไม่พบกล้อง กรุณาตรวจสอบอุปกรณ์");
      } else {
        toast.error("ไม่สามารถเปิดกล้องได้: " + error.message);
      }
      onClose();
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (error) {
        console.error("Error stopping scanner:", error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            <h3 className="font-semibold">สแกนบาร์โค้ด</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              stopScanning();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">
          <div
            id="barcode-scanner"
            className="w-full rounded-lg overflow-hidden bg-black"
          ></div>
          <p className="text-sm text-muted-foreground text-center mt-4">
            จ่อบาร์โค้ดเข้ากล้องเพื่อสแกน
          </p>
        </div>
      </div>
    </div>
  );
}
