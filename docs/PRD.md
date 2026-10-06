# PRD-11 — AI Form Builder — Version 1 (V1)

## 1. Version Overview

**Product:** AI Form Builder  
**Version:** V1  
**AI Provider:** Groq API  
**Database:** Supabase PostgreSQL  
**Frontend:** React + Vite  
**Backend:** Node.js + Express.js

V1 focuses on delivering a reliable end-to-end form creation workflow:

> Natural Language Prompt → Groq AI → Form Schema → Form Builder → Public Form → Responses → Basic Analytics → AI Summary

The goal of V1 is to validate the core product idea with a small, production-ready feature set while keeping the architecture extensible for future versions.

---

# 2. V1 Goals

V1 must allow a user to:

1. Create an account and log in.
2. Describe a form using natural language.
3. Generate a structured form using Groq AI.
4. Edit the generated form.
5. Add, remove, edit, and reorder fields.
6. Preview the form.
7. Publish the form.
8. Share a public form link.
9. Collect responses.
10. View submitted responses.
11. View basic response analytics.
12. Generate an AI-powered response summary using Groq.

---

# 3. V1 Core Features

| # | Feature | Priority | V1 |
|---|---|---|---|
| 1 | Authentication | P0 | ✅ |
| 2 | AI Form Generation | P0 | ✅ |
| 3 | Dynamic Form Schema | P0 | ✅ |
| 4 | Form Builder | P0 | ✅ |
| 5 | Field Editing | P0 | ✅ |
| 6 | Form Preview | P0 | ✅ |
| 7 | Public Form URL | P0 | ✅ |
| 8 | Response Collection | P0 | ✅ |
| 9 | Response Dashboard | P0 | ✅ |
| 10 | Basic Analytics | P1 | ✅ |
| 11 | AI Response Summary | P0 | ✅ |
| 12 | Event Registration Limit | P1 | ✅ |
| 13 | Advanced Templates | P2 | ❌ |
| 14 | Collaboration | P2 | ❌ |
| 15 | Advanced AI Agents | P2 | ❌ |
| 16 | Advanced Integrations | P2 | ❌ |

---

# 4. V1 User Flow

## 4.1 Form Creation

```text
User
  ↓
Dashboard
  ↓
Create Form
  ↓
Describe Form
  ↓
Groq API
  ↓
Structured JSON Schema
  ↓
Validate Schema
  ↓
Open Form Builder
  ↓
User Edits Form
  ↓
Preview
  ↓
Publish
```

## 4.2 Response Flow

```text
Public Form
     ↓
User fills form
     ↓
Client Validation
     ↓
Backend Validation
     ↓
Supabase
     ↓
Response Stored
     ↓
Analytics Updated
```

## 4.3 AI Analysis Flow

```text
Responses
    ↓
Filter / Normalize Data
    ↓
Remove Sensitive Data
    ↓
Groq API
    ↓
Summary + Insights + Sentiment
    ↓
Store Analysis
    ↓
Analytics Dashboard
```

---

# 5. V1 AI Form Generation

## Input

The user provides a natural language description.

Example:

> Create an event registration form for a college hackathon. Ask for name, email, phone number, college, team size, and preferred track.

## Groq Output

The backend should request structured JSON rather than free-form text.

Example:

```json
{
  "title": "College Hackathon Registration",
  "description": "Register for the college hackathon.",
  "type": "event",
  "fields": [
    {
      "key": "full_name",
      "type": "text",
      "label": "Full Name",
      "required": true,
      "position": 1
    },
    {
      "key": "email",
      "type": "email",
      "label": "Email Address",
      "required": true,
      "position": 2
    },
    {
      "key": "phone",
      "type": "phone",
      "label": "Phone Number",
      "required": true,
      "position": 3
    },
    {
      "key": "college",
      "type": "text",
      "label": "College Name",
      "required": true,
      "position": 4
    }
  ]
}
```

## V1 AI Requirements

- Use Groq API.
- Generate only supported field types.
- Return structured JSON.
- Validate AI output with Zod.
- Reject malformed schemas.
- Prevent arbitrary executable content.
- Provide a safe fallback error.
- Never expose the Groq API key to the frontend.

---

# 6. V1 Supported Field Types

V1 should keep the field system intentionally small.

