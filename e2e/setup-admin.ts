import { ensureTestAdmin } from './helpers/supabase-admin';
import * as dotenv from 'dotenv';

dotenv.config();

export default async function globalSetup() {
  await ensureTestAdmin();
}
