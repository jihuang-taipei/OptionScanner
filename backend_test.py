import requests
import sys
from datetime import datetime
import json

class SPXAPITester:
    def __init__(self, base_url="https://spx-finance-fetch.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, params=None, validate_response=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=params, headers=headers, timeout=30)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            response_data = {}
            
            if response.status_code == 200:
                try:
                    response_data = response.json()
                    print(f"   Response received: {len(str(response_data))} characters")
                except:
                    print("   Warning: Could not parse JSON response")
            else:
                print(f"   Error Response: {response.text[:200]}...")

            # Additional validation if provided
            if success and validate_response and response_data:
                validation_result = validate_response(response_data)
                if not validation_result:
                    success = False
                    print("   ❌ Response validation failed")

            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed")
                self.test_results.append({"test": name, "status": "PASSED", "details": "Test completed successfully"})
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                self.test_results.append({"test": name, "status": "FAILED", "details": f"Expected {expected_status}, got {response.status_code}"})

            return success, response_data

        except requests.exceptions.Timeout:
            print(f"   ❌ Failed - Request timeout (30s)")
            self.test_results.append({"test": name, "status": "FAILED", "details": "Request timeout"})
            return False, {}
        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            self.test_results.append({"test": name, "status": "FAILED", "details": str(e)})
            return False, {}

    def validate_spx_quote(self, data):
        """Validate SPX quote response structure"""
        required_fields = [
            'symbol', 'price', 'change', 'change_percent', 'previous_close',
            'open', 'day_high', 'day_low', 'fifty_two_week_high', 
            'fifty_two_week_low', 'timestamp'
        ]
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        # Validate data types
        numeric_fields = ['price', 'change', 'change_percent', 'previous_close', 
                         'open', 'day_high', 'day_low', 'fifty_two_week_high', 'fifty_two_week_low']
        
        for field in numeric_fields:
            if not isinstance(data[field], (int, float)):
                print(f"   Field {field} should be numeric, got {type(data[field])}")
                return False
        
        # Validate symbol
        if data['symbol'] != '^GSPC':
            print(f"   Expected symbol '^GSPC', got '{data['symbol']}'")
            return False
        
        # Validate price is positive
        if data['price'] <= 0:
            print(f"   Price should be positive, got {data['price']}")
            return False
            
        print(f"   Quote validation passed - Price: ${data['price']}, Change: {data['change']} ({data['change_percent']}%)")
        return True

    def validate_spx_history(self, data):
        """Validate SPX history response structure"""
        required_fields = ['symbol', 'period', 'data']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if data['symbol'] != '^GSPC':
            print(f"   Expected symbol '^GSPC', got '{data['symbol']}'")
            return False
        
        if not isinstance(data['data'], list):
            print(f"   Data field should be a list, got {type(data['data'])}")
            return False
        
        if len(data['data']) == 0:
            print(f"   Data array is empty")
            return False
        
        # Validate first data point structure
        first_point = data['data'][0]
        required_point_fields = ['date', 'open', 'high', 'low', 'close']
        
        for field in required_point_fields:
            if field not in first_point:
                print(f"   Missing field in data point: {field}")
                return False
        
        print(f"   History validation passed - {len(data['data'])} data points for period {data['period']}")
        return True

    def test_basic_connectivity(self):
        """Test basic API connectivity"""
        return self.run_test(
            "Basic API Connectivity",
            "GET",
            "api/",
            200
        )

    def test_spx_quote(self):
        """Test SPX quote endpoint"""
        return self.run_test(
            "SPX Quote",
            "GET",
            "api/spx/quote",
            200,
            validate_response=self.validate_spx_quote
        )

    def test_spx_history_default(self):
        """Test SPX history with default period"""
        return self.run_test(
            "SPX History (Default Period)",
            "GET",
            "api/spx/history",
            200,
            validate_response=self.validate_spx_history
        )

    def test_spx_history_periods(self):
        """Test SPX history with different periods"""
        periods = ["1d", "5d", "1mo", "3mo", "1y", "5y"]
        results = []
        
        for period in periods:
            success, data = self.run_test(
                f"SPX History ({period})",
                "GET",
                "api/spx/history",
                200,
                params={"period": period},
                validate_response=self.validate_spx_history
            )
            results.append((period, success))
        
        return results

    def test_invalid_period(self):
        """Test SPX history with invalid period"""
        return self.run_test(
            "SPX History (Invalid Period)",
            "GET",
            "api/spx/history",
            400,
            params={"period": "invalid"}
        )

def main():
    print("🚀 Starting SPX Finance API Tests")
    print("=" * 50)
    
    # Setup
    tester = SPXAPITester()
    
    # Run basic connectivity test
    print("\n📡 Testing Basic Connectivity...")
    tester.test_basic_connectivity()
    
    # Test SPX quote endpoint
    print("\n💰 Testing SPX Quote Endpoint...")
    tester.test_spx_quote()
    
    # Test SPX history endpoints
    print("\n📈 Testing SPX History Endpoints...")
    tester.test_spx_history_default()
    
    print("\n📊 Testing Different Time Periods...")
    period_results = tester.test_spx_history_periods()
    
    print("\n🚫 Testing Error Handling...")
    tester.test_invalid_period()
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("❌ Some tests failed")
        print("\nFailed Tests:")
        for result in tester.test_results:
            if result["status"] == "FAILED":
                print(f"  - {result['test']}: {result['details']}")
        return 1

if __name__ == "__main__":
    sys.exit(main())