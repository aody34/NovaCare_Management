-- Optional cleanup for repeatable local seeding
truncate table public.transaction_items restart identity cascade;
truncate table public.transactions restart identity cascade;
delete from public.medicines;
delete from public.settings;

insert into public.settings (
  store_name,
  currency,
  tax_rate,
  prices_include_tax,
  address,
  phone,
  support_email,
  updated_at
)
values (
  'NovaCare Pharmacy',
  'USD',
  0,
  false,
  '145 Cedar Avenue, Portland, OR 97204',
  '+1 (503) 555-0144',
  'support@novacarepharmacy.com',
  now()
);

insert into public.medicines (sku, name, category, price, stock, expiry) values
('RET-0001', 'Paracetamol 500mg', 'Pain Relief', 4.50, 62, '2027-06-14'),
('RET-0002', 'Ibuprofen 200mg', 'Pain Relief', 6.20, 8, '2027-09-22'),
('RET-0003', 'Aspirin 81mg', 'Pain Relief', 5.10, 5, '2026-11-10'),
('RET-0004', 'Amoxicillin 250mg', 'Antibiotic', 12.90, 25, '2026-08-20'),
('RET-0005', 'Azithromycin 500mg', 'Antibiotic', 18.40, 9, '2026-07-15'),
('RET-0006', 'Cetirizine 10mg', 'Allergy', 5.95, 45, '2028-02-18'),
('RET-0007', 'Loratadine 10mg', 'Allergy', 6.30, 33, '2027-12-30'),
('RET-0008', 'Omeprazole 20mg', 'Digestive', 9.15, 13, '2026-10-05'),
('RET-0009', 'Famotidine 20mg', 'Digestive', 8.75, 7, '2026-04-19'),
('RET-0010', 'Metformin 500mg', 'Diabetes', 10.80, 29, '2027-01-22'),
('RET-0011', 'Insulin Glargine', 'Diabetes', 42.40, 4, '2025-12-01'),
('RET-0012', 'Lisinopril 10mg', 'Cardiology', 8.40, 6, '2026-05-01'),
('RET-0013', 'Atorvastatin 20mg', 'Cardiology', 14.90, 31, '2027-03-12'),
('RET-0014', 'Amlodipine 5mg', 'Cardiology', 9.95, 18, '2027-09-18'),
('RET-0015', 'Vitamin C 1000mg', 'Supplements', 3.10, 52, null),
('RET-0016', 'Vitamin D3 2000 IU', 'Supplements', 7.20, 40, null),
('RET-0017', 'Zinc 50mg', 'Supplements', 4.25, 10, null),
('RET-0018', 'Hydrocortisone Cream 1%', 'Skin Care', 6.80, 12, '2027-07-09'),
('RET-0019', 'Clotrimazole Cream', 'Skin Care', 5.90, 9, '2026-09-17'),
('RET-0020', 'Saline Nasal Spray', 'ENT', 4.10, 27, null),
('RET-0021', 'Cough Syrup Dextromethorphan', 'Respiratory', 7.85, 21, '2027-02-28'),
('RET-0022', 'Sodium Bicarbonate Antacid', 'Digestive', 2.60, 11, '2025-09-05');

-- Explicitly include a couple expired items for status badge testing
update public.medicines set expiry = current_date - interval '12 days' where sku = 'RET-0011';
update public.medicines set expiry = current_date - interval '20 days' where sku = 'RET-0022';
