-- Create function to check if user has any role (staff, manager, or admin)
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Drop existing policies that allow all authenticated users
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

DROP POLICY IF EXISTS "Authenticated users can insert sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated users can insert sales items" ON public.sales_items;
DROP POLICY IF EXISTS "Authenticated users can insert stock movements" ON public.stock_movements;

-- Create new policies for products - only users with roles can modify
CREATE POLICY "Users with roles can insert products"
ON public.products
FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));

CREATE POLICY "Users with roles can update products"
ON public.products
FOR UPDATE
USING (public.has_any_role(auth.uid()));

CREATE POLICY "Users with roles can delete products"
ON public.products
FOR DELETE
USING (public.has_any_role(auth.uid()));

-- Create new policies for sales - only users with roles can create sales
CREATE POLICY "Users with roles can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));

-- Create new policies for sales_items - only users with roles can insert
CREATE POLICY "Users with roles can insert sales items"
ON public.sales_items
FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));

-- Create new policies for stock_movements - only users with roles can insert
CREATE POLICY "Users with roles can insert stock movements"
ON public.stock_movements
FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));

-- Create new policies for transactions - only users with roles can insert
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;
CREATE POLICY "Users with roles can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (public.has_any_role(auth.uid()));