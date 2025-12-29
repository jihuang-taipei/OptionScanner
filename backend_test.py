import requests
import sys
from datetime import datetime
import json

class SPXAPITester:
    def __init__(self, base_url="https://finspy.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        # Test symbols for configurable symbol feature
        self.test_symbols = ["^SPX", "SPY", "QQQ", "AAPL"]

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

    def validate_quote(self, data, expected_symbol=None):
        """Validate quote response structure for any symbol"""
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
        
        # Validate symbol if expected
        if expected_symbol and data['symbol'] != expected_symbol:
            print(f"   Expected symbol '{expected_symbol}', got '{data['symbol']}'")
            return False
        
        # Validate price is positive
        if data['price'] <= 0:
            print(f"   Price should be positive, got {data['price']}")
            return False
            
        print(f"   Quote validation passed - Symbol: {data['symbol']}, Price: ${data['price']}, Change: {data['change']} ({data['change_percent']}%)")
        return True

    def validate_spx_quote(self, data):
        """Validate SPX quote response structure - backwards compatibility"""
        return self.validate_quote(data, '^GSPC')

    def validate_history(self, data, expected_symbol=None):
        """Validate history response structure for any symbol"""
        required_fields = ['symbol', 'period', 'data']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if expected_symbol and data['symbol'] != expected_symbol:
            print(f"   Expected symbol '{expected_symbol}', got '{data['symbol']}'")
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
        
        print(f"   History validation passed - Symbol: {data['symbol']}, {len(data['data'])} data points for period {data['period']}")
        return True

    def validate_spx_history(self, data):
        """Validate SPX history response structure - backwards compatibility"""
        return self.validate_history(data, '^GSPC')

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

    def validate_options_expirations(self, data):
        """Validate options expirations response"""
        required_fields = ['symbol', 'expirations']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if data['symbol'] != '^SPX':
            print(f"   Expected symbol '^SPX', got '{data['symbol']}'")
            return False
        
        if not isinstance(data['expirations'], list):
            print(f"   Expirations should be a list, got {type(data['expirations'])}")
            return False
        
        if len(data['expirations']) == 0:
            print(f"   Expirations list is empty")
            return False
        
        print(f"   Expirations validation passed - {len(data['expirations'])} expiration dates")
        return True

    def validate_options_chain(self, data):
        """Validate options chain response"""
        required_fields = ['symbol', 'expirationDate', 'calls', 'puts']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if not isinstance(data['calls'], list) or not isinstance(data['puts'], list):
            print(f"   Calls and puts should be lists")
            return False
        
        if len(data['calls']) == 0 or len(data['puts']) == 0:
            print(f"   Empty calls or puts list")
            return False
        
        # Validate first call option structure
        first_call = data['calls'][0]
        required_option_fields = ['strike', 'lastPrice', 'bid', 'ask', 'impliedVolatility', 'inTheMoney']
        
        for field in required_option_fields:
            if field not in first_call:
                print(f"   Missing field in option: {field}")
                return False
        
        print(f"   Options chain validation passed - {len(data['calls'])} calls, {len(data['puts'])} puts")
        return True

    def validate_calendar_spreads(self, data):
        """Validate calendar spreads response"""
        required_fields = ['symbol', 'near_expiration', 'far_expiration', 'current_price', 'calendar_spreads']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if not isinstance(data['calendar_spreads'], list):
            print(f"   Calendar spreads should be a list, got {type(data['calendar_spreads'])}")
            return False
        
        if len(data['calendar_spreads']) == 0:
            print(f"   Calendar spreads list is empty")
            return False
        
        # Validate first spread structure
        first_spread = data['calendar_spreads'][0]
        required_spread_fields = ['strike', 'option_type', 'near_expiration', 'far_expiration', 'near_price', 'far_price', 'net_debit']
        
        for field in required_spread_fields:
            if field not in first_spread:
                print(f"   Missing field in calendar spread: {field}")
                return False
        
        print(f"   Calendar spreads validation passed - {len(data['calendar_spreads'])} spreads")
        return True

    def test_options_expirations(self):
        """Test options expirations endpoint"""
        return self.run_test(
            "Options Expirations",
            "GET",
            "api/spx/options/expirations",
            200,
            validate_response=self.validate_options_expirations
        )

    def test_options_chain(self, expiration=None):
        """Test options chain endpoint"""
        if not expiration:
            # First get expirations
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                print("   Cannot test options chain without valid expiration")
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Options Chain ({expiration})",
            "GET",
            "api/spx/options/chain",
            200,
            params={"expiration": expiration},
            validate_response=self.validate_options_chain
        )

    def test_calendar_spreads(self):
        """Test calendar spreads endpoint"""
        # First get expirations
        success, exp_data = self.test_options_expirations()
        if not success or not exp_data.get('expirations') or len(exp_data['expirations']) < 2:
            print("   Cannot test calendar spreads without at least 2 expirations")
            return False, {}
        
        near_exp = exp_data['expirations'][0]
        far_exp = exp_data['expirations'][1]
        
        return self.run_test(
            f"Calendar Spreads ({near_exp} to {far_exp})",
            "GET",
            "api/spx/calendar-spreads",
            200,
            params={"near_exp": near_exp, "far_exp": far_exp},
            validate_response=self.validate_calendar_spreads
        )

    def test_credit_spreads(self, expiration=None):
        """Test credit spreads endpoint"""
        if not expiration:
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Credit Spreads ({expiration})",
            "GET",
            "api/spx/credit-spreads",
            200,
            params={"expiration": expiration, "spread": 5}
        )

    def test_iron_condors(self, expiration=None):
        """Test iron condors endpoint"""
        if not expiration:
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Iron Condors ({expiration})",
            "GET",
            "api/spx/iron-condors",
            200,
            params={"expiration": expiration, "spread": 5}
        )

    def test_iron_butterflies(self, expiration=None):
        """Test iron butterflies endpoint"""
        if not expiration:
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Iron Butterflies ({expiration})",
            "GET",
            "api/spx/iron-butterflies",
            200,
            params={"expiration": expiration, "wing": 25}
        )

    def test_straddles(self, expiration=None):
        """Test straddles endpoint"""
        if not expiration:
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Straddles ({expiration})",
            "GET",
            "api/spx/straddles",
            200,
            params={"expiration": expiration}
        )

    def test_strangles(self, expiration=None):
        """Test strangles endpoint"""
        if not expiration:
            success, exp_data = self.test_options_expirations()
            if not success or not exp_data.get('expirations'):
                return False, {}
            expiration = exp_data['expirations'][0]
        
        return self.run_test(
            f"Strangles ({expiration})",
            "GET",
            "api/spx/strangles",
            200,
            params={"expiration": expiration}
        )

    # New tests for configurable symbol feature
    def test_configurable_quote(self):
        """Test quote endpoint with different symbols"""
        results = []
        for symbol in self.test_symbols:
            success, data = self.run_test(
                f"Quote for {symbol}",
                "GET",
                "api/quote",
                200,
                params={"symbol": symbol},
                validate_response=lambda d: self.validate_quote(d, symbol)
            )
            results.append((symbol, success, data.get('price', 0) if data else 0))
        return results

    def test_configurable_history(self):
        """Test history endpoint with different symbols"""
        results = []
        for symbol in self.test_symbols:
            success, data = self.run_test(
                f"History for {symbol}",
                "GET",
                "api/history",
                200,
                params={"symbol": symbol, "period": "1mo"},
                validate_response=lambda d: self.validate_history(d, symbol)
            )
            results.append((symbol, success))
        return results

    def test_configurable_options_expirations(self):
        """Test options expirations with different symbols"""
        results = []
        for symbol in self.test_symbols:
            success, data = self.run_test(
                f"Options Expirations for {symbol}",
                "GET",
                "api/options/expirations",
                200,
                params={"symbol": symbol},
                validate_response=lambda d: self.validate_options_expirations_symbol(d, symbol)
            )
            results.append((symbol, success, len(data.get('expirations', [])) if data else 0))
        return results

    def test_configurable_options_chain(self):
        """Test options chain with different symbols"""
        results = []
        for symbol in self.test_symbols:
            # Get expirations first
            exp_success, exp_data = self.run_test(
                f"Get expirations for {symbol}",
                "GET",
                "api/options/expirations",
                200,
                params={"symbol": symbol}
            )
            
            if exp_success and exp_data.get('expirations'):
                expiration = exp_data['expirations'][0]
                success, data = self.run_test(
                    f"Options Chain for {symbol} ({expiration})",
                    "GET",
                    "api/options/chain",
                    200,
                    params={"symbol": symbol, "expiration": expiration},
                    validate_response=lambda d: self.validate_options_chain_symbol(d, symbol)
                )
                results.append((symbol, success, len(data.get('calls', [])) if data else 0))
            else:
                results.append((symbol, False, 0))
        return results

    def test_configurable_credit_spreads(self):
        """Test credit spreads with different symbols"""
        results = []
        for symbol in self.test_symbols:
            # Get expirations first
            exp_success, exp_data = self.run_test(
                f"Get expirations for {symbol}",
                "GET",
                "api/options/expirations",
                200,
                params={"symbol": symbol}
            )
            
            if exp_success and exp_data.get('expirations'):
                expiration = exp_data['expirations'][0]
                success, data = self.run_test(
                    f"Credit Spreads for {symbol} ({expiration})",
                    "GET",
                    "api/credit-spreads",
                    200,
                    params={"symbol": symbol, "expiration": expiration, "spread": 5}
                )
                results.append((symbol, success))
            else:
                results.append((symbol, False))
        return results

    def test_configurable_iron_condors(self):
        """Test iron condors with different symbols"""
        results = []
        for symbol in self.test_symbols:
            # Get expirations first
            exp_success, exp_data = self.run_test(
                f"Get expirations for {symbol}",
                "GET",
                "api/options/expirations",
                200,
                params={"symbol": symbol}
            )
            
            if exp_success and exp_data.get('expirations'):
                expiration = exp_data['expirations'][0]
                success, data = self.run_test(
                    f"Iron Condors for {symbol} ({expiration})",
                    "GET",
                    "api/iron-condors",
                    200,
                    params={"symbol": symbol, "expiration": expiration, "spread": 5}
                )
                results.append((symbol, success))
            else:
                results.append((symbol, False))
        return results

    def test_configurable_straddles(self):
        """Test straddles with different symbols"""
        results = []
        for symbol in self.test_symbols:
            # Get expirations first
            exp_success, exp_data = self.run_test(
                f"Get expirations for {symbol}",
                "GET",
                "api/options/expirations",
                200,
                params={"symbol": symbol}
            )
            
            if exp_success and exp_data.get('expirations'):
                expiration = exp_data['expirations'][0]
                success, data = self.run_test(
                    f"Straddles for {symbol} ({expiration})",
                    "GET",
                    "api/straddles",
                    200,
                    params={"symbol": symbol, "expiration": expiration}
                )
                results.append((symbol, success))
            else:
                results.append((symbol, False))
        return results

    # Portfolio/Position Testing Methods
    def validate_positions_response(self, data):
        """Validate positions response structure"""
        if not isinstance(data, list):
            print(f"   Positions should be a list, got {type(data)}")
            return False
        
        if len(data) == 0:
            print("   No positions found")
            return True  # Empty list is valid
        
        # Validate first position structure
        first_pos = data[0]
        required_fields = ['id', 'symbol', 'strategy_type', 'strategy_name', 'status', 'entry_price', 'quantity']
        
        for field in required_fields:
            if field not in first_pos:
                print(f"   Missing field in position: {field}")
                return False
        
        print(f"   Positions validation passed - {len(data)} positions found")
        return True

    def validate_expire_response(self, data):
        """Validate expire positions response structure"""
        required_fields = ['message', 'expired_positions']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if not isinstance(data['expired_positions'], list):
            print(f"   Expired positions should be a list, got {type(data['expired_positions'])}")
            return False
        
        expired_count = len(data['expired_positions'])
        print(f"   Expire validation passed - {expired_count} positions expired")
        return True

    def test_positions_expire(self):
        """Test positions expire endpoint"""
        return self.run_test(
            "Expire Positions",
            "POST",
            "api/positions/expire",
            200,
            validate_response=self.validate_expire_response
        )

    def test_get_all_positions(self):
        """Test get all positions endpoint"""
        return self.run_test(
            "Get All Positions",
            "GET",
            "api/positions",
            200,
            validate_response=self.validate_positions_response
        )

    def test_get_open_positions(self):
        """Test get open positions only"""
        return self.run_test(
            "Get Open Positions",
            "GET",
            "api/positions",
            200,
            params={"status": "open"},
            validate_response=self.validate_positions_response
        )

    def test_get_expired_positions(self):
        """Test get expired positions only"""
        return self.run_test(
            "Get Expired Positions",
            "GET",
            "api/positions",
            200,
            params={"status": "expired"},
            validate_response=self.validate_positions_response
        )

    def test_get_closed_positions(self):
        """Test get closed positions only"""
        return self.run_test(
            "Get Closed Positions",
            "GET",
            "api/positions",
            200,
            params={"status": "closed"},
            validate_response=self.validate_positions_response
        )

    def test_portfolio_summary(self):
        """Test portfolio summary endpoint"""
        def validate_summary(data):
            required_fields = ['total_positions', 'open_positions', 'closed_positions', 
                             'total_unrealized_pnl', 'total_realized_pnl', 'positions']
            
            for field in required_fields:
                if field not in data:
                    print(f"   Missing field in summary: {field}")
                    return False
            
            if not isinstance(data['positions'], list):
                print(f"   Positions should be a list, got {type(data['positions'])}")
                return False
            
            print(f"   Summary validation passed - {data['total_positions']} total positions, "
                  f"{data['open_positions']} open, {data['closed_positions']} closed/expired")
            print(f"   Unrealized P/L: ${data['total_unrealized_pnl']}, Realized P/L: ${data['total_realized_pnl']}")
            return True
        
        return self.run_test(
            "Portfolio Summary",
            "GET",
            "api/portfolio/summary",
            200,
            validate_response=validate_summary
        )

    def validate_options_expirations_symbol(self, data, expected_symbol):
        """Validate options expirations response for specific symbol"""
        required_fields = ['symbol', 'expirations']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if data['symbol'] != expected_symbol:
            print(f"   Expected symbol '{expected_symbol}', got '{data['symbol']}'")
            return False
        
        if not isinstance(data['expirations'], list):
            print(f"   Expirations should be a list, got {type(data['expirations'])}")
            return False
        
        if len(data['expirations']) == 0:
            print(f"   Expirations list is empty")
            return False
        
        print(f"   Expirations validation passed - Symbol: {data['symbol']}, {len(data['expirations'])} expiration dates")
        return True

    def validate_options_chain_symbol(self, data, expected_symbol):
        """Validate options chain response for specific symbol"""
        required_fields = ['symbol', 'expirationDate', 'calls', 'puts']
        
        for field in required_fields:
            if field not in data:
                print(f"   Missing required field: {field}")
                return False
        
        if data['symbol'] != expected_symbol:
            print(f"   Expected symbol '{expected_symbol}', got '{data['symbol']}'")
            return False
        
        if not isinstance(data['calls'], list) or not isinstance(data['puts'], list):
            print(f"   Calls and puts should be lists")
            return False
        
        if len(data['calls']) == 0 or len(data['puts']) == 0:
            print(f"   Empty calls or puts list")
            return False
        
        # Validate first call option structure
        first_call = data['calls'][0]
        required_option_fields = ['strike', 'lastPrice', 'bid', 'ask', 'impliedVolatility', 'inTheMoney']
        
        for field in required_option_fields:
            if field not in first_call:
                print(f"   Missing field in option: {field}")
                return False
        
        print(f"   Options chain validation passed - Symbol: {data['symbol']}, {len(data['calls'])} calls, {len(data['puts'])} puts")
        return True

