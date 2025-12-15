#!/bin/bash

# Test PostgreSQL Connection Script
# This script helps you test and parse PostgreSQL connection strings

echo "================================================================================"
echo "PostgreSQL Connection Tester"
echo "================================================================================"
echo ""

# Method 1: Use the connection string from .env.local
if [ -f .env.local ]; then
    echo "📋 Found .env.local file"
    POSTGRES_URL=$(grep POSTGRES_URL .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    if [ -z "$POSTGRES_URL" ]; then
        echo "❌ POSTGRES_URL not found in .env.local"
    else
        echo "✅ Found POSTGRES_URL in .env.local"
        echo ""
        echo "Testing connection..."
        echo ""
        
        # Extract components for display (without showing password)
        USER=$(echo $POSTGRES_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
        HOST=$(echo $POSTGRES_URL | sed -n 's/.*@\([^/]*\)\/.*/\1/p')
        DB=$(echo $POSTGRES_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        
        echo "Connection details:"
        echo "  User: $USER"
        echo "  Host: $HOST"
        echo "  Database: $DB"
        echo ""
        
        # Test connection
        psql "$POSTGRES_URL" -c "SELECT version();" 2>&1
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ Connection successful!"
            echo ""
            echo "You can now run SQL commands:"
            echo "  psql \"$POSTGRES_URL\" -c \"YOUR_SQL_COMMAND\""
            echo ""
            echo "Or connect interactively:"
            echo "  psql \"$POSTGRES_URL\""
        else
            echo ""
            echo "❌ Connection failed!"
            echo ""
            echo "Troubleshooting:"
            echo "1. Check if password contains special characters that need URL encoding"
            echo "2. Verify the connection string is correct"
            echo "3. Check if database endpoint is accessible"
        fi
    fi
else
    echo "❌ .env.local file not found"
    echo ""
    echo "Please create .env.local with:"
    echo "  POSTGRES_URL=postgresql://user:password@host:port/database?sslmode=require"
fi

echo ""
echo "================================================================================"
echo "Password Encoding Helper"
echo "================================================================================"
echo ""
echo "If your password contains special characters, you need to URL-encode them:"
echo ""
echo "Special characters and their encodings:"
echo "  @  -> %40"
echo "  #  -> %23"
echo "  \$  -> %24"
echo "  %  -> %25"
echo "  &  -> %26"
echo "  +  -> %2B"
echo "  =  -> %3D"
echo "  ?  -> %3F"
echo "  /  -> %2F"
echo "  :  -> %3A"
echo "  ;  -> %3B"
echo "  (space) -> %20"
echo ""
echo "Example:"
echo "  Password: 'my@pass#word'"
echo "  Encoded:  'my%40pass%23word'"
echo ""
echo "Python one-liner to encode:"
echo "  python3 -c \"import urllib.parse; print(urllib.parse.quote('YOUR_PASSWORD', safe=''))\""
echo ""

