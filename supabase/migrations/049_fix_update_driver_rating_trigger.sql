-- Migration: Fix update_driver_rating trigger
-- The drivers table does not have total_ratings column; this ensures the trigger only updates rating.
-- Fixes: "column total_ratings of relation drivers does not exist"

CREATE OR REPLACE FUNCTION update_driver_rating()
RETURNS TRIGGER AS $$
DECLARE
    driver_record_id UUID;
    user_being_rated UUID;
BEGIN
    -- Resolve who is being rated: to_user_id (old) or rated_user (new schema)
    user_being_rated := COALESCE(NEW.rated_user, NEW.to_user_id);
    
    -- Only update if customer is rating driver (is_from_customer or rater_type = 'customer')
    IF (NEW.is_from_customer = true OR NEW.rater_type = 'customer') AND user_being_rated IS NOT NULL THEN
        SELECT d.id INTO driver_record_id
        FROM drivers d
        WHERE d.user_id = user_being_rated;
        
        IF driver_record_id IS NOT NULL THEN
            UPDATE drivers
            SET 
                rating = (
                    SELECT AVG(r.rating)::DECIMAL(3,2)
                    FROM ratings r
                    JOIN drivers d ON d.user_id = COALESCE(r.rated_user, r.to_user_id)
                    WHERE d.id = driver_record_id
                      AND (r.is_from_customer = true OR r.rater_type = 'customer')
                ),
                updated_at = NOW()
            WHERE id = driver_record_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists from 001_initial_schema; ensure it uses updated function
DROP TRIGGER IF EXISTS update_driver_rating_trigger ON ratings;
CREATE TRIGGER update_driver_rating_trigger
    AFTER INSERT ON ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_driver_rating();
