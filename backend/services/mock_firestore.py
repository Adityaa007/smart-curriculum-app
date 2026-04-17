class MockDocument:
    """Represents a mock Firestore document"""
    def __init__(self, data):
        self._data = data
    
    @property
    def exists(self):
        """Mock the exists property"""
        return self._data is not None

    def get(self):
        """Return the document object itself for chained method calls if needed, but in firebase admin SDK doc.get() returns a DocumentSnapshot, so we just return self as mock Snapshot"""
        return self

    def to_dict(self):
        """Return the document data"""
        return self._data if self._data else {}

class MockCollection:
    """Represents a mock Firestore collection"""
    def __init__(self, data):
        self._data = data
    
    def document(self, doc_id):
        """Return a MockDocument for the given document ID"""
        doc_data = self._data.get(doc_id)
        return MockDocument(doc_data)

class MockFirestoreClient:
    """Mock Firestore client that mimics firestore.client() interface"""
    
    # Define mock data with the following structure:
    MOCK_DATA = {
        "settings/network": {
            "simulateCampus": True,
            "campus_ips": ["192.168.1.0/24", "10.0.0.0/8"],
            "verified": True,  # Add this so verify-network passes
            "message": "Verified (campus simulation mode)"
        },
        "student_networks": {
            "student_123": {
                "section": "CS-A",
                "registered_networks": [
                    {
                        "ssid": "School_WiFi",
                        "mac_address": "AA:BB:CC:DD:EE:FF",
                        "is_registered": True
                    }
                ],
                "network_status": "verified",
                "last_verified": "2026-04-11T10:30:00Z"
            }
        }
    }
    
    def collection(self, collection_name):
        """Return a MockCollection for the given collection name"""
        if collection_name == "settings":
            return MockCollection({
                "network": self.MOCK_DATA["settings/network"]
            })
        elif collection_name == "student_networks":
            return MockCollection(self.MOCK_DATA["student_networks"])
        else:
            return MockCollection({})
