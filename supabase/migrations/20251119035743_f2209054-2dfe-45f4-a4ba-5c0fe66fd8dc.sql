-- Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_level integer NOT NULL DEFAULT 10,
  category text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create stock_movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  movement_type text NOT NULL, -- 'in' or 'out'
  quantity integer NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sales table
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount decimal(10,2) NOT NULL DEFAULT 0,
  payment_method text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create sales_items table
CREATE TABLE public.sales_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) NOT NULL,
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  subtotal decimal(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'staff',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for stock_movements
CREATE POLICY "Anyone can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert stock movements"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for sales
CREATE POLICY "Anyone can view sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for sales_items
CREATE POLICY "Anyone can view sales items"
  ON public.sales_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sales items"
  ON public.sales_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to update updated_at on products
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for products and sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;