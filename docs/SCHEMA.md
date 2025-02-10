interface User {
  id: number;
  username: string;
  password: string;
  twoFactorSecret?: string;
  role: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}
```

#### Companies
```typescript
interface Company {
  id: number;
  name: string;
  // ... other company fields as defined in schema.ts
  knowledgeHub: {
    documents: DocumentReference[];
    categories: string[];
    access_rules: Record<string, AccessRule>;
    metadata: Record<string, any>;
  };
}
```

#### Contacts
```typescript
interface Contact {
  id: number;
  firstName: string;
  lastName?: string;
  // ... other contact fields as defined in schema.ts
}
```

### Communication Tables

#### Messages
```typescript
interface Message {
  id: number;
  contactId: number;
  content: string;
  direction: 'inbound' | 'outbound';
  channel: string;
  sentiment?: string;
  entities: any[];
  topics: string[];
  summary?: string;
  contentAnalysis: {
    confidence: number;
    language: string | null;
    toxicity: number | null;
    engagement: number | null;
  };
  createdAt: Date;
}
```

### Document Management

#### Company Documents
```typescript
interface CompanyDocument {
  id: number;
  companyId: number;
  title: string;
  description?: string;
  documentType: string;
  category: string;
  url: string;
  version?: string;
  status: 'active' | 'archived';
  accessLevel: 'internal' | 'restricted' | 'public';
  metadata: Record<string, any>;
  createdById: number;
  createdAt: Date;
  updatedAt?: Date;
  archivedAt?: Date;
}
```

## Usage Examples

### Creating a New Company
```typescript
import { insertCompanySchema } from '@shared/schema';

const newCompany = {
  name: "Example Corp",
  industry: "Technology",
  // ... other required fields
};

// Validate company data
const validatedData = insertCompanySchema.parse(newCompany);
```

### Managing Documents
```typescript
import { insertCompanyDocumentSchema } from '@shared/schema';

const newDocument = {
  companyId: 1,
  title: "Q4 Report 2024",
  documentType: "report",
  category: "Financial",
  url: "https://example.com/docs/q4-2024",
  accessLevel: "internal"
};

// Validate document data
const validatedDoc = insertCompanyDocumentSchema.parse(newDocument);