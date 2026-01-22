-- Add DELETE policy for sales_items
CREATE POLICY "Authenticated users can delete sales items" 
ON public.sales_items 
FOR DELETE 
USING (true);

-- Add DELETE policy for stock_movements
CREATE POLICY "Authenticated users can delete stock movements" 
ON public.stock_movements 
FOR DELETE 
USING (true);