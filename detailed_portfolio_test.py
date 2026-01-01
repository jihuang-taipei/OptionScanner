#!/usr/bin/env python3
"""
Detailed Portfolio Testing for Auto-Expiration Feature
"""
import requests
import json
from datetime import datetime

BASE_URL = "https://finprobe.preview.emergentagent.com"

def test_detailed_portfolio():
    print("🔍 Detailed Portfolio Testing - Auto-Expiration Feature")
    print("=" * 60)
    
    # Test 1: Expire positions
    print("\n1️⃣ Testing Position Expiration...")
    try:
        response = requests.post(f"{BASE_URL}/api/positions/expire", timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Message: {data.get('message', 'No message')}")
            expired_positions = data.get('expired_positions', [])
            print(f"   Expired positions count: {len(expired_positions)}")
            for pos in expired_positions:
                print(f"     - {pos.get('strategy_name', 'Unknown')}: P/L ${pos.get('realized_pnl', 0)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 2: Get all positions
    print("\n2️⃣ Testing Get All Positions...")
    try:
        response = requests.get(f"{BASE_URL}/api/positions", timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            positions = response.json()
            print(f"   Total positions: {len(positions)}")
            
            # Group by status
            status_counts = {}
            for pos in positions:
                status = pos.get('status', 'unknown')
                status_counts[status] = status_counts.get(status, 0) + 1
            
            print("   Status breakdown:")
            for status, count in status_counts.items():
                print(f"     - {status}: {count}")
            
            # Show expired positions details
            expired_positions = [p for p in positions if p.get('status') == 'expired']
            if expired_positions:
                print(f"\n   Expired positions details:")
                for pos in expired_positions:
                    print(f"     - ID: {pos.get('id', 'N/A')}")
                    print(f"       Strategy: {pos.get('strategy_name', 'N/A')}")
                    print(f"       Symbol: {pos.get('symbol', 'N/A')}")
                    print(f"       Expiration: {pos.get('expiration', 'N/A')}")
                    print(f"       Exit Price: ${pos.get('exit_price', 0)}")
                    print(f"       Realized P/L: ${pos.get('realized_pnl', 0)}")
                    print(f"       Closed At: {pos.get('closed_at', 'N/A')}")
                    print()
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 3: Get open positions only
    print("\n3️⃣ Testing Get Open Positions Only...")
    try:
        response = requests.get(f"{BASE_URL}/api/positions?status=open", timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            open_positions = response.json()
            print(f"   Open positions count: {len(open_positions)}")
            for pos in open_positions:
                print(f"     - {pos.get('strategy_name', 'Unknown')}: {pos.get('symbol', 'N/A')}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 4: Get expired positions only
    print("\n4️⃣ Testing Get Expired Positions Only...")
    try:
        response = requests.get(f"{BASE_URL}/api/positions?status=expired", timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            expired_positions = response.json()
            print(f"   Expired positions count: {len(expired_positions)}")
            for pos in expired_positions:
                print(f"     - {pos.get('strategy_name', 'Unknown')}: P/L ${pos.get('realized_pnl', 0)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # Test 5: Portfolio summary
    print("\n5️⃣ Testing Portfolio Summary...")
    try:
        response = requests.get(f"{BASE_URL}/api/portfolio/summary", timeout=30)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            summary = response.json()
            print(f"   Total positions: {summary.get('total_positions', 0)}")
            print(f"   Open positions: {summary.get('open_positions', 0)}")
            print(f"   Closed/Expired positions: {summary.get('closed_positions', 0)}")
            print(f"   Total unrealized P/L: ${summary.get('total_unrealized_pnl', 0)}")
            print(f"   Total realized P/L: ${summary.get('total_realized_pnl', 0)}")
            
            # Verify expired positions have required fields
            positions = summary.get('positions', [])
            expired_positions = [p for p in positions if p.get('status') == 'expired']
            
            print(f"\n   Expired positions validation:")
            for pos in expired_positions:
                has_exit_price = 'exit_price' in pos and pos['exit_price'] is not None
                has_realized_pnl = 'realized_pnl' in pos and pos['realized_pnl'] is not None
                print(f"     - {pos.get('strategy_name', 'Unknown')}: "
                      f"Exit Price: {'✅' if has_exit_price else '❌'}, "
                      f"Realized P/L: {'✅' if has_realized_pnl else '❌'}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")

if __name__ == "__main__":
    test_detailed_portfolio()