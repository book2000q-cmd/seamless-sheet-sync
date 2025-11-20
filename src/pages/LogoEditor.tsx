import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export default function LogoEditor() {
  const [loading, setLoading] = useState(false);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);

  const handleEditLogos = async () => {
    setLoading(true);
    try {
      // Convert image to base64
      const response = await fetch('/temp-logos.png');
      const blob = await response.blob();
      
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;

        // Call edge function to edit image
        const { data, error } = await supabase.functions.invoke('edit-logo-image', {
          body: {
            imageUrl: base64data,
            prompt: "Remove all white background from both circular logos. Make the backgrounds completely transparent outside the circular shapes. Keep both logos perfectly circular with transparent backgrounds. Remove any white borders or padding."
          }
        });

        if (error) throw error;

        if (data.imageUrl) {
          setEditedImageUrl(data.imageUrl);
          toast.success('แก้ไขรูปภาพสำเร็จ!');
        } else {
          throw new Error('ไม่มีรูปภาพที่แก้ไขแล้ว');
        }
      };
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!editedImageUrl) return;

    // Convert base64 to blob and download
    const link = document.createElement('a');
    link.href = editedImageUrl;
    link.download = 'logos-edited.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดสำเร็จ!');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">แก้ไขโลโก้</h1>
          <p className="text-muted-foreground">ลบพื้นหลังสีขาวและทำให้อยู่ในวงกลม</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>รูปภาพต้นฉบับ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <img 
                  src="/temp-logos.png" 
                  alt="Original logos" 
                  className="w-full h-auto"
                />
              </div>
              <Button 
                onClick={handleEditLogos} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังแก้ไข...
                  </>
                ) : (
                  'แก้ไขรูปภาพ'
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>รูปภาพที่แก้ไขแล้ว</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editedImageUrl ? (
                <>
                  <div className="bg-muted p-4 rounded-lg">
                    <img 
                      src={editedImageUrl} 
                      alt="Edited logos" 
                      className="w-full h-auto"
                    />
                  </div>
                  <Button 
                    onClick={handleDownload}
                    variant="outline"
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    ดาวน์โหลดรูปภาพ
                  </Button>
                </>
              ) : (
                <div className="bg-muted p-8 rounded-lg text-center text-muted-foreground">
                  กดปุ่ม "แก้ไขรูปภาพ" เพื่อเริ่มต้น
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>คำแนะนำ</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
              <li>ระบบจะลบพื้นหลังสีขาวออกจากทั้งสองโลโก้</li>
              <li>โลโก้จะอยู่ในวงกลมที่สมบูรณ์</li>
              <li>พื้นหลังนอกวงกลมจะโปร่งใส</li>
              <li>เหมาะสำหรับใช้บนพื้นหลังสีต่างๆ</li>
              <li>หลังแก้ไขเสร็จสามารถดาวน์โหลดรูปภาพได้</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
