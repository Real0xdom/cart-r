-- Setup Driver Documents Storage Bucket
insert into storage.buckets (id, name, public) 
values ('driver-documents', 'driver-documents', true)
on conflict (id) do nothing;

-- Enable RLS
alter table storage.objects enable row level security;

-- Policy 1: Anyone can view driver documents (public urls)
create policy "Anyone can view driver documents"
on storage.objects for select
to public
using ( bucket_id = 'driver-documents' );

-- Policy 2: Drivers can upload documents
create policy "Drivers can upload documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'driver-documents' );

-- Policy 3: Drivers can update their own documents
create policy "Drivers can update their own documents"
on storage.objects for update
to authenticated
using ( bucket_id = 'driver-documents' and auth.uid() = owner );

-- Policy 4: Drivers can delete their own documents
create policy "Drivers can delete their own documents"
on storage.objects for delete
to authenticated
using ( bucket_id = 'driver-documents' and auth.uid() = owner );
