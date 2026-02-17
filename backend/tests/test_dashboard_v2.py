"""
Dashboard V2 API Tests
Tests for the new Dashboard V2 endpoints including:
- Goal progress tracking
- Job Search Score calculation
- User preferences (goals)
- Weekly evolution data
- Insights and priority actions
"""

import pytest
import requests
import os
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "password123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated API client"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestDashboardV2Endpoint:
    """Tests for GET /api/statistics/dashboard-v2"""
    
    def test_dashboard_v2_returns_200(self, api_client):
        """Dashboard V2 endpoint should return 200"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        assert response.status_code == 200
        print("✅ Dashboard V2 endpoint returns 200")
    
    def test_dashboard_v2_has_required_fields(self, api_client):
        """Dashboard V2 should return all required fields"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        data = response.json()
        
        # Check top-level fields
        required_fields = [
            "stats", "goal_progress", "job_search_score",
            "insights", "priority_actions", "weekly_evolution",
            "this_month_applications", "last_month_applications",
            "month_over_month_change"
        ]
        for field in required_fields:
            assert field in data, f"Missing field: {field}"
        print("✅ Dashboard V2 has all required top-level fields")
    
    def test_goal_progress_structure(self, api_client):
        """Goal progress should have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        goal_progress = response.json()["goal_progress"]
        
        required_fields = [
            "monthly_goal", "monthly_current", "monthly_percentage",
            "weekly_goal", "weekly_current", "weekly_percentage"
        ]
        for field in required_fields:
            assert field in goal_progress, f"Missing goal_progress field: {field}"
        
        # Validate types
        assert isinstance(goal_progress["monthly_goal"], int)
        assert isinstance(goal_progress["monthly_current"], int)
        assert isinstance(goal_progress["monthly_percentage"], (int, float))
        print("✅ Goal progress has correct structure and types")
    
    def test_job_search_score_structure(self, api_client):
        """Job Search Score should have correct structure"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        score = response.json()["job_search_score"]
        
        required_fields = [
            "total_score", "regularity_score", "response_rate_score",
            "interview_ratio_score", "followup_score", "trend", "trend_value"
        ]
        for field in required_fields:
            assert field in score, f"Missing job_search_score field: {field}"
        
        # Validate score ranges (0-100 for total, 0-30 for regularity, etc.)
        assert 0 <= score["total_score"] <= 100
        assert 0 <= score["regularity_score"] <= 30
        assert 0 <= score["response_rate_score"] <= 25
        assert 0 <= score["interview_ratio_score"] <= 25
        assert 0 <= score["followup_score"] <= 20
        assert score["trend"] in ["up", "down", "stable"]
        print("✅ Job Search Score has correct structure and valid ranges")
    
    def test_weekly_evolution_structure(self, api_client):
        """Weekly evolution should have 4 weeks of data"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        weekly = response.json()["weekly_evolution"]
        
        assert isinstance(weekly, list)
        assert len(weekly) == 4, "Should have exactly 4 weeks of data"
        
        for week in weekly:
            assert "week" in week
            assert "start_date" in week
            assert "applications" in week
            assert "responses" in week
            assert "interviews" in week
        print("✅ Weekly evolution has correct structure with 4 weeks")
    
    def test_insights_is_list(self, api_client):
        """Insights should be a list"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        insights = response.json()["insights"]
        
        assert isinstance(insights, list)
        # Insights can be empty if no conditions are met
        print(f"✅ Insights is a list with {len(insights)} items")
    
    def test_priority_actions_is_list(self, api_client):
        """Priority actions should be a list"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        actions = response.json()["priority_actions"]
        
        assert isinstance(actions, list)
        print(f"✅ Priority actions is a list with {len(actions)} items")


class TestPreferencesEndpoint:
    """Tests for GET/PUT /api/statistics/preferences"""
    
    def test_get_preferences_returns_200(self, api_client):
        """GET preferences should return 200"""
        response = api_client.get(f"{BASE_URL}/api/statistics/preferences")
        assert response.status_code == 200
        print("✅ GET preferences returns 200")
    
    def test_get_preferences_has_required_fields(self, api_client):
        """Preferences should have monthly_goal and weekly_goal"""
        response = api_client.get(f"{BASE_URL}/api/statistics/preferences")
        data = response.json()
        
        assert "monthly_goal" in data
        assert "weekly_goal" in data
        assert isinstance(data["monthly_goal"], int)
        assert isinstance(data["weekly_goal"], int)
        print("✅ Preferences has required fields with correct types")
    
    def test_update_preferences(self, api_client):
        """PUT preferences should update and return new values"""
        # Get current values
        original = api_client.get(f"{BASE_URL}/api/statistics/preferences").json()
        
        # Update to new values
        new_values = {"monthly_goal": 60, "weekly_goal": 20}
        response = api_client.put(
            f"{BASE_URL}/api/statistics/preferences",
            json=new_values
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["monthly_goal"] == 60
        assert data["weekly_goal"] == 20
        print("✅ PUT preferences updates values correctly")
        
        # Verify persistence with GET
        verify = api_client.get(f"{BASE_URL}/api/statistics/preferences").json()
        assert verify["monthly_goal"] == 60
        assert verify["weekly_goal"] == 20
        print("✅ Updated preferences persist correctly")
        
        # Restore original values
        api_client.put(
            f"{BASE_URL}/api/statistics/preferences",
            json={"monthly_goal": original["monthly_goal"], "weekly_goal": original["weekly_goal"]}
        )
        print("✅ Restored original preferences")
    
    def test_partial_update_preferences(self, api_client):
        """PUT preferences should allow partial updates"""
        # Get current values
        original = api_client.get(f"{BASE_URL}/api/statistics/preferences").json()
        
        # Update only monthly_goal
        response = api_client.put(
            f"{BASE_URL}/api/statistics/preferences",
            json={"monthly_goal": 55}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["monthly_goal"] == 55
        print("✅ Partial update works correctly")
        
        # Restore original
        api_client.put(
            f"{BASE_URL}/api/statistics/preferences",
            json={"monthly_goal": original["monthly_goal"]}
        )


class TestDashboardV2WithData:
    """Tests that verify dashboard calculations with test data"""
    
    @pytest.fixture
    def test_application(self, api_client):
        """Create a test application and clean up after"""
        # Create application with current date
        app_data = {
            "entreprise": "TEST_DashboardV2_Pytest",
            "poste": "Test Engineer",
            "type_poste": "cdi",
            "lieu": "Paris",
            "date_candidature": datetime.now(timezone.utc).isoformat()
        }
        response = api_client.post(f"{BASE_URL}/api/applications", json=app_data)
        assert response.status_code == 201
        app = response.json()
        
        yield app
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/applications/{app['id']}")
    
    def test_dashboard_reflects_new_application(self, api_client, test_application):
        """Dashboard should reflect newly created application"""
        response = api_client.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        data = response.json()
        
        # Stats should show at least 1 application
        assert data["stats"]["total_applications"] >= 1
        assert data["stats"]["pending"] >= 1
        print("✅ Dashboard reflects new application in stats")


class TestUnauthorizedAccess:
    """Tests for unauthorized access to endpoints"""
    
    def test_dashboard_v2_requires_auth(self):
        """Dashboard V2 should require authentication"""
        response = requests.get(f"{BASE_URL}/api/statistics/dashboard-v2")
        assert response.status_code in [401, 403]
        print("✅ Dashboard V2 requires authentication")
    
    def test_preferences_requires_auth(self):
        """Preferences should require authentication"""
        response = requests.get(f"{BASE_URL}/api/statistics/preferences")
        assert response.status_code in [401, 403]
        print("✅ Preferences requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
