import pytest


def login(client, email):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "passw"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def submit(client, headers):
    draft = client.post("/api/v1/applications", headers=headers, json={
        "product_type": "term_loan", "requested_amount": "1000000.00", "requested_term_months": 24,
    })
    assert draft.status_code == 201
    result = draft.json()
    response = client.post(f"/api/v1/applications/{result['id']}/submit", headers=headers,
                           json={"version": result["version"]})
    assert response.status_code == 200
    return response.json()


def news(client, headers):
    response = client.get("/api/v1/news", headers=headers)
    assert response.status_code == 200
    result = response.json()
    assert len({item["id"] for item in result}) == len(result)
    assert all(item[field] for item in result for field in ["title", "excerpt", "body", "relevance"])
    return result


@pytest.mark.parametrize("email,expected", [(None, 401), ("test.employee1@example.com", 403)])
def test_news_only_for_authenticated_clients(auth_client, email, expected):
    headers = login(auth_client, email) if email else {}
    assert auth_client.get("/api/v1/news", headers=headers).status_code == expected


def test_news_distinguishes_individual_and_company(auth_client):
    individual = news(auth_client, login(auth_client, "demo.ip@example.com"))
    company = news(auth_client, login(auth_client, "test.client1@example.com"))
    assert individual[1]["id"] == "profile-individual"
    assert company[1]["id"] == "profile-company"
    assert "ЕГРИП" in individual[1]["body"] and "ЕГРЮЛ" in company[1]["body"]
    assert individual != company


def test_news_follows_offer_and_consent_without_leaking_other_clients(auth_client):
    owner = login(auth_client, "demo.ip@example.com")
    other = login(auth_client, "demo.review@example.com")
    assert news(auth_client, owner)[0]["id"] == "application-start"
    approved = submit(auth_client, owner)
    assert approved["offer"]["kind"] == "COUNTER_OFFER"
    article = news(auth_client, owner)[0]
    assert article["id"] == "application-counter-offer" and "1,35" in article["body"]
    assert news(auth_client, other)[0]["id"] == "application-start"
    issued = auth_client.post(f"/api/v1/applications/{approved['id']}/sign", headers=owner,
                              json={"version": approved["version"]})
    assert issued.status_code == 200
    assert news(auth_client, owner)[0]["id"] == "application-issued"
    draft = auth_client.post("/api/v1/applications", headers=owner, json={"product_type": "term_loan"})
    assert draft.status_code == 201
    assert news(auth_client, owner)[0]["id"] == "application-draft"


def test_news_explains_source_retry_and_missing_information(auth_client):
    owner = login(auth_client, "test.client3@example.com")
    employee = login(auth_client, "test.employee1@example.com")
    application = submit(auth_client, owner)
    assert news(auth_client, owner)[0]["id"] == "application-retry"
    response = auth_client.post(f"/api/v1/employee/applications/{application['id']}/retry-checks",
                                headers=employee, json={"version": application["version"]})
    assert response.status_code == 200 and response.json()["status"] == "NEEDS_INFO"
    assert news(auth_client, owner)[0]["id"] == "application-information"
    response = auth_client.post(f"/api/v1/applications/{application['id']}/fill", headers=owner, json={
        "version": response.json()["version"],
        "business_data": {"financials": {"annual_revenue": "6000000.00"}},
    })
    assert response.status_code == 200 and response.json()["offer"]["kind"] == "ORIGINAL"
    assert news(auth_client, owner)[0]["id"] == "application-approved"


def test_news_explains_manual_review_and_rejection(auth_client):
    owner = login(auth_client, "demo.review@example.com")
    employee = login(auth_client, "test.employee1@example.com")
    application = submit(auth_client, owner)
    assert news(auth_client, owner)[0]["id"] == "application-review"
    response = auth_client.post(f"/api/v1/employee/applications/{application['id']}/action",
                                headers=employee, json={
                                    "version": application["version"], "action": "REJECT",
                                    "decision_reason_code": "EMPLOYEE_RISK_DECLINED",
                                    "comment": "Решение сотрудника для проверки новостной ленты",
                                })
    assert response.status_code == 200
    assert news(auth_client, owner)[0]["id"] == "application-rejected"
