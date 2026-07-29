
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** community-grievance-app
- **Date:** 2026-06-23
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 create_complaint_with_valid_data
- **Test Code:** [TC001_create_complaint_with_valid_data.py](./TC001_create_complaint_with_valid_data.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/d0f548db-75a1-436b-8f47-dadb9cd2c2d4
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 create_complaint_with_anonymous_submission
- **Test Code:** [TC002_create_complaint_with_anonymous_submission.py](./TC002_create_complaint_with_anonymous_submission.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/ed60f3af-9259-4de7-a93d-80b1ba978f8f
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 create_complaint_with_invalid_or_missing_fields
- **Test Code:** [TC003_create_complaint_with_invalid_or_missing_fields.py](./TC003_create_complaint_with_invalid_or_missing_fields.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/930dfb50-a599-45e8-8ad0-05b678577243
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 create_complaint_with_unresolvable_coordinates
- **Test Code:** [TC004_create_complaint_with_unresolvable_coordinates.py](./TC004_create_complaint_with_unresolvable_coordinates.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/86779eeb-9007-42c6-9228-cb74bef96b83
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 join_village_with_valid_code_authenticated
- **Test Code:** [TC005_join_village_with_valid_code_authenticated.py](./TC005_join_village_with_valid_code_authenticated.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/869159e3-95e3-40ec-acdc-5a18aa346849
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 join_village_with_invalid_code_authenticated
- **Test Code:** [TC006_join_village_with_invalid_code_authenticated.py](./TC006_join_village_with_invalid_code_authenticated.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/8057f336-94bd-45fc-980d-971d5d5651f7
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 join_village_without_authentication
- **Test Code:** [TC007_join_village_without_authentication.py](./TC007_join_village_without_authentication.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/80914f13-20c8-48dd-b3cc-107d6d6255c8
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 approve_admin_request_with_valid_request_super_admin
- **Test Code:** [TC008_approve_admin_request_with_valid_request_super_admin.py](./TC008_approve_admin_request_with_valid_request_super_admin.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 102, in <module>
  File "<string>", line 72, in test_approve_admin_request_with_valid_request_super_admin
  File "<string>", line 20, in login_super_admin
  File "/var/lang/lib/python3.12/site-packages/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 400 Client Error: Bad Request for url: https://dtucrczgagpzjbbrwqit.supabase.co/auth/v1/token?grant_type=password

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/9acbda32-7cdd-46cf-8802-dded88c80a12
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 reject_admin_request_with_valid_request_super_admin
- **Test Code:** [TC009_reject_admin_request_with_valid_request_super_admin.py](./TC009_reject_admin_request_with_valid_request_super_admin.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 80, in <module>
  File "<string>", line 20, in test_reject_admin_request_with_valid_request_super_admin
AssertionError: Super Admin auth failed: {"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/f1ec3df5-ace6-46e5-990f-cfff9378ce89
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 get_current_village_join_code_with_valid_village_admin
- **Test Code:** [TC010_get_current_village_join_code_with_valid_village_admin.py](./TC010_get_current_village_join_code_with_valid_village_admin.py)
- **Test Error:** Traceback (most recent call last):
  File "<string>", line 21, in test_get_current_village_join_code_with_valid_village_admin
  File "/var/lang/lib/python3.12/site-packages/requests/models.py", line 1024, in raise_for_status
    raise HTTPError(http_error_msg, response=self)
requests.exceptions.HTTPError: 400 Client Error: Bad Request for url: https://dtucrczgagpzjbbrwqit.supabase.co/auth/v1/token

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 60, in <module>
  File "<string>", line 23, in test_get_current_village_join_code_with_valid_village_admin
AssertionError: Authentication request failed: 400 Client Error: Bad Request for url: https://dtucrczgagpzjbbrwqit.supabase.co/auth/v1/token

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/21a8620f-f7fe-4558-9181-3afb22c592ba/c435cbe7-bcd4-46ee-b278-f920609399fd
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **70.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---