-- Create FAQs table
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    target_audience VARCHAR(50) DEFAULT 'all' CHECK (target_audience IN ('customer', 'driver', 'all')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- Policies
-- Everyone can read active FAQs
DROP POLICY IF EXISTS "Anyone can view active faqs" ON faqs;
CREATE POLICY "Anyone can view active faqs" ON faqs
    FOR SELECT USING (is_active = true);

-- Only admins can manage FAQs
DROP POLICY IF EXISTS "Admins can manage faqs" ON faqs;
CREATE POLICY "Admins can manage faqs" ON faqs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE faqs;

-- Trigger to update updated_at
CREATE TRIGGER update_faqs_updated_at
    BEFORE UPDATE ON faqs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
