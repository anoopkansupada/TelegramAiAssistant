knowledge_hub jsonb {
  documents: [], // List of document references
  categories: [], // Document categorization
  access_rules: {}, // Access control configuration
  metadata: {} // Additional metadata
}
```

#### Document Storage (company_documents)
```sql
Table company_documents {
  id serial [pk]
  company_id integer [ref: > companies.id]
  title text [not null]
  description text
  document_type text [not null]
  category text [not null]
  url text [not null]
  version text
  status text [default: 'active']
  access_level text [default: 'internal']
  metadata jsonb
  created_by_id integer [ref: > users.id]
  created_at timestamp [default: `now()`]
  updated_at timestamp
  archived_at timestamp
}