| Field | Type |
|---|---|
| Short Text | `text` |
| Long Text | `textarea` |
| Email | `email` |
| Number | `number` |
| Phone | `phone` |
| Select | `select` |
| Radio | `radio` |
| Checkbox | `checkbox` |
| Rating | `rating` |
| Date | `date` |
| Boolean | `boolean` |

### V1 Excluded Fields

- File upload
- Signature
- Address
- Location
- Payment
- Matrix/grid
- Ranking
- Conditional sections

These can be introduced in later versions.

---

# 7. V1 Form Builder

The builder should have three primary areas:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: Form Name | Preview | Save | Publish                │
├───────────────┬──────────────────────────────┬───────────────┤
│ Field Types   │ Form Canvas                  │ Field Settings│
│               │                              │               │
│ Text          │ Question 1                   │ Label         │
│ Email         │ Question 2                   │ Description   │
│ Number        │ Question 3                   │ Required      │
│ Select        │                              │ Options       │
│ Rating        │                              │ Validation    │
└───────────────┴──────────────────────────────┴───────────────┘
```

## Builder Capabilities

- Add field.
- Edit field.
- Delete field.
- Duplicate field.
- Reorder fields.
- Edit labels.
- Edit descriptions.
- Mark required.
- Configure select/radio/checkbox options.
- Configure basic validation.
- Save draft.
- Preview.
- Publish.

---

# 8. V1 Form Lifecycle

Forms use three statuses:

```text
DRAFT → PUBLISHED → CLOSED
```

### Draft

- Form is editable.
- Public URL is not active.

### Published

- Form is publicly accessible.
- Responses can be submitted.
- Builder remains editable with appropriate safeguards.

### Closed

- Form is no longer accepting responses.
- Existing responses remain accessible.

---

# 9. V1 Public Form

Each published form receives a unique URL:

```text
/forms/{slug}
```

Example:

```text
/forms/college-hackathon-registration
```

The public page should:

- Display form title.
- Display description.
- Render fields dynamically.
- Validate input.
- Submit responses.
- Show success state.
- Show closed-form state.
- Prevent submission when the response limit is reached.

---

# 10. V1 Response Collection

A response contains:

- Response ID
- Form ID
- Submission timestamp
- Answers
- Basic metadata

Example:

```json
{
  "form_id": "form_uuid",
  "answers": {
    "full_name": "Rahul Sharma",
    "email": "rahul@example.com",
    "college": "ABC University",
    "team_size": 4
  }
}
```

## Validation

Validation must happen at two levels:

```text
Frontend Validation
        ↓
Backend Validation
        ↓
Database
```

Backend validation is authoritative.

---

# 11. V1 Response Dashboard

The owner can:

- View total responses.
- View individual responses.
- Search responses.
- Filter responses.
- Sort by submission date.
- Open response details.
- View basic analytics.
- Generate AI summary.

Example:

```text
Responses
─────────────────────────────
Total Responses: 247

Search: [____________]

Name            Email             Date
------------------------------------------------
Rahul Sharma    rahul@...         Oct 01
Amit Patel      amit@...          Oct 01
Priya Shah      priya@...         Sep 30
```

---

# 12. V1 Analytics

V1 analytics should remain simple and useful.

## Metrics

- Total responses.
- Responses over time.
- Completion/submission count.
- Distribution for select/radio fields.
- Average rating.
- Numeric averages where applicable.

## Recommended Charts

- Line chart for responses over time.
- Bar chart for option distribution.
- Pie/donut chart only where it improves readability.
- Rating distribution.

Technology:

```text
Recharts
```

---

# 13. V1 AI Response Summary

The owner can click:

> Generate AI Summary

The backend sends sanitized response data to Groq.

Groq returns:

```json
{
  "summary": "Most respondents were satisfied with the event.",
  "key_insights": [
    "Participants appreciated the technical sessions.",
    "Many respondents requested longer networking sessions.",
    "Registration was strongest among third-year students."
  ],
  "sentiment": {
    "positive": 68,
    "neutral": 22,
    "negative": 10
  },
  "recommendations": [
    "Increase networking time.",
    "Add more advanced technical sessions."
  ]
}
```

## AI Analysis Types in V1

Only:

1. Overall summary.
2. Key insights.
3. Basic sentiment.
4. Recommendations.

Advanced predictive analytics are out of scope.

---

# 14. Event Registration Limit

V1 supports a simple response limit.

Example:

```text
Maximum registrations: 100
Current registrations: 97
Remaining: 3
```

When:

```text
response_count >= response_limit
```

the form automatically stops accepting responses.

The limit must be enforced server-side.

---

# 15. V1 Database Schema

## profiles

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## forms

```sql
CREATE TABLE forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    type TEXT DEFAULT 'survey',
    schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_limit INTEGER,
    response_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## form_fields

