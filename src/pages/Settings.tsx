import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export default function Settings() {
  const [webhookUrl, setWebhookUrl] = useState("https://project221.app.n8n.cloud/webhook-test/project");
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    if (!webhookUrl.trim()) {
      toast.error('กรุณากรอก Webhook URL');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          sync_type: 'manual',
          source: 'pos_system',
        }),
      });

      toast.success('ส่งข้อมูลไปยัง Webhook สำเร็จ! กรุณาตรวจสอบใน n8n workflow');
    } catch (error) {
      console.error('Webhook error:', error);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ Webhook');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllData = async () => {
    setSyncing(true);
    try {
      // In a real implementation, this would fetch all data and send to webhook
      await handleSync();
      toast.success('เริ่มต้นการ Sync ข้อมูลทั้งหมดแล้ว');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold text-primary">ตั้งค่า</h1>
          <p className="text-muted-foreground">จัดการการตั้งค่าระบบและการซิงค์ข้อมูล</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>การซิงค์ข้อมูลกับ Google Sheets</CardTitle>
            <CardDescription>
              เชื่อมต่อกับ n8n Webhook เพื่อซิงค์ข้อมูลไปยัง Google Sheets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook">Webhook URL</Label>
              <Input
                id="webhook"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-n8n-instance.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                URL ของ n8n webhook ที่จะรับข้อมูลเพื่อส่งไปยัง Google Sheets
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <h3 className="font-semibold">การทำงาน:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>ระบบจะส่งข้อมูลไปยัง Webhook URL ที่กำหนด</li>
                <li>n8n จะรับข้อมูลและประมวลผล</li>
                <li>n8n จะอัพเดทข้อมูลลงใน Google Sheets</li>
              </ol>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button onClick={handleSync} disabled={syncing} className="flex-1">
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'กำลังซิงค์...' : 'ทดสอบการเชื่อมต่อ'}
              </Button>
              <Button onClick={handleSyncAllData} disabled={syncing} variant="secondary" className="flex-1">
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                Sync ข้อมูลทั้งหมด
              </Button>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">💡 ตัวอย่าง n8n Workflow:</p>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>1. Webhook Trigger - รับข้อมูลจากระบบ POS</li>
                <li>2. Set Node - จัดรูปแบบข้อมูล</li>
                <li>3. Google Sheets Node - เขียนข้อมูลลงชีท</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลระบบ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">เวอร์ชัน:</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">สถานศึกษา:</span>
              <span className="font-medium">วิทยาลัยเทคนิควังน้ำเย็น</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">สาขา:</span>
              <span className="font-medium">เทคโนโลยีสารสนเทศ</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
