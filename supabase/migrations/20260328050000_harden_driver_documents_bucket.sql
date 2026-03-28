-- Harden driver document uploads while keeping existing browser-view support.
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view driver documents" on storage.objects;
drop policy if exists "Drivers can upload documents" on storage.objects;
drop policy if exists "Drivers can update their own documents" on storage.objects;
drop policy if exists "Drivers can delete their own documents" on storage.objects;
drop policy if exists "Public can view driver documents" on storage.objects;
drop policy if exists "Drivers can insert validated driver documents" on storage.objects;
drop policy if exists "Drivers can update validated driver documents" on storage.objects;
drop policy if exists "Drivers can delete validated driver documents" on storage.objects;

create policy "Public can view driver documents"
on storage.objects for select
to public
using (bucket_id = 'driver-documents');

create policy "Drivers can insert validated driver documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'pdf'])
);

create policy "Drivers can update validated driver documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and lower(storage.extension(name)) = any (array['jpg', 'jpeg', 'png', 'webp', 'pdf'])
);

create policy "Drivers can delete validated driver documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
