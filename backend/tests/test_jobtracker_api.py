"""
JobTracker SaaS API Tests
Tests for authentication, applications CRUD, interviews, and statistics endpoints
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://career-compass-735.preview.emergentagent.com')

# Test user credentials
TEST_USER_EMAIL = "demo@jobtracker.com"
TEST_USER_PASSWORD = "Demo123!"

# Unique test user for registration tests
UNIQUE_TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@jobtracker.com"


class TestHealthEndpoints:
    """Health check and root endpoint tests"""
    
    def test_health_check(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("✅ Health check passed")
    
    def test_root_endpoint(self):
        """Test /api/ root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "JobTracker SaaS API"
        assert data["version"] == "2.0.0"
        assert data["status"] == "running"
        print("✅ Root endpoint passed")


class TestAuthentication:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with demo credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"]) > 0
        print(f"✅ Login success - token received")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print("✅ Invalid login correctly rejected")
    
    def test_login_invalid_email_format(self):
        """Test login with invalid email format"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "not-an-email",
            "password": "password123"
        })
        assert response.status_code == 422  # Validation error
        print("✅ Invalid email format correctly rejected")
    
    def test_register_new_user(self):
        """Test user registration"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": UNIQUE_TEST_EMAIL,
            "password": "TestPass123!",
            "full_name": "Test User"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == UNIQUE_TEST_EMAIL
        assert data["full_name"] == "Test User"
        assert "id" in data
        print(f"✅ User registration successful - ID: {data['id']}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": "TestPass123!",
            "full_name": "Duplicate User"
        })
        assert response.status_code == 400
        data = response.json()
        assert "existe déjà" in data["detail"] or "already" in data["detail"].lower()
        print("✅ Duplicate email correctly rejected")
    
    def test_get_current_user(self):
        """Test /api/auth/me endpoint"""
        # First login
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get user profile
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_USER_EMAIL
        assert "id" in data
        assert "full_name" in data
        print(f"✅ Get current user passed - {data['full_name']}")
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]
        print("✅ Unauthorized access correctly rejected")