```sql
CREATE TABLE form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    required BOOLEAN DEFAULT FALSE,
    position INTEGER NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## responses

```sql
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);
```

## response_answers

```sql
CREATE TABLE response_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
    value JSONB
);
```

## ai_analyses

```sql
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL,
    summary TEXT,
    insights JSONB DEFAULT '[]'::jsonb,
    sentiment JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 16. V1 Database Relationships

```text
profiles
   │
   │ 1:N
   ▼
forms
   │
   ├──────────────┐
   │              │
   │ 1:N          │ 1:N
   ▼              ▼
form_fields    responses
                  │
                  │ 1:N
                  ▼
            response_answers

forms
  │
  │ 1:N
  ▼
ai_analyses
```

---

# 17. V1 API Structure

## Authentication

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

## Forms

```http
GET    /api/forms
POST   /api/forms
GET    /api/forms/:id
PUT    /api/forms/:id
DELETE /api/forms/:id
POST   /api/forms/:id/publish
POST   /api/forms/:id/close
```

## AI

```http
POST /api/ai/generate-form
POST /api/ai/analyze-responses
```

## Public Forms

```http
GET  /api/public/forms/:slug
POST /api/public/forms/:slug/responses
```

## Responses

```http
GET /api/forms/:id/responses
GET /api/forms/:id/responses/:responseId
```

## Analytics

```http
GET /api/forms/:id/analytics
```

---

# 18. V1 API Examples

## Generate Form

### Request

```json
{
  "prompt": "Create a customer feedback form with name, email, rating and comments."
}
```

### Response

```json
{
  "success": true,
  "data": {
    "title": "Customer Feedback",
    "description": "Share your experience with us.",
    "fields": []
  }
}
```

---

# 19. V1 Backend Architecture

```text
Client
  ↓
Express API
  ↓
Middleware
  ├── Authentication
  ├── Validation
  ├── Rate Limiting
  └── Error Handling
  ↓
Controllers
  ↓
Services
  ├── Form Service
  ├── Response Service
  ├── Analytics Service
  └── Groq Service
  ↓
Supabase / Groq
```

---

# 20. V1 Groq Architecture

The Groq API must only be called from the backend.

```text
React
  │
  │ Form generation request
  ▼
Express API
  │
  ▼
AI Controller
  │
  ▼
Groq Service
  │
  ▼
Groq API
  │
  ▼
JSON Schema
  │
  ▼
Zod Validation
  │
  ▼
Form Builder
```

Environment variable:

```env
GROQ_API_KEY=your_groq_api_key
```

The key must never be placed in:

```text
VITE_*
```

or exposed in frontend code.

---

# 21. V1 Frontend Pages

```text
/
├── Landing
├── Login
├── Register
├── Dashboard
├── Create Form
├── Form Builder
├── Form Preview
├── Responses
├── Analytics
└── Public Form
```

## Dashboard

Shows:

- Total forms.
- Published forms.
- Total responses.
- Recent forms.
- Create form button.

## Create Form

Contains:

- Prompt input.
- Example prompts.
- Generate button.
- Loading state.
- AI error state.

## Form Builder

Contains:

- Field list.
- Canvas.
- Field settings.
- Preview.
- Save.
- Publish.

---

# 22. V1 Folder Structure