def main():
    print("🚀 Starting Options Scanner API Tests - Auto-Expiration Feature Focus")
    print("=" * 70)
    
    # Setup
    tester = SPXAPITester()
    
    # Run basic connectivity test
    print("\n📡 Testing Basic Connectivity...")
    tester.test_basic_connectivity()
    
    # NEW: Test Portfolio/Position Management (Auto-Expiration Feature)
    print("\n💼 Testing Portfolio Management - Auto-Expiration Feature...")
    print("\n⏰ Testing Position Expiration...")
    expire_success, expire_data = tester.test_positions_expire()
    
    print("\n📋 Testing Get All Positions...")
    all_positions_success, all_positions_data = tester.test_get_all_positions()
    
    print("\n🟢 Testing Get Open Positions...")
    open_positions_success, open_positions_data = tester.test_get_open_positions()
    
    print("\n🟡 Testing Get Expired Positions...")
    expired_positions_success, expired_positions_data = tester.test_get_expired_positions()
    
    print("\n🔴 Testing Get Closed Positions...")
    closed_positions_success, closed_positions_data = tester.test_get_closed_positions()
    
    print("\n📊 Testing Portfolio Summary...")
    summary_success, summary_data = tester.test_portfolio_summary()
    
    # Test SPX quote endpoint (backwards compatibility)
    print("\n💰 Testing SPX Quote Endpoint (Legacy)...")
    tester.test_spx_quote()
    
    # Test SPX history endpoints (backwards compatibility)
    print("\n📈 Testing SPX History Endpoints (Legacy)...")
    tester.test_spx_history_default()
    
    print("\n📊 Testing Different Time Periods...")
    period_results = tester.test_spx_history_periods()
    
    print("\n🚫 Testing Error Handling...")
    tester.test_invalid_period()
    
    # NEW: Test configurable symbol feature
    print("\n🔄 Testing Configurable Symbol Feature...")
    print("\n💰 Testing Quote with Different Symbols...")
    quote_results = tester.test_configurable_quote()
    for symbol, success, price in quote_results:
        if success:
            print(f"   ✅ {symbol}: ${price}")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n📈 Testing History with Different Symbols...")
    history_results = tester.test_configurable_history()
    for symbol, success in history_results:
        if success:
            print(f"   ✅ {symbol}: History data retrieved")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n📅 Testing Options Expirations with Different Symbols...")
    exp_results = tester.test_configurable_options_expirations()
    for symbol, success, exp_count in exp_results:
        if success:
            print(f"   ✅ {symbol}: {exp_count} expirations")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n⛓️ Testing Options Chain with Different Symbols...")
    chain_results = tester.test_configurable_options_chain()
    for symbol, success, call_count in chain_results:
        if success:
            print(f"   ✅ {symbol}: {call_count} call options")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n📊 Testing Credit Spreads with Different Symbols...")
    spread_results = tester.test_configurable_credit_spreads()
    for symbol, success in spread_results:
        if success:
            print(f"   ✅ {symbol}: Credit spreads data retrieved")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n🦋 Testing Iron Condors with Different Symbols...")
    condor_results = tester.test_configurable_iron_condors()
    for symbol, success in condor_results:
        if success:
            print(f"   ✅ {symbol}: Iron condors data retrieved")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    print("\n📈 Testing Straddles with Different Symbols...")
    straddle_results = tester.test_configurable_straddles()
    for symbol, success in straddle_results:
        if success:
            print(f"   ✅ {symbol}: Straddles data retrieved")
        else:
            print(f"   ❌ {symbol}: Failed")
    
    # Test legacy Options endpoints (backwards compatibility)
    print("\n📅 Testing Legacy Options Expirations...")
    exp_success, exp_data = tester.test_options_expirations()
    
    if exp_success and exp_data.get('expirations'):
        expiration = exp_data['expirations'][0]
        
        print("\n⛓️ Testing Legacy Options Chain...")
        tester.test_options_chain(expiration)
        
        print("\n📊 Testing Legacy Credit Spreads...")
        tester.test_credit_spreads(expiration)
        
        print("\n🦋 Testing Legacy Iron Condors...")
        tester.test_iron_condors(expiration)
        
        print("\n🦋 Testing Legacy Iron Butterflies...")
        tester.test_iron_butterflies(expiration)
        
        print("\n📈 Testing Legacy Straddles...")
        tester.test_straddles(expiration)
        
        print("\n📉 Testing Legacy Strangles...")
        tester.test_strangles(expiration)
        
        print("\n📅 Testing Legacy Calendar Spreads...")
        tester.test_calendar_spreads()
    else:
        print("⚠️ Skipping legacy options tests due to expiration fetch failure")
    
    # Print final results
    print("\n" + "=" * 70)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    # Summary of Auto-Expiration feature
    print("\n⏰ Auto-Expiration Feature Summary:")
    portfolio_tests = [
        ("Position Expiration", expire_success),
        ("Get All Positions", all_positions_success),
        ("Get Open Positions", open_positions_success),
        ("Get Expired Positions", expired_positions_success),
        ("Get Closed Positions", closed_positions_success),
        ("Portfolio Summary", summary_success)
    ]
    
    portfolio_passed = sum(1 for _, success in portfolio_tests if success)
    portfolio_total = len(portfolio_tests)
    
    print(f"   📈 Portfolio Tests: {portfolio_passed}/{portfolio_total} passed")
    for test_name, success in portfolio_tests:
        status = "✅" if success else "❌"
        print(f"   {status} {test_name}")
    
    # Summary of configurable symbol feature
    print("\n🔄 Configurable Symbol Feature Summary:")
    successful_symbols = []
    failed_symbols = []
    
    for symbol, success, _ in quote_results:
        if success:
            successful_symbols.append(symbol)
        else:
            failed_symbols.append(symbol)
    
    if successful_symbols:
        print(f"   ✅ Working symbols: {', '.join(successful_symbols)}")
    if failed_symbols:
        print(f"   ❌ Failed symbols: {', '.join(failed_symbols)}")
    
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