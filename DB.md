1. users
- id
- email
- password_hash
- role
- created_at

2. clients
- id
- user_id
- inn
- company_name
- client_type
- created_at

3. employees
- id
- user_id
- full_name
- position
- created_at

4. applications
- id
- client_id
- product_type
- requested_amount
- requested_term_months
- purpose
- status
- business_data
- score
- risk_grade
- decision_reason_code
- approved_amount
- approved_rate
- created_at
- updated_at

5. application_status_history
- id
- application_id
- previous_status
- new_status
- changed_by
- comment
- created_at

6. application_checks
- id
- application_id
- check_type
- status
- response_data
- created_at

7. application_documents
- id
- application_id
- document_type
- file_url
- status
- created_at