```text
ai-form-builder/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── forms/
│   │   │   ├── builder/
│   │   │   ├── analytics/
│   │   │   └── dashboard/
│   │   │
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── CreateForm.jsx
│   │   │   ├── FormBuilder.jsx
│   │   │   ├── FormPreview.jsx
│   │   │   ├── Responses.jsx
│   │   │   ├── Analytics.jsx
│   │   │   └── PublicForm.jsx
│   │   │
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── schemas/
│   │   ├── utils/
│   │   ├── layouts/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── supabase.js
│   │   │   └── groq.js
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── formController.js
│   │   │   ├── responseController.js
│   │   │   ├── analyticsController.js
│   │   │   └── aiController.js
│   │   │
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── formService.js
│   │   │   ├── responseService.js
│   │   │   ├── analyticsService.js
│   │   │   └── groqService.js
│   │   │
│   │   ├── middleware/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   │
│   └── package.json
│
├── supabase/
│   └── migrations/
│
├── docs/
│   ├── PRD.md
│   ├── API.md
│   ├── DATABASE.md
│   └── AI.md
│
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

# 23. V1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| UI | shadcn/ui |
| State | Zustand |
| Drag & Drop | dnd-kit |
| Charts | Recharts |
| Backend | Node.js |
| API | Express.js |
| Validation | Zod |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| AI | Groq API |
| Storage | Supabase Storage |
| Hosting | Vercel + Render/Railway |
| Version Control | Git + GitHub |

---

# 24. V1 Security Requirements

## Authentication

- Supabase Auth.
- Protected dashboard routes.
- JWT validation on backend.

## Authorization

Users can only modify their own forms.

## Database Security

Use Supabase Row Level Security.

Example policy concept:

```text
User A
  ↓
Can access only
  ↓
Forms where forms.user_id = User A ID
```

## API Security

- Rate limiting.
- Request validation.
- Input sanitization.
- Centralized error handling.
- CORS configuration.
- No API keys in frontend.
- AI output validation.

---

# 25. V1 Non-Functional Requirements

## Performance

- Form generation response should normally complete within a few seconds.
- Public forms should load quickly.
- API endpoints should be optimized for common dashboard operations.

## Reliability

- AI failures must not corrupt forms.
- Database transactions should protect response creation.
- Duplicate submissions should be handled appropriately.

## Scalability

The architecture should allow:

- More AI providers.
- More field types.
- More analytics.
- Team collaboration.
- Integrations.

## Accessibility

- Keyboard navigation.
- Proper labels.
- Accessible form controls.
- Visible validation errors.
- Sufficient contrast.

---

# 26. V1 Error Handling

The application must handle:

```text
AI generation failed
Invalid AI schema
Authentication failed
Form not found
Form is closed
Response limit reached
Invalid response
Database error
Rate limit exceeded
Network failure
```

Example user-facing error:

```text
We couldn't generate your form right now.
Please try again.
```

Do not expose internal stack traces or API keys.

---

# 27. V1 Loading States

Important loading states:

- AI generation.
- Form saving.
- Publishing.
- Response submission.
- Analytics loading.
- AI analysis generation.

Use skeletons/spinners where appropriate.

---

# 28. V1 Design Direction

Recommended design:

> **Modern AI SaaS + Clean Productivity UI**

Reference characteristics:

- Typeform-style public forms.
- Notion/Linear-inspired dashboard.
- ChatGPT-style AI generation interface.
- Clean analytics dashboard.
- Minimal use of glassmorphism.

Avoid making the entire application glassmorphic. Use glass effects only for selected cards, dialogs, or AI-related elements.

---

# 29. V1 MVP Scope

### Must Have

```text
Authentication
     ↓
AI Form Generation
     ↓
Form Builder
     ↓
Dynamic Rendering
     ↓
Public Form
     ↓
Response Collection
     ↓
Response Dashboard
     ↓
Basic Analytics
     ↓
