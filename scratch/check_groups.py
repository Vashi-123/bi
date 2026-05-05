import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

import database

try:
    conn = database.get_connection()
    # Manually trigger group refresh
    database.refresh_groups_table()
    
    # Check custom_groups
    res = conn.execute("SELECT COUNT(*) FROM custom_groups").fetchone()
    print(f"custom_groups count: {res[0]}")
    
    # Check filter options for Groupclient
    options = database.get_filter_options('Groupclient')
    print(f"Groupclient options: {options}")

    # Check filter options for CountryGroup
    options_country = database.get_filter_options('CountryGroup')
    print(f"CountryGroup options: {options_country}")

except Exception as e:
    print(f"Error: {e}")
