create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

create table if not exists public.medicines (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text,
  price numeric not null default 0.1 check (price >= 0.1),
  stock integer not null default 0 check (stock >= 0),
  expiry date,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  total numeric not null check (total >= 0),
  tax numeric not null default 0 check (tax >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'insurance')),
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_price numeric not null check (unit_price >= 0.1),
  line_total numeric not null check (line_total >= 0)
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  store_name text,
  currency text not null default 'USD',
  tax_rate numeric not null default 0,
  prices_include_tax boolean not null default false,
  address text,
  phone text,
  support_email text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_medicines_name on public.medicines(name);
create index if not exists idx_medicines_category on public.medicines(category);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at);
create index if not exists idx_transaction_items_transaction_id on public.transaction_items(transaction_id);
create index if not exists idx_transaction_items_medicine_id on public.transaction_items(medicine_id);

create or replace function public.is_admin(check_user uuid default auth.uid())
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user
      and p.role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case
      when lower(coalesce(new.email, '')) = 'apdykadir41@gmail.com' then 'admin'
      else 'staff'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.protect_profile_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role then
      raise exception 'Only admins can change role';
    end if;

    if new.email is distinct from old.email then
      raise exception 'Only admins can change email';
    end if;

    if auth.uid() <> old.id then
      raise exception 'You can only update your own profile';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_profile_updates on public.profiles;
create trigger trg_protect_profile_updates
  before update on public.profiles
  for each row execute function public.protect_profile_updates();

create or replace function public.complete_sale(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_items jsonb := payload -> 'items';
  v_payment_method text := lower(coalesce(payload ->> 'payment_method', 'cash'));
  v_tax_rate numeric := 0;
  v_prices_include_tax boolean := false;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_transaction_id uuid;

  v_item jsonb;
  v_medicine_id uuid;
  v_qty integer;
  v_stock integer;
  v_price numeric;
  v_expiry date;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_payment_method not in ('cash', 'card', 'insurance') then
    raise exception 'Invalid payment method';
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_medicine_id := (v_item ->> 'medicine_id')::uuid;
    v_qty := coalesce((v_item ->> 'qty')::integer, 0);

    if v_medicine_id is null or v_qty <= 0 then
      raise exception 'Invalid sale payload';
    end if;

    select m.stock, m.price, m.expiry
      into v_stock, v_price, v_expiry
    from public.medicines m
    where m.id = v_medicine_id
    for update;

    if not found then
      raise exception 'Medicine not found (%).', v_medicine_id;
    end if;

    if v_expiry is not null and v_expiry < current_date then
      raise exception 'Medicine is expired (%).', v_medicine_id;
    end if;

    if v_stock < v_qty then
      raise exception 'Insufficient stock (%).', v_medicine_id;
    end if;

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  select coalesce(s.tax_rate, 0), coalesce(s.prices_include_tax, false)
    into v_tax_rate, v_prices_include_tax
  from public.settings s
  order by s.updated_at desc
  limit 1;

  if v_prices_include_tax then
    if v_tax_rate > 0 then
      v_tax := round((v_subtotal - (v_subtotal / (1 + (v_tax_rate / 100.0))))::numeric, 2);
    else
      v_tax := 0;
    end if;
    v_total := round(v_subtotal::numeric, 2);
  else
    v_tax := round((v_subtotal * (v_tax_rate / 100.0))::numeric, 2);
    v_total := round((v_subtotal + v_tax)::numeric, 2);
  end if;

  insert into public.transactions (user_id, total, tax, payment_method)
  values (v_user_id, v_total, v_tax, v_payment_method)
  returning id into v_transaction_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_medicine_id := (v_item ->> 'medicine_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;

    select m.price into v_price
    from public.medicines m
    where m.id = v_medicine_id
    for update;

    insert into public.transaction_items (
      transaction_id,
      medicine_id,
      qty,
      unit_price,
      line_total
    )
    values (
      v_transaction_id,
      v_medicine_id,
      v_qty,
      v_price,
      round((v_price * v_qty)::numeric, 2)
    );

    update public.medicines
    set stock = stock - v_qty
    where id = v_medicine_id;
  end loop;

  return v_transaction_id;
end;
$$;

grant execute on function public.complete_sale(jsonb) to authenticated;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.medicines enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;
alter table public.settings enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists medicines_read_authenticated on public.medicines;
create policy medicines_read_authenticated
  on public.medicines
  for select
  to authenticated
  using (true);

drop policy if exists medicines_admin_insert on public.medicines;
create policy medicines_admin_insert
  on public.medicines
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists medicines_admin_update on public.medicines;
create policy medicines_admin_update
  on public.medicines
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists medicines_admin_delete on public.medicines;
create policy medicines_admin_delete
  on public.medicines
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists transactions_read_own_or_admin on public.transactions;
create policy transactions_read_own_or_admin
  on public.transactions
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists transactions_insert_own on public.transactions;
create policy transactions_insert_own
  on public.transactions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists transaction_items_read_own_or_admin on public.transaction_items;
create policy transaction_items_read_own_or_admin
  on public.transaction_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists transaction_items_insert_own_or_admin on public.transaction_items;
create policy transaction_items_insert_own_or_admin
  on public.transaction_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.transactions t
      where t.id = transaction_id
        and (t.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists settings_read_authenticated on public.settings;
create policy settings_read_authenticated
  on public.settings
  for select
  to authenticated
  using (true);

drop policy if exists settings_admin_insert on public.settings;
create policy settings_admin_insert
  on public.settings
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update
  on public.settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists settings_admin_delete on public.settings;
create policy settings_admin_delete
  on public.settings
  for delete
  to authenticated
  using (public.is_admin());