Groq AI Summary
```

### Nice to Have

- Event response limits.
- Form duplication.
- Basic templates.
- Search/filter responses.

### Not Required for V1

- Team collaboration.
- Real-time collaborative editing.
- Payments.
- Advanced workflows.
- Webhooks.
- Slack integration.
- Google Sheets integration.
- Email automation.
- Advanced conditional logic.
- File uploads.
- Custom domains.
- AI agents.
- Multi-provider AI routing.

---

# 30. V1 Development Phases

## Phase 1 — Project Setup

- Initialize frontend.
- Initialize backend.
- Configure Supabase.
- Configure environment variables.
- Configure Git.
- Configure basic UI.

## Phase 2 — Authentication

- Register.
- Login.
- Logout.
- Protected routes.
- User profile.

## Phase 3 — Database

- Create migrations.
- Create tables.
- Configure relationships.
- Configure RLS.
- Add indexes.

## Phase 4 — AI Generation

- Configure Groq.
- Create AI service.
- Create generation endpoint.
- Create structured prompt.
- Validate AI output.
- Render generated schema.

## Phase 5 — Form Builder

- Add fields.
- Edit fields.
- Delete fields.
- Duplicate fields.
- Reorder fields.
- Save draft.
- Preview.

## Phase 6 — Publishing

- Generate slug.
- Publish form.
- Public rendering.
- Close form.

## Phase 7 — Responses

- Submit response.
- Validate response.
- Store answers.
- Display response list.
- Display response details.

## Phase 8 — Analytics

- Response count.
- Response trends.
- Field distributions.
- Rating analytics.

## Phase 9 — AI Analysis

- Sanitize response data.
- Send data to Groq.
- Generate summary.
- Store analysis.
- Display insights.

## Phase 10 — Testing & Deployment

- Unit tests.
- API tests.
- Form submission tests.
- AI validation tests.
- Security testing.
- Production deployment.

---

# 31. V1 Testing Requirements

## Frontend

Test:

- Form builder.
- Field editing.
- Drag/reorder.
- Preview.
- Public submission.
- Validation.

## Backend

Test:

- Authentication.
- Form CRUD.
- Publishing.
- Response submission.
- Analytics.
- AI endpoints.

## AI

Test:

- Valid prompts.
- Ambiguous prompts.
- Unsupported fields.
- Malformed output.
- Empty responses.
- Large response datasets.

## Security

Test:

- Unauthorized form access.
- Unauthorized form editing.
- Invalid JWT.
- SQL/RPC injection attempts.
- XSS.
- Rate limiting.
- API key exposure.

---

# 32. V1 Success Criteria

V1 is successful when a new user can complete the following without developer assistance:

```text
Sign Up
  ↓
Describe a Form
  ↓
Generate Form with Groq
  ↓
Edit Form
  ↓
Preview Form
  ↓
Publish
  ↓
Share Link
  ↓
Receive Responses
  ↓
View Responses
  ↓
View Analytics
  ↓
Generate AI Summary
```

### Acceptance Criteria

- AI generates a valid form schema.
- Generated forms can be edited.
- Forms can be published.
- Public users can submit responses.
- Responses are persisted correctly.
- Owners can view responses.
- Analytics are calculated correctly.
- Groq can generate a response summary.
- Unauthorized users cannot access another user's private form data.
- Response limits are enforced server-side.
- No Groq credentials are exposed to the browser.

---

# 33. V1 Definition of Done

A feature is complete when:

- Frontend implementation is complete.
- Backend API is complete.
- Database integration is complete.
- Validation is implemented.
- Error handling is implemented.
- Authentication/authorization is verified.
- Tests pass.
- Responsive UI works.
- Production environment variables are configured.
- Documentation is updated.

---

# 34. V1 vs Future Versions

| Capability | V1 | V2+ |
|---|---:|---:|
| Authentication | ✅ | ✅ |
| AI form generation | ✅ | Enhanced |
| Groq API | ✅ | Multi-provider |
| Form builder | ✅ | Enhanced |
| Public forms | ✅ | Custom domains |
| Responses | ✅ | Advanced exports |
| Basic analytics | ✅ | Advanced analytics |
| AI summaries | ✅ | Advanced AI insights |
| Event limits | ✅ | Advanced registration |
| Templates | Basic | Advanced |
| Conditional logic | ❌ | ✅ |
| File uploads | ❌ | ✅ |
| Payments | ❌ | ✅ |
| Collaboration | ❌ | ✅ |
| Webhooks | ❌ | ✅ |
| Integrations | ❌ | ✅ |
| AI agents | ❌ | ✅ |
| Real-time collaboration | ❌ | ✅ |

---

# 35. Final V1 Architecture

```text
                    ┌──────────────────────┐
                    │       User           │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ React + Vite Client  │
                    │ Tailwind + shadcn    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Express REST API   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
      │   Supabase   │  │  Groq API    │  │ Validation   │
      │ PostgreSQL   │  │     AI       │  │    + Auth    │
      └──────┬───────┘  └──────────────┘  └──────────────┘
             │
             ▼
      ┌──────────────┐
      │ Forms        │
      │ Responses    │
      │ Analytics    │
      │ AI Analyses  │
      └──────────────┘
```

---

# 36. V1 Product Statement

> **AI Form Builder V1 enables users to create, publish, and analyze forms using natural language. Groq AI converts user descriptions into structured form schemas, while a visual form builder allows users to refine those forms before publishing them publicly. Submitted responses are stored in Supabase and transformed into useful analytics and AI-generated insights.**

This V1 establishes the core product loop and provides the foundation for advanced AI-powered form automation in future releases.
