-- สร้างตารางรายรับรายจ่าย
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- เปิดใช้งาน RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- สร้าง policy สำหรับดูข้อมูล
CREATE POLICY "Anyone can view transactions"
ON public.transactions
FOR SELECT
USING (true);

-- สร้าง policy สำหรับเพิ่มข้อมูล
CREATE POLICY "Authenticated users can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (true);

-- สร้าง policy สำหรับลบข้อมูล
CREATE POLICY "Authenticated users can delete transactions"
ON public.transactions
FOR DELETE
USING (true);

-- สร้าง trigger สำหรับ updated_at
CREATE TRIGGER update_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- เปิดใช้งาน realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;