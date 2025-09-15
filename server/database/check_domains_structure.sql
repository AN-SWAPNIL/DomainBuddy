-- Quick verification script to check your domains table structure
-- Run this in Supabase SQL editor to see the actual column types

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns 
WHERE 
    table_name = 'domains' 
    AND table_schema = 'public'
ORDER BY 
    ordinal_position;