class TestApplicationsCRUD:
    """Applications CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_list_applications(self):
        """Test listing applications"""
        response = requests.get(
            f"{BASE_URL}/api/applications",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "per_page" in data
        assert "total_pages" in data
        print(f"✅ List applications - Total: {data['total']}")
    
    def test_create_application(self):
        """Test creating a new application"""
        app_data = {
            "entreprise": "TEST_Google",
            "poste": "Senior Developer",
            "type_poste": "cdi",
            "lieu": "Paris",
            "moyen": "linkedin",
            "date_candidature": datetime.now().isoformat(),
            "lien": "https://careers.google.com/job123",
            "commentaire": "Test application"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/applications",
            headers=self.headers,
            json=app_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["entreprise"] == "TEST_Google"
        assert data["poste"] == "Senior Developer"
        assert data["type_poste"] == "cdi"
        assert data["reponse"] == "pending"
        assert "id" in data
        
        # Store for cleanup
        self.created_app_id = data["id"]
        print(f"✅ Create application - ID: {data['id']}")
        
        # Verify persistence with GET
        get_response = requests.get(
            f"{BASE_URL}/api/applications/{data['id']}",
            headers=self.headers
        )
        assert get_response.status_code == 200
        fetched = get_response.json()
        assert fetched["entreprise"] == "TEST_Google"
        print("✅ Application persisted correctly")
        
        return data["id"]
    
    def test_get_application_by_id(self):
        """Test getting a specific application"""
        # First create one
        app_id = self.test_create_application()
        
        response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == app_id
        assert "entreprise" in data
        assert "poste" in data
        print(f"✅ Get application by ID passed")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/applications/{app_id}", headers=self.headers)
    
    def test_update_application(self):
        """Test updating an application"""
        # First create one
        app_id = self.test_create_application()
        
        update_data = {
            "poste": "Lead Developer",
            "reponse": "positive"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/applications/{app_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["poste"] == "Lead Developer"
        assert data["reponse"] == "positive"
        print(f"✅ Update application passed")
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers=self.headers
        )
        fetched = get_response.json()
        assert fetched["poste"] == "Lead Developer"
        assert fetched["reponse"] == "positive"
        print("✅ Update persisted correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/applications/{app_id}", headers=self.headers)
    
    def test_delete_application(self):
        """Test deleting an application"""
        # First create one
        app_id = self.test_create_application()
        
        response = requests.delete(
            f"{BASE_URL}/api/applications/{app_id}",
            headers=self.headers
        )
        assert response.status_code == 204
        print(f"✅ Delete application passed")
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/applications/{app_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404
        print("✅ Application correctly removed from database")
    
    def test_toggle_favorite(self):
        """Test toggling favorite status"""
        # First create one
        app_id = self.test_create_application()
        
        # Toggle favorite
        response = requests.post(
            f"{BASE_URL}/api/applications/{app_id}/favorite",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_favorite" in data
        first_state = data["is_favorite"]
        print(f"✅ Toggle favorite - is_favorite: {first_state}")
        
        # Toggle again
        response2 = requests.post(
            f"{BASE_URL}/api/applications/{app_id}/favorite",
            headers=self.headers
        )
        assert response2.status_code == 200
        data2 = response2.json()
        assert data2["is_favorite"] != first_state
        print(f"✅ Toggle favorite again - is_favorite: {data2['is_favorite']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/applications/{app_id}", headers=self.headers)
    
    def test_search_applications(self):
        """Test searching applications"""
        response = requests.get(
            f"{BASE_URL}/api/applications",
            headers=self.headers,
            params={"search": "Google"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        print(f"✅ Search applications - Found: {len(data['items'])} results")
    
    def test_filter_by_status(self):
        """Test filtering applications by status"""
        response = requests.get(
            f"{BASE_URL}/api/applications",
            headers=self.headers,
            params={"status": "pending"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        # All items should have pending status
        for item in data["items"]:
            assert item["reponse"] == "pending"
        print(f"✅ Filter by status - Found: {len(data['items'])} pending applications")
    
    def test_application_not_found(self):
        """Test getting non-existent application"""
        response = requests.get(
            f"{BASE_URL}/api/applications/non-existent-id",
            headers=self.headers
        )
        assert response.status_code == 404
        print("✅ Non-existent application correctly returns 404")


class TestInterviews:
    """Interview endpoint tests - Phase 3 CRUD complet"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token and create test application"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create a test application for interviews
        app_data = {
            "entreprise": "TEST_Interview_Company",
            "poste": "Developer",
            "type_poste": "cdi",
            "date_candidature": datetime.now().isoformat()
        }
        app_response = requests.post(
            f"{BASE_URL}/api/applications",
            headers=self.headers,
            json=app_data
        )
        self.test_app_id = app_response.json()["id"]
        self.created_interview_ids = []
    
    def teardown_method(self, method):
        """Cleanup test application and interviews"""
        # Cleanup interviews
        for interview_id in getattr(self, 'created_interview_ids', []):
            requests.delete(
                f"{BASE_URL}/api/interviews/{interview_id}",
                headers=self.headers
            )
        
        if hasattr(self, 'test_app_id'):
            requests.delete(
                f"{BASE_URL}/api/applications/{self.test_app_id}",
                headers=self.headers
            )
    
    def test_list_interviews(self):
        """Test listing interviews"""
        response = requests.get(
            f"{BASE_URL}/api/interviews",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ List interviews - Total: {len(data)}")
    
    def test_create_interview(self):
        """Test creating an interview"""
        interview_data = {
            "candidature_id": self.test_app_id,
            "date_entretien": (datetime.now() + timedelta(days=7)).isoformat(),
            "type_entretien": "technical",
            "format_entretien": "video",
            "lieu_entretien": "Google Meet",
            "interviewer": "John Doe"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/interviews",
            headers=self.headers,
            json=interview_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["candidature_id"] == self.test_app_id
        assert data["type_entretien"] == "technical"
        assert data["format_entretien"] == "video"
        assert "id" in data
        assert "entreprise" in data  # Enriched with application data
        assert "poste" in data
        print(f"✅ Create interview - ID: {data['id']}")
        
        self.created_interview_ids.append(data["id"])
        return data["id"]
    
    def test_create_interview_with_all_types(self):
        """Test creating interviews with different types (RH, technical, manager, final)"""
        types = ["rh", "technical", "manager", "final", "other"]
        
        for interview_type in types:
            interview_data = {
                "candidature_id": self.test_app_id,
                "date_entretien": (datetime.now() + timedelta(days=7)).isoformat(),
                "type_entretien": interview_type,
                "format_entretien": "video"
            }
            
            response = requests.post(
                f"{BASE_URL}/api/interviews",
                headers=self.headers,
                json=interview_data
            )
            assert response.status_code == 201
            data = response.json()
            assert data["type_entretien"] == interview_type
            self.created_interview_ids.append(data["id"])
            print(f"✅ Create interview type '{interview_type}' - ID: {data['id']}")
    
    def test_create_interview_with_all_formats(self):
        """Test creating interviews with different formats (phone, video, in_person)"""
        formats = ["phone", "video", "in_person"]
        
        for interview_format in formats:
            interview_data = {
                "candidature_id": self.test_app_id,
                "date_entretien": (datetime.now() + timedelta(days=7)).isoformat(),
                "type_entretien": "technical",
                "format_entretien": interview_format
            }
            
            response = requests.post(
                f"{BASE_URL}/api/interviews",
                headers=self.headers,
                json=interview_data
            )
            assert response.status_code == 201
            data = response.json()
            assert data["format_entretien"] == interview_format
            self.created_interview_ids.append(data["id"])
            print(f"✅ Create interview format '{interview_format}' - ID: {data['id']}")
    
    def test_get_interview_by_id(self):
        """Test getting a specific interview by ID"""
        # First create one
        interview_id = self.test_create_interview()
        
        response = requests.get(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == interview_id
        assert "entreprise" in data
        assert "poste" in data
        assert "time_remaining" in data or data["statut"] != "planned"
        print(f"✅ Get interview by ID passed - {data['entreprise']}")
    
    def test_update_interview_status(self):
        """Test updating interview status (planned -> completed)"""
        # First create one
        interview_id = self.test_create_interview()
        
        # Update status to completed
        update_data = {"statut": "completed"}
        response = requests.put(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["statut"] == "completed"
        print(f"✅ Update interview status to 'completed' passed")
        
        # Verify persistence
        get_response = requests.get(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers
        )
        fetched = get_response.json()
        assert fetched["statut"] == "completed"
        print("✅ Status update persisted correctly")
    
    def test_update_interview_to_cancelled(self):
        """Test updating interview status to cancelled"""
        interview_id = self.test_create_interview()
        
        update_data = {"statut": "cancelled"}
        response = requests.put(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["statut"] == "cancelled"
        print(f"✅ Update interview status to 'cancelled' passed")
    
    def test_update_interview_details(self):
        """Test updating interview details (interviewer, location)"""
        interview_id = self.test_create_interview()
        
        update_data = {
            "interviewer": "Jane Smith",
            "lieu_entretien": "Zoom Meeting",
            "commentaire": "Prepare technical questions"
        }
        response = requests.put(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers,
            json=update_data
        )
        assert response.status_code == 200
        data = response.json()
        assert data["interviewer"] == "Jane Smith"
        assert data["lieu_entretien"] == "Zoom Meeting"
        print(f"✅ Update interview details passed")
    
    def test_delete_interview(self):
        """Test deleting an interview"""
        interview_id = self.test_create_interview()
        
        response = requests.delete(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers
        )
        assert response.status_code == 204
        print(f"✅ Delete interview passed")
        
        # Verify deletion
        get_response = requests.get(
            f"{BASE_URL}/api/interviews/{interview_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404
        print("✅ Interview correctly removed from database")
        
        # Remove from cleanup list since already deleted
        if interview_id in self.created_interview_ids:
            self.created_interview_ids.remove(interview_id)
    
    def test_filter_interviews_by_status_planned(self):
        """Test filtering interviews by status=planned"""
        # Create a planned interview
        self.test_create_interview()
        
        response = requests.get(
            f"{BASE_URL}/api/interviews",
            headers=self.headers,
            params={"status": "planned"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for interview in data:
            assert interview["statut"] == "planned"
        print(f"✅ Filter interviews by status=planned - Found: {len(data)}")
    
    def test_filter_interviews_by_status_completed(self):
        """Test filtering interviews by status=completed"""
        response = requests.get(
            f"{BASE_URL}/api/interviews",
            headers=self.headers,
            params={"status": "completed"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for interview in data:
            assert interview["statut"] == "completed"
        print(f"✅ Filter interviews by status=completed - Found: {len(data)}")
    
    def test_get_upcoming_interviews(self):
        """Test getting upcoming interviews"""
        response = requests.get(
            f"{BASE_URL}/api/interviews/upcoming",
            headers=self.headers,
            params={"limit": 5}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All should be planned and have time_remaining
        for interview in data:
            assert interview["statut"] == "planned"
            assert "time_remaining" in interview
            assert "urgency" in interview
        print(f"✅ Get upcoming interviews - Found: {len(data)}")
    
    def test_interview_urgency_indicator(self):
        """Test that urgency indicator is calculated correctly"""
        # Create interview for tomorrow (should be warning)
        interview_data = {
            "candidature_id": self.test_app_id,
            "date_entretien": (datetime.now() + timedelta(hours=12)).isoformat(),
            "type_entretien": "technical",
            "format_entretien": "video"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/interviews",
            headers=self.headers,
            json=interview_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["urgency"] in ["danger", "warning", "info", "normal"]
        self.created_interview_ids.append(data["id"])
        print(f"✅ Interview urgency indicator: {data['urgency']} - time remaining: {data['time_remaining']}")
    
    def test_interview_not_found(self):
        """Test getting non-existent interview"""
        response = requests.get(
            f"{BASE_URL}/api/interviews/non-existent-id",
            headers=self.headers
        )
        assert response.status_code == 404
        print("✅ Non-existent interview correctly returns 404")
    
    def test_interview_invalid_candidature(self):
        """Test creating interview with invalid candidature_id"""
        interview_data = {
            "candidature_id": "invalid-candidature-id",
            "date_entretien": (datetime.now() + timedelta(days=7)).isoformat(),
            "type_entretien": "technical",
            "format_entretien": "video"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/interviews",
            headers=self.headers,
            json=interview_data
        )
        assert response.status_code == 404
        print("✅ Invalid candidature_id correctly returns 404")


class TestStatistics:
    """Statistics endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/dashboard",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_applications" in data
        assert "pending" in data
        assert "positive" in data
        assert "negative" in data
        assert "response_rate" in data
        print(f"✅ Dashboard stats - Total: {data['total_applications']}, Response rate: {data['response_rate']}%")
    
    def test_timeline_stats(self):
        """Test timeline statistics"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/timeline",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "date" in data[0]
            assert "count" in data[0]
            assert "cumulative" in data[0]
        print(f"✅ Timeline stats - Data points: {len(data)}")
    
    def test_status_distribution(self):
        """Test status distribution"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/by-status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for item in data:
            assert "status" in item
            assert "count" in item
            assert "percentage" in item
        print(f"✅ Status distribution - Categories: {len(data)}")
    
    def test_type_distribution(self):
        """Test job type distribution"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/by-type",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Type distribution - Categories: {len(data)}")
    
    def test_method_distribution(self):
        """Test application method distribution"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/by-method",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Method distribution - Categories: {len(data)}")
    
    def test_statistics_overview(self):
        """Test complete statistics overview"""
        response = requests.get(
            f"{BASE_URL}/api/statistics/overview",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "dashboard" in data
        assert "timeline" in data
        assert "by_status" in data
        assert "by_type" in data
        assert "by_method" in data
        assert "interviews_stats" in data
        print(f"✅ Statistics overview - Complete data received")


# Cleanup function to remove test data
def cleanup_test_data():
    """Remove all TEST_ prefixed applications"""
    login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    if login_response.status_code != 200:
        return
    
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get all applications
    response = requests.get(f"{BASE_URL}/api/applications", headers=headers, params={"per_page": 100})
    if response.status_code == 200:
        apps = response.json().get("items", [])
        for app in apps:
            if app.get("entreprise", "").startswith("TEST_"):
                requests.delete(f"{BASE_URL}/api/applications/{app['id']}", headers=headers)
                print(f"Cleaned up: {app['entreprise']}")


if __name__ == "__main__":
    # Run cleanup before tests
    cleanup_test_data()
    pytest.main([__file__, "-v", "--tb=short"])
